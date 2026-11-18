// 相談の下書き(純粋関数)。ログインしていない人が書いた相談を、ログインして戻ってくるまで端末に預ける。
//   - 相談は先に書き、届けるときにログインする(2026-11-17 岡本さん)。ログインの往復(Google・/start)で書いた内容を失わない
//   - 置き場所は画面側で sessionStorage にする(サーバーに送らない・タブを閉じると消える)。届けたら消す
//   - 読むときは形を確かめ、主体が違う・古い・壊れた下書きは捨てる
//   - 困りごとを選ぶ段はなくなった(#133)。前の形の下書き(選んだもの・近いものを持つ)も、書いた言葉だけを読む
import { DESCRIPTION_MAX, EXTRA_MAX, type SubjectType } from './intake'

export const DRAFT_STORAGE_KEY = 'samasama.consultDraft'
// ログインの往復に足りる長さ。これより古い下書きは捨てる
export const DRAFT_TTL_MS = 6 * 60 * 60 * 1000

export type ConsultDraft = {
  subject: SubjectType
  words: string
  since: string
  wish: string
}

type StoredDraft = ConsultDraft & { v: 1; savedAt: number }

export function serializeDraft(draft: ConsultDraft, now: number): string {
  const stored: StoredDraft = { v: 1, savedAt: now, ...draft }
  return JSON.stringify(stored)
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.length > max) return null
  return value
}

export function parseDraft(raw: string | null | undefined, subject: SubjectType, now: number): ConsultDraft | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null
  const d = value as Record<string, unknown>
  if (d.v !== 1 || d.subject !== subject) return null
  if (typeof d.savedAt !== 'number' || !Number.isFinite(d.savedAt)) return null
  // 古いもの・時計がずれて未来になっているものは捨てる
  if (now - d.savedAt > DRAFT_TTL_MS || d.savedAt - now > 60 * 1000) return null
  const words = text(d.words, DESCRIPTION_MAX)
  const since = text(d.since, EXTRA_MAX)
  const wish = text(d.wish, EXTRA_MAX)
  if (words === null || since === null || wish === null || words.trim().length === 0) return null
  return { subject, words, since, wish }
}
