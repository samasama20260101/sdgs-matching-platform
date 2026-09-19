// トップページお知らせ欄の定数(設計: docs/news_section_design.md)。
// 種別は4つ固定。DB(news_posts.category)には英字コードだけを入れ、表示名はここと i18n(landing.news.category)で持つ。

export const NEWS_CATEGORIES = ['NOTICE', 'MAINTENANCE', 'SUPPORTER_JOINED', 'INTERVIEW'] as const
export type NewsCategory = (typeof NEWS_CATEGORIES)[number]

export const NEWS_STATUSES = ['DRAFT', 'PUBLISHED'] as const
export type NewsStatus = (typeof NEWS_STATUSES)[number]

export type NewsCategoryMeta = {
  labelJa: string   // 管理画面用(日本語固定)
  chipClass: string // 公開側の種別チップ(Tailwind)
}

export const NEWS_CATEGORY_META: Record<NewsCategory, NewsCategoryMeta> = {
  NOTICE:           { labelJa: 'お知らせ',     chipClass: 'bg-teal-50 text-teal-700 border-teal-100' },
  MAINTENANCE:      { labelJa: 'メンテナンス', chipClass: 'bg-amber-50 text-amber-700 border-amber-100' },
  SUPPORTER_JOINED: { labelJa: '参加団体',     chipClass: 'bg-blue-50 text-blue-700 border-blue-100' },
  INTERVIEW:        { labelJa: 'インタビュー', chipClass: 'bg-rose-50 text-rose-700 border-rose-100' },
}

export function isNewsCategory(value: unknown): value is NewsCategory {
  return typeof value === 'string' && (NEWS_CATEGORIES as readonly string[]).includes(value)
}

export function isNewsStatus(value: unknown): value is NewsStatus {
  return typeof value === 'string' && (NEWS_STATUSES as readonly string[]).includes(value)
}

// note 記事ワークフロー(設計 §4.5)の有効化フラグ。
// 2026-09-19 に実装したが、gemini-2.5-pro がこの API キーで使えないため当面 false(ユーザー判断)。
// true にするときは migrations/add_news_note_article_columns.sql を先に適用する(4列が要る)。
export const NOTE_ARTICLE_WORKFLOW_ENABLED = false

// 入力上限(設計 §3.3 / §4.4 / §4.5)
export const NEWS_TITLE_MAX = 120
export const NEWS_BODY_MAX = 20000
export const NEWS_MATERIAL_MAX = 8000
export const NEWS_INTERVIEW_SOURCE_MAX = 40000  // 取材メモ・書き起こし(1時間の逐語で 2 万字前後)
export const NEWS_ARTICLE_MAX = 30000           // note 記事本文
export const NEWS_CHECKLIST_MAX = 10000         // 確認リスト

// トップページに並べる件数と一覧の上限
export const NEWS_TOP_LIMIT = 3
export const NEWS_LIST_MAX = 50

// 公開APIが返す形(公開してよい列だけ。本文は記事ページがサーバーで直接読む)
export type NewsPostPublic = {
  id: string
  category: NewsCategory
  title: string
  external_url: string | null
  published_at: string
}

// 記事ページが扱う形
export type NewsPost = NewsPostPublic & {
  body: string
  status: NewsStatus
  created_at: string
  updated_at: string
}

// note 記事の切り口(INTERVIEW 用。AI が3案出し、書き手が1つ選ぶ)
export type NewsAngle = {
  title: string    // タイトル案
  audience: string // 誰に何を伝える記事か
  hook: string     // 冒頭の一文
  why: string      // なぜこの切り口が材料に合うか
}

// 管理画面が扱う形(note 記事ワークフローの列を含む)
// 4列は NOTE_ARTICLE_WORKFLOW_ENABLED が true のときだけ API が返す
export type NewsPostAdmin = NewsPost & {
  interview_source?: string
  note_angle?: NewsAngle | null
  note_article?: string
  note_checklist?: string
}

export function isNewsAngle(value: unknown): value is NewsAngle {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return ['title', 'audience', 'hook', 'why'].every((k) => typeof v[k] === 'string' && (v[k] as string).length <= 1000)
}
