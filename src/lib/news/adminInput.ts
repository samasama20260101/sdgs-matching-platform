// 管理 API の入力検証(サーバー専用)。作成・更新で同じ形を使う。
import 'server-only'

import { normalizeHttpUrl } from '@/lib/api/validation'
import {
  isNewsAngle, isNewsCategory, isNewsStatus,
  NEWS_ARTICLE_MAX, NEWS_BODY_MAX, NEWS_CHECKLIST_MAX, NEWS_INTERVIEW_SOURCE_MAX, NEWS_TITLE_MAX,
  type NewsAngle, type NewsCategory, type NewsStatus,
} from '@/lib/constants/news'

export type NewsInput = {
  category: NewsCategory
  title: string
  body: string
  external_url: string | null
  status: NewsStatus
  published_at: string | null
  // note 記事ワークフロー(INTERVIEW 用)。送られてきたときだけ更新する
  interview_source?: string
  note_angle?: NewsAngle | null
  note_article?: string
  note_checklist?: string
}

type ParseResult = { ok: true; data: NewsInput } | { ok: false; error: string }

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

// "YYYY-MM-DD"(フォームの date 入力)は日本時間 0 時、それ以外は ISO として解釈する
function parsePublishedAt(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === undefined || value === '') return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false }
  const source = DATE_ONLY.test(value) ? `${value}T00:00:00+09:00` : value
  const date = new Date(source)
  if (Number.isNaN(date.getTime())) return { ok: false }
  return { ok: true, value: date.toISOString() }
}

export function parseNewsInput(raw: unknown): ParseResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'リクエストの形式が不正です' }
  const input = raw as Record<string, unknown>

  if (!isNewsCategory(input.category)) return { ok: false, error: '種別が不正です' }

  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!title) return { ok: false, error: 'タイトルを入力してください' }
  if (title.length > NEWS_TITLE_MAX) return { ok: false, error: `タイトルは${NEWS_TITLE_MAX}文字以内にしてください` }

  const bodyRaw = typeof input.body === 'string' ? input.body : ''
  const body = bodyRaw.replace(/\r\n?/g, '\n').trim()
  if (body.length > NEWS_BODY_MAX) return { ok: false, error: `本文は${NEWS_BODY_MAX}文字以内にしてください` }

  let externalUrl: string | null = null
  if (typeof input.external_url === 'string' && input.external_url.trim()) {
    externalUrl = normalizeHttpUrl(input.external_url)
    if (!externalUrl) return { ok: false, error: '外部リンクは http(s):// から始まるURLにしてください' }
  }

  if (!body && !externalUrl) return { ok: false, error: '本文か外部リンクのどちらかは必要です' }

  const status: NewsStatus = isNewsStatus(input.status) ? input.status : 'DRAFT'

  const publishedAt = parsePublishedAt(input.published_at)
  if (!publishedAt.ok) return { ok: false, error: '公開日の形式が不正です' }

  const data: NewsInput = {
    category: input.category,
    title,
    body,
    external_url: externalUrl,
    status,
    // 公開時に日付が無ければ今にする(並び順と表示日に使うため必須)
    published_at: publishedAt.value ?? (status === 'PUBLISHED' ? new Date().toISOString() : null),
  }

  // note 記事ワークフローの列は、リクエストに含まれるときだけ検証して更新する
  const longText = (key: 'interview_source' | 'note_article' | 'note_checklist', max: number, label: string) => {
    if (!(key in input)) return null
    const value = typeof input[key] === 'string' ? (input[key] as string).replace(/\r\n?/g, '\n') : ''
    if (value.length > max) return `${label}は${max}文字以内にしてください`
    data[key] = value
    return null
  }
  const longTextError = longText('interview_source', NEWS_INTERVIEW_SOURCE_MAX, '取材メモ')
    ?? longText('note_article', NEWS_ARTICLE_MAX, '記事本文')
    ?? longText('note_checklist', NEWS_CHECKLIST_MAX, '確認リスト')
  if (longTextError) return { ok: false, error: longTextError }
  if ('note_angle' in input) {
    if (input.note_angle === null || input.note_angle === undefined) data.note_angle = null
    else if (isNewsAngle(input.note_angle)) data.note_angle = input.note_angle
    else return { ok: false, error: '切り口の形式が不正です' }
  }

  return { ok: true, data }
}
