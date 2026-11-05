// 相談の「近いもの」(本番の相談を書く画面と、体験ページで共用)。AI は候補を出すだけで、選ぶのは本人。
// 相談文は maskPii で伏せ、fenceConsultation で囲んで渡す。AI を使わないとき・失敗したときは文字の重なりで並べる。何も保存しない
import 'server-only'
import { generateJson } from '@/lib/ai/client'
import { fenceConsultation } from '@/lib/aiSafety'
import { maskPii } from '@/lib/pii'
import { optionsFor, type SubjectType } from '@/lib/domain/intake'
import { buildSuggestPrompt, parseSuggestions, suggestByOverlap } from '@/lib/ai/prompts/suggestIndicators'

export type Suggestion = { ids: string[]; source: 'ai' | 'overlap' }

export async function suggestIndicators(subjectType: SubjectType, text: string, useAi: boolean): Promise<Suggestion> {
  const options = optionsFor(subjectType).map((o) => ({ id: o.id, text: o.text }))
  if (useAi) {
    const result = await generateJson('consultation', buildSuggestPrompt({ fencedText: fenceConsultation(maskPii(text)), options }), { temperature: 0, maxOutputTokens: 4096, timeoutMs: 8_000 })
    if (result.ok) return { ids: parseSuggestions(result.json, new Set(options.map((o) => o.id))), source: 'ai' }
  }
  return { ids: suggestByOverlap(text, options), source: 'overlap' }
}
