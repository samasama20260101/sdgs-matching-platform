// src/app/api/supporter/dashboard/route.ts
// サポーターダッシュボード用：案件一覧・オファー状況・バッジ取得（RLSバイパス）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const CASE_SELECT = 'id, title, description_free, status, urgency, created_at, ai_sdg_suggestion, ai_keywords, users!cases_owner_user_id_fkey ( display_name, prefecture )'

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

    // 1. 公開中のOPEN案件（visibility=LISTEDのみ・AI分析済み問わず）
    const { data: openCases, error: openErr } = await supabaseAdmin
        .from('cases')
        .select(CASE_SELECT)
        .eq('visibility', 'LISTED')
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false })
        .limit(200)

    if (openErr) console.error('openCases error:', openErr)

    // 2. 自分がオファーしたことがある全案件ID（ステータス問わず）
    const { data: myAllOffers, error: offerErr } = await supabaseAdmin
        .from('offers')
        .select('case_id, status')
        .eq('supporter_user_id', supporterUserId)

    if (offerErr) console.error('myAllOffers error:', offerErr)

    const offerMap: Record<string, string> = {}
    ;(myAllOffers || []).forEach((o: { case_id: string; status: string }) => {
        offerMap[o.case_id] = o.status
    })
    const myOfferCaseIds = Object.keys(offerMap)

    // 3. 自分がオファーした案件を全件取得（OPEN含む全ステータス）
    let myCases: typeof openCases = []
    if (myOfferCaseIds.length > 0) {
        const { data: myC, error: myCErr } = await supabaseAdmin
            .from('cases')
            .select(CASE_SELECT)
            .in('id', myOfferCaseIds)
            .order('created_at', { ascending: false })
        if (myCErr) console.error('myCases error:', myCErr)
        myCases = myC || []
    }

    // 重複排除・マージ（自分のオファー案件優先）
    const caseMap = new Map<string, (typeof openCases extends (infer T)[] | null ? T : never)>()
    // まずOPEN案件を入れる
    ;(openCases || []).forEach(c => { if (!caseMap.has(c.id)) caseMap.set(c.id, c) })
    // 自分のオファー案件で上書き（より詳しい状態が入っている）
    ;(myCases || []).forEach(c => { caseMap.set(c.id, c) })

    const casesData = Array.from(caseMap.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const enriched = casesData.map(c => ({
        ...c,
        my_offer_status: offerMap[c.id] || null,
    }))

    // 4. バッジ集計
    const { data: badges } = await supabaseAdmin
        .from('supporter_badges')
        .select('badge_key')
        .eq('supporter_user_id', supporterUserId)

    const badgeCounts: Record<string, number> = {}
    ;(badges || []).forEach((b: { badge_key: string }) => {
        badgeCounts[b.badge_key] = (badgeCounts[b.badge_key] || 0) + 1
    })

    // デバッグ情報（確認後削除）
    const { data: allCases } = await supabaseAdmin
        .from('cases')
        .select('id, status, visibility, ai_sdg_suggestion')
        .order('created_at', { ascending: false })
        .limit(50)

    return NextResponse.json({ 
        cases: enriched, 
        badgeCounts,
        _debug: {
            total_cases_in_db: allCases?.length ?? 0,
            cases_by_status: allCases?.reduce((acc: Record<string,number>, c) => { acc[c.status] = (acc[c.status]||0)+1; return acc }, {}),
            cases_by_visibility: allCases?.reduce((acc: Record<string,number>, c) => { const v = c.visibility ?? 'null'; acc[v] = (acc[v]||0)+1; return acc }, {}),
            ai_analyzed: allCases?.filter(c => c.ai_sdg_suggestion !== null).length ?? 0,
            open_listed: openCases?.length ?? 0,
            my_offer_case_ids: myOfferCaseIds,
            my_cases_count: myCases?.length ?? 0,
        }
    })
}
