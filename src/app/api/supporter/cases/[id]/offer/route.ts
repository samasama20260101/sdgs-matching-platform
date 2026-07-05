// src/app/api/supporter/cases/[id]/offer/route.ts
// サポーター用：特定案件へのオファー取得・送信（RLSバイパス）
import { supabaseAdmin } from '@/lib/supabase/server'
import { getActiveOrganizationForUser } from '@/lib/organizations'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { NextResponse } from 'next/server'
import { MAX_SUPPORTERS_PER_CASE } from '@/lib/constants/sdgs'

const MAX_OFFER_MESSAGE_LENGTH = 1000

async function getAuthSupporterUser(request: Request) {
    const auth = await requireActiveAppUser(request, { roles: ['SUPPORTER'] })
    if ('response' in auth) return auth.response

    const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, role, display_name')
        .eq('id', auth.appUser.id)
        .single()
    if (userError || !userData) {
        if (userError) console.error('[supporter/cases/offer] user fetch error:', userError)
        return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const organizationContext = await getActiveOrganizationForUser(userData.id)
    if (!organizationContext) return NextResponse.json({ error: 'No active organization membership' }, { status: 403 })
    return {
        ...userData,
        organization_id: organizationContext.organizationId,
        organization_role: organizationContext.organizationRole,
        organization_name: organizationContext.organization.name,
    }
}

function isErrorResponse(value: Awaited<ReturnType<typeof getAuthSupporterUser>>): value is NextResponse {
    return value instanceof NextResponse
}

function normalizeOfferMessage(value: unknown) {
    if (typeof value !== 'string') return { ok: false as const, error: 'REQUIRED' as const }
    const message = value.trim()
    if (!message) return { ok: false as const, error: 'REQUIRED' as const }
    if (message.length > MAX_OFFER_MESSAGE_LENGTH) return { ok: false as const, error: 'TOO_LONG' as const }
    return { ok: true as const, value: message }
}

function serverError() {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
}

// GET: 自分のオファーを取得
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid case id' }, { status: 400 })
    const userData = await getAuthSupporterUser(request)
    if (isErrorResponse(userData)) return userData

    const { data: offer } = await supabaseAdmin
        .from('offers')
        .select('*')
        .eq('case_id', id)
        .eq('supporter_organization_id', userData.organization_id)
        .maybeSingle()

    return NextResponse.json({ offer: offer ?? null })
}

// POST: 新規オファー送信
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid case id' }, { status: 400 })
    const userData = await getAuthSupporterUser(request)
    if (isErrorResponse(userData)) return userData

    const { message } = await request.json()
    const normalizedMessage = normalizeOfferMessage(message)
    if (!normalizedMessage.ok && normalizedMessage.error === 'REQUIRED') {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }
    if (!normalizedMessage.ok && normalizedMessage.error === 'TOO_LONG') {
        return NextResponse.json({ error: 'MESSAGE_TOO_LONG', message: `申し出メッセージは${MAX_OFFER_MESSAGE_LENGTH}文字以内で入力してください` }, { status: 400 })
    }
    const { data: caseData } = await supabaseAdmin
        .from('cases')
        .select('id, status, visibility')
        .eq('id', id)
        .single()
    if (!caseData || !['OPEN', 'MATCHED'].includes(caseData.status)) {
        return NextResponse.json({ error: 'CASE_NOT_ACTIVE', message: 'この案件には申し出できません' }, { status: 409 })
    }
    if (caseData.visibility !== 'LISTED') {
        return NextResponse.json({ error: 'CASE_NOT_AVAILABLE', message: 'この案件には申し出できません' }, { status: 409 })
    }

    const { data: existingOffer } = await supabaseAdmin
        .from('offers')
        .select('id')
        .eq('case_id', id)
        .eq('supporter_organization_id', userData.organization_id)
        .maybeSingle()
    if (existingOffer) {
        return NextResponse.json({ error: 'DUPLICATE' }, { status: 409 })
    }

    // 承認上限チェック
    const { data: acceptedOffers } = await supabaseAdmin
        .from('offers')
        .select('id')
        .eq('case_id', id)
        .eq('status', 'ACCEPTED')
    if ((acceptedOffers?.length ?? 0) >= MAX_SUPPORTERS_PER_CASE) {
        return NextResponse.json(
            { error: 'MAX_REACHED', message: `この案件はすでに${MAX_SUPPORTERS_PER_CASE}名のサポーターが承認されているため、申し出できません` },
            { status: 400 }
        )
    }

    const { data, error } = await supabaseAdmin
        .from('offers')
        .insert([{
            case_id: id,
            supporter_user_id: userData.id,
            supporter_organization_id: userData.organization_id,
            created_by_user_id: userData.id,
            message: normalizedMessage.value,
            status: 'PENDING',
        }])
        .select()
        .single()

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: 'DUPLICATE' }, { status: 409 })
        }
        console.error('[supporter/cases/offer] offer insert error:', error)
        return serverError()
    }

    return NextResponse.json({ offer: data })
}

