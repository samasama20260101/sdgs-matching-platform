// src/app/api/sos/offers/[id]/route.ts
// SOS側：オファーの承認・辞退（RLSバイパス）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { MAX_SUPPORTERS_PER_CASE } from '@/lib/constants/sdgs'

const MAX_ACCEPTED = MAX_SUPPORTERS_PER_CASE  // 1案件あたりの承認上限

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
            p_max_accepted: MAX_ACCEPTED,
        })
        if (acceptError) return NextResponse.json({ error: acceptError.message }, { status: 500 })
        if (result?.error) {
            const status = result.error === 'FORBIDDEN' ? 403 : 409
            return NextResponse.json({ error: result.error, message: '他の操作が先に完了しています' }, { status })
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

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
}
