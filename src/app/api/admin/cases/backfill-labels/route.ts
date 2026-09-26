// src/app/api/admin/cases/backfill-labels/route.ts
// 既存案件へのお困りごとラベル遡り付与(仕様_お困りごとラベル §8)。
// 新フォーム以前の案件(intake_qna.concerns 無し)は本人ラベルを持たないため、
// AI で labels_ai だけを付けてフィルターに乗せる。要約・SDGs は上書きしない(JSON マージ)。
//
// 対象: OPEN / MATCHED・公開中(LISTED) かつ concerns 無し かつ labels_ai 未付与。解決済み・取消・終了は一覧に出ないので対象外。
// 本番での実行はユーザーの明示許可のうえ、ユーザー自身が行う(AGENTS.md の原則)。
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { classifyConcernLabels } from '@/lib/gemini'
import { getCaseConcerns } from '@/lib/constants/concerns'
import { buildCaseAnalysisText } from '@/lib/api/caseText'

// Gemini を件数分だけ順に呼ぶ(1件 2〜6 秒)ので、関数の実行時間上限を延ばし、1回の件数も小さく刻む
export const maxDuration = 300

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 30

type TargetCase = {
    id: string
    display_id: string | null
    title: string | null
    description_free: string | null
    intake_qna: unknown
    ai_sdg_suggestion: Record<string, unknown> | null
}

function hasAiLabels(suggestion: Record<string, unknown> | null) {
    return Array.isArray(suggestion?.labels_ai)
}

export async function POST(request: Request) {
    const auth = await requireActiveAppUser(request, { roles: ['ADMIN'] })
    if ('response' in auth) return auth.response

    let body: { limit?: unknown; dryRun?: unknown } = {}
    try {
        body = await request.json()
    } catch {
        // body なしは既定値で動かす
    }
    const limitRaw = Number(body.limit)
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : DEFAULT_LIMIT
    const dryRun = body.dryRun === true

    const { data: rows, error } = await supabaseAdmin
        .from('cases')
        .select('id, display_id, title, description_free, intake_qna, ai_sdg_suggestion')
        .in('status', ['OPEN', 'MATCHED'])
        .eq('visibility', 'LISTED') // 未分析(非公開)の案件は analyze が後で付けるので対象外
        .order('created_at', { ascending: true })
    if (error) {
        console.error('[admin/backfill-labels] fetch error:', error)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }

    // 対象の絞り込みはアプリ側で行う(JSON 列の条件は PostgREST で書きにくく、件数も少ない)
    const targets = ((rows ?? []) as TargetCase[]).filter((c) => {
        const intake = c.intake_qna as { disaster?: unknown } | null
        if (intake?.disaster) return false                 // 災害SOSは別語彙
        if (getCaseConcerns(c.intake_qna)) return false    // 新フォーム: 本人ラベルあり
        if (hasAiLabels(c.ai_sdg_suggestion)) return false // 付与済み(冪等)
        return true
    })

    const batch = targets.slice(0, limit)
    if (dryRun) {
        return NextResponse.json({
            dryRun: true,
            remaining: targets.length,
            batch: batch.map((c) => ({ id: c.id, display_id: c.display_id, title: c.title })),
        })
    }

    const results: Array<{ id: string; display_id: string | null; labels_ai?: string[]; error?: string }> = []
    let updated = 0
    let failed = 0
    for (const c of batch) {
        // analyze と同じ入力(Q1〜Q5 の回答 + 自由記述)を渡す。旧フォームは選択肢がいちばん確かな手がかり
        const labels = await classifyConcernLabels(buildCaseAnalysisText(c))
        if (labels === null) {
            failed += 1
            results.push({ id: c.id, display_id: c.display_id, error: 'AI分類に失敗' })
            continue
        }

        // Gemini 呼び出し中に他の更新が入っている可能性があるため、保存直前に最新を読み直してマージする
        const { data: fresh, error: freshError } = await supabaseAdmin
            .from('cases')
            .select('ai_sdg_suggestion')
            .eq('id', c.id)
            .maybeSingle()
        if (freshError || !fresh) {
            failed += 1
            results.push({ id: c.id, display_id: c.display_id, error: '再取得に失敗' })
            continue
        }
        const current = (fresh.ai_sdg_suggestion && typeof fresh.ai_sdg_suggestion === 'object')
            ? fresh.ai_sdg_suggestion as Record<string, unknown>
            : {}
        const next = {
            ...current,
            labels_ai: labels,
            labels_ai_backfilled_at: new Date().toISOString(),
        }
        const { error: updateError } = await supabaseAdmin
            .from('cases')
            .update({ ai_sdg_suggestion: next })
            .eq('id', c.id)
        if (updateError) {
            console.error('[admin/backfill-labels] update error:', updateError)
            failed += 1
            results.push({ id: c.id, display_id: c.display_id, error: '保存に失敗' })
            continue
        }
        updated += 1
        results.push({ id: c.id, display_id: c.display_id, labels_ai: labels })
    }

    return NextResponse.json({
        processed: batch.length,
        updated,
        failed,
        remaining: targets.length - batch.length,
        results,
    })
}
