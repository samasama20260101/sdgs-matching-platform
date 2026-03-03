// src/app/api/sos/cases/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabaseAdmin
        .from('users').select('id').eq('auth_user_id', user.id).single()
    if (!userData) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { data: cases, error: casesError } = await supabaseAdmin
        .from('cases').select('*').eq('owner_user_id', userData.id).order('created_at', { ascending: false })
    if (casesError) return NextResponse.json({ error: casesError.message }, { status: 500 })

    if (!cases || cases.length === 0) return NextResponse.json({ cases: [], userId: userData.id })

    // OPENケースのPENDINGオファー数を取得
    const openCaseIds = cases.filter((c: any) => c.status === 'OPEN').map((c: any) => c.id)
    const offerCountMap: Record<string, number> = {}
    if (openCaseIds.length > 0) {
        const { data: offers } = await supabaseAdmin
            .from('offers')
            .select('case_id')
            .in('case_id', openCaseIds)
            .eq('status', 'PENDING')
        ;(offers || []).forEach((o: any) => {
            offerCountMap[o.case_id] = (offerCountMap[o.case_id] || 0) + 1
        })
    }

    const enriched = cases.map((c: any) => ({
        ...c,
        pending_offer_count: offerCountMap[c.id] || 0,
    }))

    return NextResponse.json({ cases: enriched, userId: userData.id })
}

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabaseAdmin
        .from('users').select('id').eq('auth_user_id', user.id).single()
    if (!userData) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const body = await request.json()

    const { data: caseData, error: caseError } = await supabaseAdmin
        .from('cases')
        .insert([{ ...body, owner_user_id: userData.id }])
        .select()
        .single()
    if (caseError) return NextResponse.json({ error: caseError.message }, { status: 500 })

    return NextResponse.json({ case: caseData })
}