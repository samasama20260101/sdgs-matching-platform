// src/app/api/sos/offers/[id]/route.ts
// SOS側：オファーの承認・辞退（RLSバイパス）
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { NextResponse } from 'next/server'
import { getMaxSupportersForCase } from '@/lib/constants/disaster'

function serverError() {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
}

// PATCH: オファーのステータス変更（ACCEPTED / DECLINED）
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid offer id' }, { status: 400 })
    const auth = await requireActiveAppUser(request, { roles: ['SOS'] })
    if ('response' in auth) return auth.response
    const userData = auth.appUser

    // このオファーが自分の案件のものか確認
    const { data: offer } = await supabaseAdmin
        .from('offers')
        .select('id, case_id, status')
        .eq('id', id)
        .single()

    if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })

    const { data: caseData } = await supabaseAdmin
        .from('cases').select('id, owner_user_id, intake_qna').eq('id', offer.case_id).single()

    if (!caseData || caseData.owner_user_id !== userData.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // ── 承認処理 ──────────────────────────────────────────
    if (body.status === 'ACCEPTED') {
        // オファーがPENDING状態か確認（取り下げ済みは承認不可）
        if (offer.status !== 'PENDING') {
            return NextResponse.json(
                { error: 'OFFER_NOT_PENDING', message: 'この申し出はすでに取り下げられているか、無効な状態です' },
                { status: 400 }
            )
        }

        const { data: result, error: acceptError } = await supabaseAdmin.rpc('accept_sos_offer', {
            p_offer_id: id,
            p_sos_user_id: userData.id,
            // 承認上限は案件ごと(災害イベントの指定があればその値。熊本地震=1)
            p_max_accepted: getMaxSupportersForCase(caseData.intake_qna),
        })
        if (acceptError) {
            console.error('[sos/offers] accept_sos_offer error:', acceptError)
            return serverError()
        }
        if (result?.error) {
            const status = result.error === 'FORBIDDEN' ? 403 : 409
            return NextResponse.json({ error: result.error, message: '他の操作が先に完了しています' }, { status })
        }

        const { error: caseUpdateError } = await supabaseAdmin
            .from('cases')
            .update({ status: 'MATCHED' })
            .eq('id', offer.case_id)
            .eq('status', 'OPEN')
        if (caseUpdateError) {
            console.error('[sos/offers] case matched update error:', caseUpdateError)
            return serverError()
        }

        return NextResponse.json(result)
    }

    // ── 辞退処理 ──────────────────────────────────────────
    if (body.status !== 'DECLINED' || offer.status !== 'PENDING') {
        return NextResponse.json({ error: 'OFFER_NOT_PENDING', message: '他の操作が先に完了しています' }, { status: 409 })
    }
    const updateData = { status: 'DECLINED', declined_at: body.declined_at, declined_by_user_id: userData.id }
    const { error: updateError } = await supabaseAdmin
        .from('offers').update(updateData).eq('id', id).eq('status', 'PENDING')

    if (updateError) {
        console.error('[sos/offers] decline offer error:', updateError)
        return serverError()
    }

    return NextResponse.json({ ok: true })
}
