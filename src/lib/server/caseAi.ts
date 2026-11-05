import 'server-only'

// 相談の整理(AI)。届いた相談に、支え手が読みやすい題と要約を付け、指標の候補と機微の判定(上げる方向だけ)を足す。
// 相談文は maskPii で伏せ、fenceConsultation で囲んでから渡す。大項目・緊急度は AI に決めさせない(AGENTS.md)
import { generateJson } from '@/lib/ai/client'
import { fenceConsultation } from '@/lib/aiSafety'
import { maskPii } from '@/lib/pii'
import { supabaseAdmin } from '@/lib/supabase/server'
import { optionsFor, type SubjectType } from '@/lib/domain/intake'
import { applyAiSensitivity, type SensitiveReason } from '@/lib/domain/sensitivity'
import { buildCaseSummaryPrompt, parseCaseSummary } from '@/lib/ai/prompts/caseSummary'

export async function summarizeNewCase(caseId: string): Promise<void> {
  const { data: c, error } = await supabaseAdmin
    .from('cases')
    .select('id, subject_type, description_free, intake_qna, ai_sdg_suggestion, is_sensitive, sensitive_reasons')
    .eq('id', caseId)
    .single()
  if (error) throw error
  if (c.ai_sdg_suggestion) return

  const subject = c.subject_type as SubjectType
  const intake = (c.intake_qna ?? {}) as { indicator_texts?: string[]; indicators?: string[]; since?: string | null; wish?: string | null }
  const body = [c.description_free, intake.since ? `いつから: ${intake.since}` : '', intake.wish ? `どうしたいか: ${intake.wish}` : ''].filter(Boolean).join('\n')
  const options = optionsFor(subject)
  const prompt = buildCaseSummaryPrompt({
    selected: intake.indicator_texts ?? [],
    fencedText: fenceConsultation(maskPii(body)),
    candidates: options.filter((o) => !(intake.indicators ?? []).includes(o.id)).map((o) => ({ id: o.id, text: o.text })),
  })
  const result = await generateJson('consultation', prompt, { temperature: 0.1, maxOutputTokens: 8192 })
  if (!result.ok) return
  const parsed = parseCaseSummary(result.json, new Set(options.map((o) => o.id)))
  if (!parsed) return

  const current = { isSensitive: Boolean(c.is_sensitive), reasons: (c.sensitive_reasons ?? []) as SensitiveReason[] }
  const next = applyAiSensitivity(current, parsed.sensitive, current.reasons.includes('ADMIN'))

  const { error: updateError } = await supabaseAdmin
    .from('cases')
    .update({
      title: parsed.title,
      ai_sdg_suggestion: { version: 3, title: parsed.title, summary: parsed.summary, provider: result.provider, model: result.model, generated_at: new Date().toISOString() },
      is_sensitive: next.isSensitive,
      sensitive_reasons: next.reasons,
    })
    .eq('id', caseId)
    .is('ai_sdg_suggestion', null)
  if (updateError) throw updateError

  if (parsed.candidates.length > 0) {
    await supabaseAdmin.from('case_indicators').upsert(
      parsed.candidates.map((cand) => ({ case_id: caseId, indicator_code: cand.id, source: 'AI', status: 'PROPOSED', confidence: cand.confidence, reason: cand.reason })),
      { onConflict: 'case_id,indicator_code,source', ignoreDuplicates: true },
    )
  }
}
