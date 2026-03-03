// src/app/api/cron/auto-close-cases/route.ts
// Vercel Cron: サポーター解決報告から14日後に自動でRESOLVEDにする
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

    // supporter_resolved_atが14日以上前かつIN_PROGRESSのケースを取得
    const { data: cases, error: fetchError } = await supabaseAdmin
        .from('cases')
        .select('id, owner_user_id, supporter_resolved_at')
        .eq('status', 'IN_PROGRESS')
        .not('supporter_resolved_at', 'is', null)
        .lt('supporter_resolved_at', deadline.toISOString())

    if (fetchError) {
        console.error('[auto-close] fetch error:', fetchError)
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!cases || cases.length === 0) {
        return NextResponse.json({ message: '対象ケースなし', closed: 0 })
    }

    // 対象ケースをRESOLVEDに更新
    const caseIds = cases.map((c: { id: string }) => c.id)

    const { error: updateError } = await supabaseAdmin
        .from('cases')
        .update({
            status: 'RESOLVED',
            resolved_at: now.toISOString(),
        })
        .in('id', caseIds)

    if (updateError) {
        console.error('[auto-close] update error:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 各ケースのオーナーIDを取得してシステムメッセージを投稿
    // sender_user_idにはケースオーナー自身のIDを使用（システムメッセージとして扱われる）
    const messageInserts = cases.map((c: { id: string; owner_user_id: string }) => ({
        case_id: c.id,
        sender_user_id: c.owner_user_id,
        content: '__SYSTEM__サポーターの解決報告から14日が経過したため、自動的に解決済みとなりました。',
    }))

    await supabaseAdmin.from('messages').insert(messageInserts)

    console.log(`[auto-close] ${caseIds.length}件を自動クローズしました`)

    return NextResponse.json({
        message: `${caseIds.length}件を自動で解決済みにしました`,
        closed: caseIds.length,
        caseIds,
    })
}
