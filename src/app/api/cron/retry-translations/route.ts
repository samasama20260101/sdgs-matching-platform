// src/app/api/cron/retry-translations/route.ts
// Vercel Cron（15分間隔）: 送信時翻訳の失敗分を回収する（設計§5.8）
// - messages: translation_status = 'PENDING' を古い順に最大20件処理
//   成功 → DONE / 失敗 → translation_attempts をインクリメント（5回で FAILED 確定）
// - cases: locale ≠ ja かつ description_free_ja 未生成の案件も同じジョブで回収
import { supabaseAdmin } from '@/lib/supabase/server'
import { translateText, translationTarget } from '@/lib/i18n/translate'
import { NextResponse } from 'next/server'

// 直列だと最大40回のGemini呼び出しがデフォルトタイムアウトに収まらないため、
// 実行上限を明示し、少数並列でバッチを消化する（行単位更新なので途中終了でも整合は保たれる）
export const maxDuration = 300

const BATCH_SIZE = 20
const MAX_ATTEMPTS = 5
const CONCURRENCY = 4

async function inChunks<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
    for (let i = 0; i < items.length; i += size) {
        await Promise.all(items.slice(i, i + size).map(fn))
    }
}

export async function GET(request: Request) {
    // Vercel Cronからのリクエストのみ許可
    const authHeader = request.headers.get('Authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let messagesDone = 0
    let messagesFailed = 0
    let casesDone = 0

    // ── 1. PENDING メッセージの回収 ──────────────────────────
    const { data: pending, error: pendingError } = await supabaseAdmin
        .from('messages')
        .select('id, case_id, content, source_locale, translation_attempts')
        .eq('translation_status', 'PENDING')
        .order('created_at', { ascending: true })
        .limit(BATCH_SIZE)

    if (pendingError) {
        console.error('[retry-translations] pending fetch error:', pendingError)
        return NextResponse.json({ error: pendingError.message }, { status: 500 })
    }

    if (pending && pending.length > 0) {
        // 案件の言語をまとめて取得（翻訳先の再計算用）
        const caseIds = [...new Set(pending.map(m => m.case_id))]
        const { data: caseRows } = await supabaseAdmin
            .from('cases').select('id, locale').in('id', caseIds)
        const caseLocaleMap = new Map((caseRows || []).map(c => [c.id, c.locale as string]))

        await inChunks(pending, CONCURRENCY, async (msg) => {
            const caseLocale = caseLocaleMap.get(msg.case_id) || 'ja'
            // 送信者がSOS（source=案件言語）なら ja へ、サポーター（source=ja）なら案件言語へ
            const target = translationTarget(caseLocale, msg.source_locale !== 'ja')
            if (!target) {
                // 案件がja等で翻訳不要になっていた場合はNONEへ戻す
                await supabaseAdmin.from('messages')
                    .update({ translation_status: 'NONE' }).eq('id', msg.id)
                return
            }

            const translated = await translateText(msg.content, target)
            if (translated) {
                await supabaseAdmin.from('messages')
                    .update({ translated_content: translated, translation_status: 'DONE' })
                    .eq('id', msg.id)
                messagesDone++
            } else {
                const attempts = (msg.translation_attempts ?? 0) + 1
                await supabaseAdmin.from('messages')
                    .update({
                        translation_attempts: attempts,
                        translation_status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
                    })
                    .eq('id', msg.id)
                messagesFailed++
            }
        })
    }

    // ── 2. description_free_ja 未生成の外国語案件の回収 ─────────
    const { data: casesToFill, error: casesError } = await supabaseAdmin
        .from('cases')
        .select('id, description_free, locale')
        .neq('locale', 'ja')
        .is('description_free_ja', null)
        .order('created_at', { ascending: true })
        .limit(BATCH_SIZE)

    if (casesError) {
        console.error('[retry-translations] cases fetch error:', casesError)
    } else if (casesToFill && casesToFill.length > 0) {
        await inChunks(casesToFill, CONCURRENCY, async (c) => {
            if (!c.description_free) return
            const translated = await translateText(c.description_free, 'ja')
            if (translated) {
                await supabaseAdmin.from('cases')
                    .update({ description_free_ja: translated }).eq('id', c.id)
                casesDone++
            }
        })
    }

    console.log(`[retry-translations] messages: ${messagesDone} done / ${messagesFailed} retried, cases: ${casesDone} filled`)
    return NextResponse.json({ ok: true, messagesDone, messagesFailed, casesDone })
}
