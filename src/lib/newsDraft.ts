// お知らせ AI 下書き(サーバー専用)。材料から Gemini がタイトルと本文を作る。
// 失敗しても投稿には影響しない(下書きが返らないだけ。書き手は手で書ける)。
import 'server-only'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { NEWS_TITLE_MAX, NEWS_BODY_MAX, type NewsCategory } from '@/lib/constants/news'
import { buildNewsDraftPrompt, type NewsDraft, type NewsDraftMaterials } from '@/lib/news/draftPrompt'

const GEMINI_MODEL = 'gemini-2.5-flash'

export type NewsDraftResult =
  | { ok: true; draft: NewsDraft }
  | { ok: false; code: 'NO_API_KEY' | 'EMPTY_MATERIALS' | 'GENERATION_FAILED' }

export async function generateNewsDraft(category: NewsCategory, materials: NewsDraftMaterials): Promise<NewsDraftResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''
  if (!apiKey) return { ok: false, code: 'NO_API_KEY' }

  const prompt = buildNewsDraftPrompt(category, materials)
  if (!prompt) return { ok: false, code: 'EMPTY_MATERIALS' }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    // gemini-2.5-flash は内部思考にも出力トークンを消費する(参加団体の下書きで実測 3,700 前後)。
    // maxOutputTokens が小さいと JSON が途中で切れるため余裕を持たせる。
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    })
    const result = await model.generateContent(prompt)
    const raw = result.response.text().replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(raw) as { title?: unknown; body?: unknown }
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
