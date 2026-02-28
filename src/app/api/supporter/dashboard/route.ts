// src/app/api/supporter/dashboard/route.ts
// サポーターダッシュボード用：案件一覧・オファー状況・バッジ取得（RLSバイパス）
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
        .from('users').select('id, role').eq('auth_user_id', user.id).single()
    if (!userData || userData.role !== 'SUPPORTER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supporterUserId = userData.id

    // 1. OPEN状態でAI分析済みの案件を取得
    const { data: openCases } = await supabaseAdmin
        .from('cases')
        .select('*, users!cases_owner_user_id_fkey ( display_name, prefecture )')
        .eq('visibility', 'LISTED')
        .eq('status', 'OPEN')
        .not('ai_sdg_suggestion', 'is', null)
        .order('created_at', { ascending: false })

    // 2. 自分がPENDING/ACCEPTEDのオファーを持つ案件ID
    const { data: myOfferCases } = await supabaseAdmin
        .from('offers')
        .select('case_id')
        .eq('supporter_user_id', supporterUserId)
        .in('status', ['PENDING', 'ACCEPTED'])

    const myOfferCaseIds = (myOfferCases || []).map((o: { case_id: string }) => o.case_id)

    // 3. 自分がオファー中の案件でOPEN以外（MATCHED/IN_PROGRESS/RESOLVED）も取得
    let matchedCases: typeof openCases = []
    if (myOfferCaseIds.length > 0) {
        const { data: matched } = await supabaseAdmin
            .from('cases')
            .select('*, users!cases_owner_user_id_fkey ( display_name, prefecture )')
            .in('id', myOfferCaseIds)
            .neq('status', 'OPEN')
            .order('created_at', { ascending: false })
        matchedCases = matched || []
    }

    // 重複排除・マージ
    const caseMap = new Map<string, typeof openCases extends (infer T)[] | null ? T : never>()
        ;[...(openCases || []), ...(matchedCases || [])].forEach(c => {
            if (!caseMap.has(c.id)) caseMap.set(c.id, c)
        })
    const casesData = Array.from(caseMap.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // 4. 自分の全オファー状況
    const { data: myOffers } = await supabaseAdmin
        .from('offers')
        .select('case_id, status')
        .eq('supporter_user_id', supporterUserId)

    const offerMap: Record<string, string> = {}
        ; (myOffers || []).forEach((o: { case_id: string; status: string }) => {
            offerMap[o.case_id] = o.status
        })

    const enriched = casesData.map(c => ({
        ...c,
        my_offer_status: offerMap[c.id] || null,
    }))

    // 5. バッジ集計
    const { data: badges } = await supabaseAdmin
        .from('supporter_badges')
        .select('badge_key')
        .eq('supporter_user_id', supporterUserId)

    const badgeCounts: Record<string, number> = {}
        ; (badges || []).forEach((b: { badge_key: string }) => {
            badgeCounts[b.badge_key] = (badgeCounts[b.badge_key] || 0) + 1
        })

    return NextResponse.json({ cases: enriched, badgeCounts })
}