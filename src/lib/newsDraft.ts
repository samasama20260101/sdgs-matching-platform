// お知らせ AI 下書き(サーバー専用)。材料から AI がタイトルと本文を作る(提供元は src/lib/ai/config.ts)。
// 失敗しても投稿には影響しない(下書きが返らないだけ。書き手は手で書ける)。
import 'server-only'

import { generateJson, isAiConfigured } from '@/lib/ai/client'
import { NEWS_TITLE_MAX, NEWS_BODY_MAX, type NewsCategory } from '@/lib/constants/news'
import { buildNewsDraftPrompt, type NewsDraft, type NewsDraftMaterials } from '@/lib/news/draftPrompt'

export type NewsDraftResult =
  | { ok: true; draft: NewsDraft }
  | { ok: false; code: 'NO_API_KEY' | 'EMPTY_MATERIALS' | 'GENERATION_FAILED' }

export async function generateNewsDraft(category: NewsCategory, materials: NewsDraftMaterials, externalUrl?: string): Promise<NewsDraftResult> {
  if (!isAiConfigured('news')) return { ok: false, code: 'NO_API_KEY' }

  const prompt = buildNewsDraftPrompt(category, materials, externalUrl)
  if (!prompt) return { ok: false, code: 'EMPTY_MATERIALS' }

  try {
    // Gemini 2.5 は内部思考にも出力トークンを消費する(参加団体の下書きで実測 3,700 前後)。
    // 出力の上限が小さいと JSON が途中で切れるため余裕を持たせる。
    const result = await generateJson('news', prompt, { temperature: 0.4, maxOutputTokens: 8192 })
    if (!result.ok) return { ok: false, code: 'GENERATION_FAILED' }
    const parsed = result.json as { title?: unknown; body?: unknown }
    if (typeof parsed.title !== 'string' || typeof parsed.body !== 'string') {
      return { ok: false, code: 'GENERATION_FAILED' }
    }
    const title = parsed.title.trim().slice(0, NEWS_TITLE_MAX)
    const body = parsed.body.replace(/\r\n?/g, '\n').trim().slice(0, NEWS_BODY_MAX)
    if (!title || !body) return { ok: false, code: 'GENERATION_FAILED' }
    return { ok: true, draft: { title, body } }
  } catch (error) {
    console.error('[newsDraft] generate error:', error)
    return { ok: false, code: 'GENERATION_FAILED' }
  }
}
