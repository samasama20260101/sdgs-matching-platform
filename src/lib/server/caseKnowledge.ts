import 'server-only'

// 解決した相談の要約を作って残す(運営だけが見る。プライバシーポリシーに書く)。相談文は伏せて囲んでから AI へ。
// 相談者と支え手のやりとり(messages)は読まない・AI に渡さない(利用者どうしの通信。通信の秘密。prompts/caseKnowledge.ts)
import { generateJson } from '@/lib/ai/client'
import { AFTER_RESPONSE_AI_TIMEOUT_MS } from './caseAi'
import { fenceConsultation } from '@/lib/aiSafety'
import { maskPii } from '@/lib/pii'
import { supabaseAdmin } from '@/lib/supabase/server'
import { buildKnowledgePrompt, parseKnowledge } from '@/lib/ai/prompts/caseKnowledge'

export async function summarizeResolvedCase(caseId: string): Promise<void> {
  const { data: existing } = await supabaseAdmin.from('case_summaries').select('case_id').eq('case_id', caseId).maybeSingle()
  if (existing) return
  const { data: c, error: cErr } = await supabaseAdmin.from('cases').select('description_free, intake_qna').eq('id', caseId).single()
  if (cErr) throw cErr
  const intake = (c.intake_qna ?? {}) as { indicator_texts?: string[] }
  const caseText = [(intake.indicator_texts ?? []).join('、'), c.description_free].filter(Boolean).join('\n')
  if (!caseText.trim()) return
  const result = await generateJson('consultation', buildKnowledgePrompt(fenceConsultation(maskPii(caseText))), { temperature: 0.2, timeoutMs: AFTER_RESPONSE_AI_TIMEOUT_MS })
  if (!result.ok) return
  const k = parseKnowledge(result.json)
  if (!k) return
  await supabaseAdmin.from('case_summaries').insert({ case_id: caseId, ...k, source: 'AI', model: `${result.provider}:${result.model}` })
}
