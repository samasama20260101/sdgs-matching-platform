// note 記事ワークフロー(サーバー専用)。切り口3案 → 本文 → 見直し(確認リスト)を Gemini で行う。
// 失敗しても投稿には影響しない(結果が返らないだけ。書き手は手で書ける)。
import 'server-only'

import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  NEWS_TITLE_MAX, NEWS_BODY_MAX, NEWS_ARTICLE_MAX, NEWS_CHECKLIST_MAX, isNewsAngle, type NewsAngle,
} from '@/lib/constants/news'
import { buildAnglesPrompt, buildWritePrompt, buildReviewPrompt, formatChecklist } from '@/lib/news/articlePrompt'

// gemini-2.5-pro はこの API キーでは 404(2026-09-19 実測)。全工程 flash で行う
const GEMINI_MODEL = 'gemini-2.5-flash'

export type ArticleFailure = { ok: false; code: 'NO_API_KEY' | 'EMPTY_INPUT' | 'GENERATION_FAILED' }
export type AnglesResult = { ok: true; angles: NewsAngle[] } | ArticleFailure
export type WriteResult = { ok: true; title: string; lead: string; article: string } | ArticleFailure
export type ReviewResult = { ok: true; checklist: string } | ArticleFailure

function apiKey() {
  return process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''
}

// JSON 出力を1回生成して parse する。失敗は null(呼び出し側で GENERATION_FAILED)
async function generateJson(prompt: string, maxOutputTokens: number, temperature: number): Promise<unknown | null> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey())
    // 思考トークンが maxOutputTokens を内側から消費する(本文 1 本で 2,000〜4,000)。余裕を持たせる
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { temperature, maxOutputTokens, responseMimeType: 'application/json' },
    })
    const result = await model.generateContent(prompt)
    const raw = result.response.text().replace(/```json|```/g, '').trim()
    return JSON.parse(raw)
  } catch (error) {
    console.error('[newsArticle] generate error:', error)
    return null
  }
}

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim().slice(0, max) : ''
}

export async function proposeArticleAngles(source: string): Promise<AnglesResult> {
  if (!apiKey()) return { ok: false, code: 'NO_API_KEY' }
  const prompt = buildAnglesPrompt(source)
  if (!prompt) return { ok: false, code: 'EMPTY_INPUT' }
  const parsed = (await generateJson(prompt, 8192, 0.7)) as { angles?: unknown } | null
  if (!parsed || !Array.isArray(parsed.angles)) return { ok: false, code: 'GENERATION_FAILED' }
  const angles = parsed.angles
    .map((angle) => (isNewsAngle(angle)
      ? { title: text(angle.title, 200), audience: text(angle.audience, 500), hook: text(angle.hook, 500), why: text(angle.why, 500) }
      : null))
    .filter((angle): angle is NewsAngle => angle !== null && angle.title.length > 0)
    .slice(0, 3)
  if (angles.length === 0) return { ok: false, code: 'GENERATION_FAILED' }
  return { ok: true, angles }
}

export async function writeNoteArticle(source: string, angle: NewsAngle): Promise<WriteResult> {
  if (!apiKey()) return { ok: false, code: 'NO_API_KEY' }
  const prompt = buildWritePrompt(source, angle)
  if (!prompt) return { ok: false, code: 'EMPTY_INPUT' }
  const parsed = (await generateJson(prompt, 16384, 0.6)) as { title?: unknown; lead?: unknown; article?: unknown } | null
  if (!parsed) return { ok: false, code: 'GENERATION_FAILED' }
  const title = text(parsed.title, NEWS_TITLE_MAX)
  const lead = text(parsed.lead, NEWS_BODY_MAX)
  const article = text(parsed.article, NEWS_ARTICLE_MAX)
  if (!title || !article) return { ok: false, code: 'GENERATION_FAILED' }
  return { ok: true, title, lead, article }
}

export async function reviewNoteArticle(source: string, article: string): Promise<ReviewResult> {
  if (!apiKey()) return { ok: false, code: 'NO_API_KEY' }
  const prompt = buildReviewPrompt(source, article)
  if (!prompt) return { ok: false, code: 'EMPTY_INPUT' }
  const parsed = (await generateJson(prompt, 8192, 0.2)) as { summary?: unknown; items?: unknown } | null
  if (!parsed || !Array.isArray(parsed.items)) return { ok: false, code: 'GENERATION_FAILED' }
  const items = parsed.items
    .map((item) => {
      const row = item as { kind?: unknown; text?: unknown }
      return { kind: text(row?.kind, 20) || 'fix', text: text(row?.text, 1000) }
    })
    .filter((item) => item.text.length > 0)
    .slice(0, 20)
  const checklist = formatChecklist(text(parsed.summary, 1000), items).slice(0, NEWS_CHECKLIST_MAX)
  return { ok: true, checklist }
}
