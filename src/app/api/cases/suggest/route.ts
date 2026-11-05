// 相談を書いたあとに「近いもの」を出す(画面の見直し 所見 5)。POST { subjectType, text } → { ids, source }
// AI は候補を出すだけで、選ぶのは本人(大項目を AI に決めさせない)。相談文は maskPii で伏せ、fenceConsultation で囲んで渡す。
// AI の鍵がないとき・失敗したときは、文字の重なりで並べる(source: 'overlap')。届ける前なので何も保存しない
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { generateJson } from '@/lib/ai/client'
import { fenceConsultation } from '@/lib/aiSafety'
import { maskPii } from '@/lib/pii'
import { DESCRIPTION_MAX, EXTRA_MAX, optionsFor } from '@/lib/domain/intake'
import { buildSuggestPrompt, parseSuggestions, suggestByOverlap } from '@/lib/ai/prompts/suggestIndicators'

const schema = z.object({
  subjectType: z.enum(['PERSON', 'COMPANY', 'COMMUNITY']),
  text: z.string().transform((v) => v.trim()).pipe(z.string().min(1).max(DESCRIPTION_MAX + EXTRA_MAX * 2)),
})

// 1人あたりの回数の上限(このインスタンスの中だけの、ゆるい上限。AI の費用を抑えるため)
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 20
const recent = new Map<string, number[]>()

function allow(userId: string, now: number): boolean {
  const list = (recent.get(userId) ?? []).filter((t) => now - t < WINDOW_MS)
  if (list.length >= MAX_PER_WINDOW) {
    recent.set(userId, list)
    return false
  }
  list.push(now)
  recent.set(userId, list)
  return true
}

export async function POST(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const { subjectType, text } = parsed.data
  const options = optionsFor(subjectType).map((o) => ({ id: o.id, text: o.text }))

  if (allow(auth.appUser.id, Date.now())) {
    const result = await generateJson('consultation', buildSuggestPrompt({ fencedText: fenceConsultation(maskPii(text)), options }), { temperature: 0, maxOutputTokens: 4096, timeoutMs: 8_000 })
    if (result.ok) {
      const ids = parseSuggestions(result.json, new Set(options.map((o) => o.id)))
      return NextResponse.json({ ids, source: 'ai' })
    }
  }
  return NextResponse.json({ ids: suggestByOverlap(text, options), source: 'overlap' })
}
