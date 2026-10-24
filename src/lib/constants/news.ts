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

// 入力上限(設計 §3.3 / §4.4 / §4.5)
export const NEWS_TITLE_MAX = 120
export const NEWS_BODY_MAX = 20000
export const NEWS_MATERIAL_MAX = 8000
// URL のページから読み取った内容(最大 3 ページ分)を AI に渡すときの上限
export const NEWS_PAGE_TEXT_MAX = 18000
export const NEWS_SOURCE_URLS_MAX = 3

// トップページに並べる件数と一覧の上限
export const NEWS_TOP_LIMIT = 3
export const NEWS_LIST_MAX = 50
// お知らせ一覧ページで「次の 50 件を見る」を押して広げられる上限
export const NEWS_LIST_PAGE_CAP = 1000

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

// 管理画面の一覧用(本文を含まない軽い形。本文は編集を開いたときに 1 件だけ読む)
export type NewsPostListItem = NewsPostPublic & {
  status: NewsStatus
  created_at: string
  updated_at: string
}

// 管理画面が扱う形(下書きを含む 1 件。今は公開側の記事と同じ列)
export type NewsPostAdmin = NewsPost