// PATCH: 既存オファー更新（再送・ステータス変更）
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid case id' }, { status: 400 })
    const userData = await getAuthSupporterUser(request)
    if (isErrorResponse(userData)) return userData

    const body = await request.json()
    const { offerId } = body

    if (!offerId) {
        return NextResponse.json({ error: 'offerId is required' }, { status: 400 })
    }
    if (!isUuid(offerId)) {
        return NextResponse.json({ error: 'Invalid offer id' }, { status: 400 })
    }

    // 自分のオファーであること確認
    const { data: offer } = await supabaseAdmin
        .from('offers').select('id, supporter_organization_id, case_id, status')
        .eq('id', offerId).eq('case_id', id).single()

    if (!offer || offer.supporter_organization_id !== userData.organization_id) {
        return NextResponse.json({ error: 'Not your offer' }, { status: 403 })
    }

    const { data: caseData } = await supabaseAdmin
        .from('cases')
        .select('id, status, supporter_resolved_at, visibility')
        .eq('id', id)
        .single()
    if (!caseData) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // PENDINGへの再申し出の場合、承認上限チェック
    if (body.status === 'PENDING') {
        if (!['WITHDRAWN', 'DECLINED'].includes(offer.status) || !['OPEN', 'MATCHED'].includes(caseData.status) || caseData.visibility !== 'LISTED') {
            return NextResponse.json({ error: 'STALE_STATE', message: '他の担当者がすでに操作しました' }, { status: 409 })
        }
        const { data: acceptedOffers } = await supabaseAdmin
            .from('offers')
            .select('id')
            .eq('case_id', id)
            .eq('status', 'ACCEPTED')
        if ((acceptedOffers?.length ?? 0) >= MAX_SUPPORTERS_PER_CASE) {
            return NextResponse.json(
                { error: 'MAX_REACHED', message: `この案件はすでに${MAX_SUPPORTERS_PER_CASE}名のサポーターが承認されているため、申し出できません` },
                { status: 400 }
            )
        }
        const message = normalizeOfferMessage(body.message)
        if (!message.ok && message.error === 'REQUIRED') {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 })
        }
        if (!message.ok && message.error === 'TOO_LONG') {
            return NextResponse.json({ error: 'MESSAGE_TOO_LONG', message: `申し出メッセージは${MAX_OFFER_MESSAGE_LENGTH}文字以内で入力してください` }, { status: 400 })
        }
        const { data: updatedOffer, error: updateError } = await supabaseAdmin
            .from('offers')
            .update({
                status: 'PENDING',
                message: message.value,
                created_at: new Date().toISOString(),
                withdrawal_reason: null,
                withdrawn_at: null,
                withdrawn_by_user_id: null,
            })
            .eq('id', offerId)
            .eq('status', offer.status)
            .select('id')
            .maybeSingle()
        if (updateError) {
            console.error('[supporter/cases/offer] offer republish error:', updateError)
            return serverError()
        }
        if (!updatedOffer) {
            return NextResponse.json({ error: 'STALE_STATE', message: '他の担当者がすでに操作しました' }, { status: 409 })
        }
        return NextResponse.json({ ok: true })
    }

    // WITHDRAWNへの変更（ACCEPTED状態からの離脱）の場合、案件ステータスを巻き戻す
    if (body.status === 'WITHDRAWN') {
        if (!['PENDING', 'ACCEPTED'].includes(offer.status)) {
            return NextResponse.json({ error: 'STALE_STATE', message: '他の担当者がすでに操作しました' }, { status: 409 })
        }
        if (offer.status === 'ACCEPTED' && caseData.supporter_resolved_at) {
            return NextResponse.json({ error: 'RESOLUTION_PENDING', message: '解決報告の確認中は対応をキャンセルできません' }, { status: 409 })
        }
        const withdrawalReason = typeof body.withdrawal_reason === 'string' ? body.withdrawal_reason.trim() : ''
        if (offer.status === 'ACCEPTED' && !withdrawalReason) {
            return NextResponse.json({ error: 'WITHDRAWAL_REASON_REQUIRED', message: '対応キャンセルの理由を入力してください' }, { status: 400 })
        }
        if (withdrawalReason.length > 1000) {
            return NextResponse.json({ error: 'WITHDRAWAL_REASON_TOO_LONG', message: '理由は1000文字以内で入力してください' }, { status: 400 })
        }
        const { data: updatedOffer, error: updateError } = await supabaseAdmin
            .from('offers')
            .update({
                status: 'WITHDRAWN',
                withdrawal_reason: withdrawalReason || null,
                withdrawn_at: new Date().toISOString(),
                withdrawn_by_user_id: userData.id,
            })
            .eq('id', offerId)
            .eq('status', offer.status)
            .select('id')
            .maybeSingle()
        if (updateError) {
            console.error('[supporter/cases/offer] offer withdrawal error:', updateError)
            return serverError()
        }
        if (!updatedOffer) {
            return NextResponse.json({ error: 'STALE_STATE', message: '他の担当者がすでに操作しました' }, { status: 409 })
        }

        // ACCEPTED から離脱した場合、残りのACCEPTED数に応じて案件ステータスを調整
        if (offer.status === 'ACCEPTED') {
            const { data: remainingAccepted } = await supabaseAdmin
                .from('offers')
                .select('id')
                .eq('case_id', id)
                .eq('status', 'ACCEPTED')

            const remainingCount = remainingAccepted?.length ?? 0

            if (remainingCount === 0) {
                // 誰もいなくなったら OPEN に戻す
                await supabaseAdmin
                    .from('cases')
                    .update({ status: 'OPEN' })
                    .eq('id', id)
                    .in('status', ['MATCHED'])
            }
            // 1名以上残っている場合はステータス変更不要（主が繰り上がるのみ）
            await supabaseAdmin.from('messages').insert({
                case_id: id,
                sender_user_id: userData.id,
                sender_organization_id: userData.organization_id,
                sender_display_name_snapshot: userData.display_name,
                sender_role_snapshot: 'SUPPORTER',
                sender_organization_name_snapshot: userData.organization_name,
                message_type: 'SYSTEM',
                // 理由文（withdrawalReason）はユーザー生成のため翻訳対象外（設計§5.5）
                system_key: 'offerWithdrawn',
                system_params: { organizationName: userData.organization_name, reason: withdrawalReason },
                content: `__SYSTEM__${userData.organization_name}が対応をキャンセルしました。理由：${withdrawalReason}`,
            })
        }

        return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 400 })
}
