// src/app/api/sos/offers/[id]/route.ts
// SOS側：オファーの承認・辞退（RLSバイパス）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
    const { error: updateError } = await supabaseAdmin
        .from('offers').update(body).eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
}