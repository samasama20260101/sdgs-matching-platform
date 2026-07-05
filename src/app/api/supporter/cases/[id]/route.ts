// src/app/api/supporter/cases/[id]/route.ts
// サポーター用：案件取得・ステータス更新（RLSバイパス）
import { supabaseAdmin } from '@/lib/supabase/server'
import { getActiveOrganizationForUser } from '@/lib/organizations'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { NextResponse } from 'next/server'

const ACTIVE_CASE_STATUSES = new Set(['OPEN', 'MATCHED'])

function isValidTimestamp(value: unknown) {
    return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function serverError() {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
}

// GET: 案件詳細取得（公開中、または自団体が関与済みの案件のみ）
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid case id' }, { status: 400 })
    const auth = await requireActiveAppUser(request, { roles: ['SUPPORTER'] })
    if ('response' in auth) return auth.response

    const organizationContext = await getActiveOrganizationForUser(auth.appUser.id)
    if (!organizationContext) {
        return NextResponse.json({ error: 'No active organization membership' }, { status: 403 })
    }

    const { data: caseData, error: caseError } = await supabaseAdmin
        .from('cases').select('*').eq('id', id).single()
    if (caseError || !caseData) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    const { data: myOffer, error: myOfferError } = await supabaseAdmin
        .from('offers')
        .select('id, status')
        .eq('case_id', id)
        .eq('supporter_organization_id', organizationContext.organizationId)
        .maybeSingle()
    if (myOfferError) {
        console.error('[supporter/cases] my offer fetch error:', myOfferError)
        return serverError()
    }

    const isPublicActiveCase = caseData.visibility === 'LISTED' && ACTIVE_CASE_STATUSES.has(caseData.status)
    if (!isPublicActiveCase && !myOffer) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // 承認済みオファーのorder一覧を取得（主/副判定用）
    const { data: acceptedOffers } = await supabaseAdmin
        .from('offers')
        .select('supporter_user_id, supporter_organization_id, accepted_order, status')
        .eq('case_id', id)
        .eq('status', 'ACCEPTED')
        .order('accepted_order', { ascending: true })

    // 承認済みサポーターのプロフィールを2ステップで取得（協業用）
    const organizationIds = [...new Set((acceptedOffers ?? []).map((o: { supporter_organization_id?: string | null }) => o.supporter_organization_id).filter(Boolean))]
    const organizationProfiles: Record<string, { display_name: string; organization_name: string | null; supporter_type: string }> = {}
    if (organizationIds.length > 0) {
        const { data: organizations } = await supabaseAdmin
            .from('organizations')
            .select('id, name, supporter_type')
            .in('id', organizationIds)
        ;(organizations ?? []).forEach((o: { id: string; name: string; supporter_type: string | null }) => {
            organizationProfiles[o.id] = {
                display_name: o.name,
                organization_name: o.name,
                supporter_type: o.supporter_type || 'NPO',
            }
        })
    }
    // acceptedOffers にプロフィール情報を付加
    const acceptedOffersWithProfile = (acceptedOffers ?? []).map((o: { supporter_user_id: string; supporter_organization_id?: string | null; accepted_order: number; status: string }) => ({
        ...o,
        profile: o.supporter_organization_id
            ? organizationProfiles[o.supporter_organization_id] ?? null
            : null,
    }))

    // オーナーの birth_date を取得（未成年判定用）
    const { data: ownerData } = await supabaseAdmin
        .from('users')
        .select('birth_date')
        .eq('id', caseData.owner_user_id)
        .single()

    return NextResponse.json({
        case: caseData,
        supporterUserId: auth.appUser.id,
        supporterOrganizationId: organizationContext.organizationId,
        acceptedOffers: acceptedOffersWithProfile,
        ownerBirthDate: ownerData?.birth_date ?? null,
    })
}

// PATCH: 案件ステータス更新（サポーターが担当している案件のみ）
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid case id' }, { status: 400 })
    const auth = await requireActiveAppUser(request, { roles: ['SUPPORTER'] })
    if ('response' in auth) return auth.response

    const organizationContext = await getActiveOrganizationForUser(auth.appUser.id)
    if (!organizationContext) {
        return NextResponse.json({ error: 'No active organization membership' }, { status: 403 })
    }

    // 自分がACCEPTED状態のオファーを持っているか確認
    const { data: offer } = await supabaseAdmin
        .from('offers')
        .select('id, accepted_order')
        .eq('case_id', id)
        .eq('supporter_organization_id', organizationContext.organizationId)
        .eq('status', 'ACCEPTED')
        .maybeSingle()

    if (!offer) {
        return NextResponse.json({ error: 'Not authorized for this case' }, { status: 403 })
    }

    const { data: primaryOffer, error: primaryOfferError } = await supabaseAdmin
        .from('offers')
        .select('id, accepted_order')
        .eq('case_id', id)
        .eq('status', 'ACCEPTED')
        .not('accepted_order', 'is', null)
        .order('accepted_order', { ascending: true })
        .limit(1)
        .maybeSingle()

    if (primaryOfferError) {
        console.error('[supporter/cases] primary offer fetch error:', primaryOfferError)
        return serverError()
    }
    if (!primaryOffer || primaryOffer.id !== offer.id) {
        return NextResponse.json(
            { error: 'NOT_PRIMARY_SUPPORTER', message: '解決報告は主サポーターのみ実行できます' },
            { status: 403 }
        )
    }

    const body = await request.json()
    if (!body.supporter_resolved_at || Object.keys(body).length !== 1 || !isValidTimestamp(body.supporter_resolved_at)) {
        return NextResponse.json({ error: 'Invalid update' }, { status: 400 })
    }
    const { data: updatedCase, error: updateError } = await supabaseAdmin
        .from('cases')
        .update({ supporter_resolved_at: body.supporter_resolved_at })
        .eq('id', id)
        .eq('status', 'MATCHED')
        .is('supporter_resolved_at', null)
        .select('id')
        .maybeSingle()
    if (updateError) {
        console.error('[supporter/cases] case update error:', updateError)
        return serverError()
    }
    if (!updatedCase) {
        return NextResponse.json({ error: 'STALE_STATE', message: '他の担当者がすでに操作しました' }, { status: 409 })
    }

    const { error: messageError } = await supabaseAdmin.from('messages').insert({
        case_id: id,
        sender_user_id: auth.appUser.id,
        sender_organization_id: organizationContext.organizationId,
        sender_display_name_snapshot: 'システム',
        sender_role_snapshot: 'SYSTEM',
        sender_organization_name_snapshot: organizationContext.organization.name,
        message_type: 'SYSTEM',
        // system_key: 表示時に閲覧者の言語でレンダリング（messages/*/system.json）。content はja併記（互換・監査用）
        system_key: 'resolutionReported',
        system_params: {},
        content: '__SYSTEM__サポーターから解決報告が届きました。相談内容が解決していれば「解決を確認する」を選んでください。まだ困りごとが残っている場合は「まだ解決していない」を選び、チャットで状況を共有してください。',
    })
    if (messageError) {
        console.error('[supporter/cases] resolution system message insert error:', messageError)
    }

    return NextResponse.json({ ok: true })
}
