import 'server-only'

// 解決した相談の要約を作って残す(運営だけが見る。プライバシーポリシーに書く)。相談文とやりとりは伏せて囲んでから AI へ
import { generateJson } from '@/lib/ai/client'
import { fenceConsultation } from '@/lib/aiSafety'
import { maskPii } from '@/lib/pii'
import { supabaseAdmin } from '@/lib/supabase/server'
import { buildKnowledgePrompt, parseKnowledge } from '@/lib/ai/prompts/caseKnowledge'

const THREAD_CHARS = 6000

export async function summarizeResolvedCase(caseId: string): Promise<void> {
  const { data: existing } = await supabaseAdmin.from('case_summaries').select('case_id').eq('case_id', caseId).maybeSingle()
  if (existing) return
  const [{ data: c, error: cErr }, { data: messages, error: mErr }] = await Promise.all([
    supabaseAdmin.from('cases').select('description_free, intake_qna').eq('id', caseId).single(),
    supabaseAdmin.from('messages').select('content, sender_organization_id').eq('case_id', caseId).eq('message_type', 'USER').order('created_at', { ascending: true }).limit(200),
  ])
  if (cErr) throw cErr
  if (mErr) throw mErr
  const intake = (c.intake_qna ?? {}) as { indicator_texts?: string[] }
  const caseText = [(intake.indicator_texts ?? []).join('、'), c.description_free].filter(Boolean).join('\n')
  const thread = (messages ?? [])
    .map((m) => `${m.sender_organization_id ? '支え手' : '相談した人'}: ${m.content}`)
    .join('\n')
    .slice(-THREAD_CHARS)
  const result = await generateJson('consultation', buildKnowledgePrompt(fenceConsultation(maskPii(caseText)), fenceConsultation(maskPii(thread))), { temperature: 0.2 })
  if (!result.ok) return
  const k = parseKnowledge(result.json)
  if (!k) return
  await supabaseAdmin.from('case_summaries').insert({ case_id: caseId, ...k, source: 'AI', model: `${result.provider}:${result.model}` })
}
