// src/app/api/supporter/dashboard/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const CASE_SELECT = 'id, title, description_free, status, urgency, created_at, ai_sdg_suggestion, owner_user_id'

export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabaseAdmin
        .from('users').select('id, role').eq('auth_user_id', user.id).single()
    if (!userData || userData.role !== 'SUPPORTER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supporterUserId = userData.id

    // 1. OPEN+LISTED案件（JOINなし）
    const { data: openCases, error: openErr } = await supabaseAdmin
        .from('cases')
        .select(CASE_SELECT)
        .eq('visibility', 'LISTED')
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false })
        .limit(200)
    if (openErr) console.error('openCases error:', JSON.stringify(openErr))

    // 2. 自分のオファー全件
    const { data: myAllOffers, error: offerErr } = await supabaseAdmin
        .from('offers')
        .select('case_id, status')
        .eq('supporter_user_id', supporterUserId)
    if (offerErr) console.error('myAllOffers error:', JSON.stringify(offerErr))

    const offerMap: Record<string, string> = {}
    ;(myAllOffers || []).forEach((o: { case_id: string; status: string }) => {
        offerMap[o.case_id] = o.status
    })
    const myOfferCaseIds = Object.keys(offerMap)

    // 3. 自分がオファーした案件（JOINなし）
    let myCases: typeof openCases = []
    if (myOfferCaseIds.length > 0) {
        const { data: myC, error: myCErr } = await supabaseAdmin
            .from('cases')
            .select(CASE_SELECT)
            .in('id', myOfferCaseIds)
            .order('created_at', { ascending: false })
        if (myCErr) console.error('myCases error:', JSON.stringify(myCErr))
        myCases = myC || []
    }

    // 重複排除マージ
    const caseMap = new Map<string, NonNullable<typeof openCases>[number]>()
    ;(openCases || []).forEach(c => { if (!caseMap.has(c.id)) caseMap.set(c.id, c) })
    ;(myCases || []).forEach(c => { caseMap.set(c.id, c) })
    const mergedCases = Array.from(caseMap.values())

    // 4. owner_user_idを収集して users を2ステップで取得
    const ownerIds = [...new Set(mergedCases.map(c => c.owner_user_id).filter(Boolean))]
    const userMap: Record<string, { display_name: string; prefecture?: string | null }> = {}
    if (ownerIds.length > 0) {
        const { data: owners, error: ownerErr } = await supabaseAdmin
            .from('users')
            .select('id, display_name, prefecture')
            .in('id', ownerIds)
        if (ownerErr) console.error('owners error:', JSON.stringify(ownerErr))
        ;(owners || []).forEach((u: { id: string; display_name: string; prefecture?: string | null }) => {
            userMap[u.id] = { display_name: u.display_name, prefecture: u.prefecture }
        })
    }

    // 5. enriched（my_offer_status + users 付与）
    const enriched = mergedCases
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map(c => ({
            ...c,
            my_offer_status: offerMap[c.id] || null,
            users: userMap[c.owner_user_id] || null,
        }))

    // 6. バッジ集計
    const { data: badges } = await supabaseAdmin
        .from('supporter_badges')
        .select('badge_key')
        .eq('supporter_user_id', supporterUserId)

    const badgeCounts: Record<string, number> = {}
    ;(badges || []).forEach((b: { badge_key: string }) => {
        badgeCounts[b.badge_key] = (badgeCounts[b.badge_key] || 0) + 1
    })

    return NextResponse.json({
        cases: enriched,
        badgeCounts,
        _debug: {
            open_listed: openCases?.length ?? 0,
            my_offer_case_ids_count: myOfferCaseIds.length,
            my_cases_count: myCases?.length ?? 0,
            merged: mergedCases.length,
            enriched_count: enriched.length,
        }
    })
}
