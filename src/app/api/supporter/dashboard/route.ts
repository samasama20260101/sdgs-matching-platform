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

    // 1. アクティブ案件（OPEN / MATCHED / IN_PROGRESS）+ LISTED
    //    承認が3名未満なら引き続き申し出可能なため、OPENだけでなく全アクティブ状態を取得
    const { data: activeCases, error: openErr } = await supabaseAdmin
        .from('cases')
        .select(CASE_SELECT)
        .eq('visibility', 'LISTED')
        .in('status', ['OPEN', 'MATCHED', 'IN_PROGRESS'])
        .order('created_at', { ascending: false })
        .limit(200)
    if (openErr) console.error('activeCases error:', JSON.stringify(openErr))

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

    // 3. 自分がオファーした案件（RESOLVED/CLOSED/CANCELLED含む全状態）
    let myCases: typeof activeCases = []
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
    const caseMap = new Map<string, NonNullable<typeof activeCases>[number]>()
    ;(activeCases || []).forEach(c => { if (!caseMap.has(c.id)) caseMap.set(c.id, c) })
    ;(myCases || []).forEach(c => { caseMap.set(c.id, c) })
    const mergedCases = Array.from(caseMap.values())

    // 4. 各案件の承認済みサポーター数を一括取得
    const allCaseIds = mergedCases.map(c => c.id)
    const acceptedCountMap: Record<string, number> = {}
    if (allCaseIds.length > 0) {
        const { data: acceptedRows } = await supabaseAdmin
            .from('offers')
            .select('case_id')
            .in('case_id', allCaseIds)
            .eq('status', 'ACCEPTED')
        ;(acceptedRows || []).forEach((o: { case_id: string }) => {
            acceptedCountMap[o.case_id] = (acceptedCountMap[o.case_id] || 0) + 1
        })
    }

    // 5. owner_user_idを収集して users を2ステップで取得
    const ownerIds = [...new Set(mergedCases.map(c => c.owner_user_id).filter(Boolean))]
    const userMap: Record<string, { display_name: string; prefecture?: string | null; birth_date?: string | null }> = {}
    if (ownerIds.length > 0) {
        const { data: owners, error: ownerErr } = await supabaseAdmin
            .from('users')
            .select('id, display_name, prefecture, birth_date')
            .in('id', ownerIds)
        if (ownerErr) console.error('owners error:', JSON.stringify(ownerErr))
        ;(owners || []).forEach((u: { id: string; display_name: string; prefecture?: string | null; birth_date?: string | null }) => {
            userMap[u.id] = { display_name: u.display_name, prefecture: u.prefecture, birth_date: u.birth_date }
        })
    }

    // 6. enriched（my_offer_status + users + accepted_count 付与）
    //    未オファーのサポーターには承認上限(3名)に達した案件を除外する
    const MAX_ACCEPTED = 3
    const enriched = mergedCases
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map(c => ({
            ...c,
            my_offer_status: offerMap[c.id] || null,
            users: userMap[c.owner_user_id] || null,
            accepted_count: acceptedCountMap[c.id] || 0,
        }))
        .filter(c => {
            // 自分がオファー済みの案件は常に表示（進捗確認のため）
            if (offerMap[c.id]) return true
            // 未オファーの場合：承認が上限未満の案件のみ表示
            return (acceptedCountMap[c.id] || 0) < MAX_ACCEPTED
        })

    // 7. バッジ集計
    const { data: badges } = await supabaseAdmin
        .from('supporter_badges')
        .select('badge_key')
        .eq('supporter_user_id', supporterUserId)

    const badgeCounts: Record<string, number> = {}
    ;(badges || []).forEach((b: { badge_key: string }) => {
        badgeCounts[b.badge_key] = (badgeCounts[b.badge_key] || 0) + 1
    })

    return NextResponse.json({ cases: enriched, badgeCounts })
}
