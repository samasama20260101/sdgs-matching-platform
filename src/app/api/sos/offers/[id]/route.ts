// src/app/api/sos/offers/[id]/route.ts
// SOS側：オファーの承認・辞退（RLSバイパス）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MAX_ACCEPTED = 3  // 1案件あたりの承認上限

async function getAuthSOSUser(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    const { data: userData } = await supabaseAdmin
        .from('users').select('id, role').eq('auth_user_id', user.id).single()
    if (!userData || userData.role !== 'SOS') return null
    return userData
}

// PATCH: オファーのステータス変更（ACCEPTED / DECLINED）
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const userData = await getAuthSOSUser(request)
    if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // このオファーが自分の案件のものか確認
    const { data: offer } = await supabaseAdmin
        .from('offers')
        .select('id, case_id, status')
        .eq('id', id)
        .single()

    if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })

    const { data: caseData } = await supabaseAdmin
        .from('cases').select('id, owner_user_id').eq('id', offer.case_id).single()

    if (!caseData || caseData.owner_user_id !== userData.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // ── 承認処理 ──────────────────────────────────────────
    if (body.status === 'ACCEPTED') {
        // 現在の承認済み数を確認
        const { data: acceptedOffers } = await supabaseAdmin
            .from('offers')
            .select('id, accepted_order')
            .eq('case_id', offer.case_id)
            .eq('status', 'ACCEPTED')
            .order('accepted_order', { ascending: true })

        const currentCount = acceptedOffers?.length ?? 0

        if (currentCount >= MAX_ACCEPTED) {
            return NextResponse.json({ error: 'MAX_REACHED', message: '承認上限（3名）に達しています' }, { status: 400 })
        }

        // accepted_order を付番（1=主、2・3=副）
        const nextOrder = currentCount + 1

        const { error: updateError } = await supabaseAdmin
            .from('offers')
            .update({ status: 'ACCEPTED', accepted_order: nextOrder })
            .eq('id', id)

        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

        // 3名に達した場合、残りのPENDINGを全て自動DECLINED
        if (nextOrder >= MAX_ACCEPTED) {
            await supabaseAdmin
                .from('offers')
                .update({ status: 'DECLINED' })
                .eq('case_id', offer.case_id)
                .eq('status', 'PENDING')
        }

        return NextResponse.json({ ok: true, accepted_order: nextOrder, auto_declined: nextOrder >= MAX_ACCEPTED })
    }

    // ── 辞退処理 ──────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
        .from('offers').update(body).eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
}
