import 'server-only'

// 相談の分類(AI、#133)。相談を届けるとき、保存する前に、決まった選択肢から指標を選び、緊急・機微を判定し、題を付ける。
// 相談文は maskPii で伏せ、fenceConsultation で囲んでから渡す(AGENTS.md)。AI は generateJson だけから呼ぶ。
// 大項目は AI が選んだ指標からサーバーが決め、緊急・機微は書いた言葉と年齢を下限にする(src/lib/domain/intake.ts・sensitivity.ts)。
// AI が使えない・時間切れ・壊れた応答のときは ok: false を返し、届ける API は機微として扱う。
// 届けたときに分類できなかった相談は、毎日の処理(reclassifyCase)が分類し直す(上げる方向だけ)
import { generateJson } from '@/lib/ai/client'
import { fenceConsultation } from '@/lib/aiSafety'
import { maskPii } from '@/lib/pii'
import { supabaseAdmin } from '@/lib/supabase/server'
import { caseBodyForAi, optionsFor, raiseWithAi, type SubjectType } from '@/lib/domain/intake'
import { normalizeReasons } from '@/lib/domain/sensitivity'
import { buildClassifyPrompt, parseClassification, type CaseClassification } from '@/lib/ai/prompts/classifyCase'

// 届ける画面で待たせる長さの上限。これを超えたら機微として届ける(相談は失わない)
export const CLASSIFY_TIMEOUT_MS = 15_000
// 応答のあと(after)や毎日の処理で呼ぶ AI の待ち時間。Workers の 30 秒の打ち切りに収まる長さ
export const AFTER_RESPONSE_AI_TIMEOUT_MS = 20_000

export type ClassifyResult =
  | ({ ok: true; provider: string; model: string } & CaseClassification)
  | { ok: false; code: 'NOT_CONFIGURED' | 'REQUEST_FAILED' | 'INVALID_JSON' | 'INVALID_SHAPE' }

export async function classifyConsultation(subject: SubjectType, body: string, timeoutMs = CLASSIFY_TIMEOUT_MS): Promise<ClassifyResult> {
  const options = optionsFor(subject)
  const prompt = buildClassifyPrompt({ subject, fencedText: fenceConsultation(maskPii(body)), options: options.map((o) => ({ id: o.id, text: o.text })) })
  const result = await generateJson('consultation', prompt, { temperature: 0, maxOutputTokens: 4096, timeoutMs })
  if (!result.ok) return { ok: false, code: result.code }
  const parsed = parseClassification(result.json, new Set(options.map((o) => o.id)))
  if (!parsed) {
    console.error('[caseAi] classification had an unexpected shape')
    return { ok: false, code: 'INVALID_SHAPE' }
  }
  return { ok: true, provider: result.provider, model: result.model, ...parsed }
}

// cases.ai_sdg_suggestion に残す分類の記録(運営の画面で見る)。分類できなかった相談は null のまま(毎日の処理が拾う)
export function classificationRecord(c: Extract<ClassifyResult, { ok: true }>, now: Date) {
  return {
    version: 4,
    kind: 'CLASSIFICATION',
    title: c.title,
    indicators: c.indicators.map((i) => i.id),
    urgent: c.urgent,
    sensitive: c.sensitive,
    provider: c.provider,
    model: c.model,
    generated_at: now.toISOString(),
  }
}

// 届けたときに分類できなかった相談を、あとで分類する。分類して書き込めたら true
export async function reclassifyCase(caseId: string): Promise<boolean> {
  const { data: c, error } = await supabaseAdmin
    .from('cases')
    .select('id, subject_type, description_free, intake_qna, ai_sdg_suggestion, urgency, sensitive_reasons')
    .eq('id', caseId)
    .single()
  if (error) throw error
  if (c.ai_sdg_suggestion) return false

  const subject = c.subject_type as SubjectType
  const intake = (c.intake_qna ?? {}) as Record<string, unknown> & { indicators?: string[]; since?: string | null; wish?: string | null }
  const result = await classifyConsultation(subject, caseBodyForAi({ description: c.description_free, since: intake.since, wish: intake.wish }), AFTER_RESPONSE_AI_TIMEOUT_MS)
  if (!result.ok) return false

  const raised = raiseWithAi({
    subject,
    currentIndicatorIds: intake.indicators ?? [],
    urgency: c.urgency as string | null,
    reasons: normalizeReasons(c.sensitive_reasons),
    ai: { indicatorIds: result.indicators.map((i) => i.id), urgent: result.urgent, sensitive: result.sensitive },
  })
  const texts = new Map(optionsFor(subject).map((o) => [o.id, o.text]))
  const filled = (intake.indicators ?? []).length === 0 && raised.indicatorIds.length > 0
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('cases')
    .update({
      ...(result.title ? { title: result.title } : {}),
      urgency: raised.urgency,
      is_sensitive: raised.isSensitive,
      sensitive_reasons: raised.sensitiveReasons,
      ai_sdg_suggestion: classificationRecord(result, new Date()),
      ...(filled ? { intake_qna: { ...intake, indicators: raised.indicatorIds, indicator_texts: raised.indicatorIds.map((id) => texts.get(id) ?? id), indicator_source: 'AI' } } : {}),
    })
    .eq('id', caseId)
    .is('ai_sdg_suggestion', null)
    .select('id')
    .maybeSingle()
  if (updateError) throw updateError
  if (!updated) return false

  const aiIndicators = result.indicators.filter((i) => raised.aiIndicatorIds.includes(i.id))
  if (aiIndicators.length > 0) {
    const { error: ciError } = await supabaseAdmin.from('case_indicators').upsert(
      aiIndicators.map((i) => ({ case_id: caseId, indicator_code: i.id, source: 'AI', status: 'PROPOSED', confidence: i.confidence, reason: i.reason })),
      { onConflict: 'case_id,indicator_code,source', ignoreDuplicates: true },
    )
    if (ciError) console.error('[caseAi] case_indicators:', ciError)
  }
  return true
}
