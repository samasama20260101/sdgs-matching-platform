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

// 入力上限(設計 §3.3 / §4.4)
export const NEWS_TITLE_MAX = 120
export const NEWS_BODY_MAX = 20000
export const NEWS_MATERIAL_MAX = 8000

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

// 記事ページ・管理画面が扱う形
export type NewsPost = NewsPostPublic & {
  body: string
  status: NewsStatus
  created_at: string
  updated_at: string
}
