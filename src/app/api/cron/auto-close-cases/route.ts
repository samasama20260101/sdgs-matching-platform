// src/app/api/cron/auto-close-cases/route.ts
// Vercel Cron: 以下の2条件で自動処理（毎日午前2時）
// 1. サポーター解決報告から14日後に自動RESOLVED
// 2. MATCHEDのまま最終メッセージから14日間無活動 → 自動CLOSED
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    // Vercel Cronからのリクエストのみ許可
    const authHeader = request.headers.get('Authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const deadline = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) // 14日前

    // ─────────────────────────────────────────────────────
    // 処理1: supporter_resolved_at から14日経過 → RESOLVED
    // ─────────────────────────────────────────────────────
    const { data: resolvedCases, error: fetchError } = await supabaseAdmin
        .from('cases')
        .select('id, owner_user_id')
        .eq('status', 'MATCHED')
        .not('supporter_resolved_at', 'is', null)
        .lt('supporter_resolved_at', deadline.toISOString())

    if (fetchError) {
        console.error('[auto-close] fetch error:', fetchError)
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    let resolvedCount = 0
    const alreadyResolvedIds: string[] = []

    if (resolvedCases && resolvedCases.length > 0) {
        const resolvedIds = resolvedCases.map((c: { id: string }) => c.id)

        const { error: updateError } = await supabaseAdmin
            .from('cases')
            .update({ status: 'RESOLVED', resolved_at: now.toISOString() })
            .in('id', resolvedIds)

        if (updateError) {
            console.error('[auto-close] resolved update error:', updateError)
        } else {
            const messageInserts = resolvedCases.map((c: { id: string; owner_user_id: string }) => ({
                case_id: c.id,
                sender_user_id: c.owner_user_id,
                content: '__SYSTEM__サポーターの解決報告から14日が経過したため、自動的に解決済みとなりました。',
            }))
            await supabaseAdmin.from('messages').insert(messageInserts)
            resolvedCount = resolvedIds.length
            alreadyResolvedIds.push(...resolvedIds)
            console.log(`[auto-close] ${resolvedCount}件を自動RESOLVED`)
        }
    }

    // ─────────────────────────────────────────────────────
    // 処理2: MATCHEDのまま最終メッセージから14日無活動 → CLOSED
    // 判定：最後のメッセージ送信日が14日以上前、またはメッセージが0件で
    //       案件のupdated_atが14日以上前
    // ─────────────────────────────────────────────────────
    const { data: matchedCases, error: matchedError } = await supabaseAdmin
        .from('cases')
        .select('id, owner_user_id, updated_at')
        .eq('status', 'MATCHED')
        .is('supporter_resolved_at', null)

    if (matchedError) {
        console.error('[auto-close] matched fetch error:', matchedError)
        return NextResponse.json({ error: matchedError.message }, { status: 500 })
    }

    let closedCount = 0

    if (matchedCases && matchedCases.length > 0) {
        // 処理1で更新済みの案件を除外
        const targetCases = matchedCases.filter(
            (c: { id: string }) => !alreadyResolvedIds.includes(c.id)
        )

        if (targetCases.length > 0) {
            const targetIds = targetCases.map((c: { id: string }) => c.id)

            // 各案件の最終メッセージ日時を取得
            const { data: lastMessages } = await supabaseAdmin
                .from('messages')
                .select('case_id, created_at')
                .in('case_id', targetIds)
                .order('created_at', { ascending: false })

            // case_id → 最終メッセージ日時 のマップを作成
            const lastMessageMap: Record<string, string> = {}
            ;(lastMessages || []).forEach((m: { case_id: string; created_at: string }) => {
                if (!lastMessageMap[m.case_id]) {
                    lastMessageMap[m.case_id] = m.created_at
                }
            })

            // 無活動判定：最終メッセージ or updated_at が14日以上前
            const inactiveCases = targetCases.filter((c: { id: string; updated_at: string }) => {
                const lastActivity = lastMessageMap[c.id] ?? c.updated_at
                return new Date(lastActivity) < deadline
            })

            if (inactiveCases.length > 0) {
                const inactiveIds = inactiveCases.map((c: { id: string }) => c.id)

                const { error: closeError } = await supabaseAdmin
                    .from('cases')
                    .update({ status: 'CLOSED' })
                    .in('id', inactiveIds)

                if (closeError) {
                    console.error('[auto-close] closed update error:', closeError)
                } else {
                    const closeMessages = inactiveCases.map((c: { id: string; owner_user_id: string }) => ({
                        case_id: c.id,
                        sender_user_id: c.owner_user_id,
                        content: '__SYSTEM__最後のメッセージから14日間活動がなかったため、この案件は自動的に終了しました。',
                    }))
                    await supabaseAdmin.from('messages').insert(closeMessages)
                    closedCount = inactiveIds.length
                    console.log(`[auto-close] ${closedCount}件を自動CLOSED`)
                }
            }
        }
    }

    return NextResponse.json({
        message: `自動処理完了: RESOLVED ${resolvedCount}件 / CLOSED ${closedCount}件`,
        resolved: resolvedCount,
        closed: closedCount,
    })
}
