// お知らせ(参加団体)の本文に置く「サイト内の団体ページ」のタイル用データ(サーバー・クライアント共用の部分)。
// 本文の最後に団体ページのアドレスを 1 行で置くと、表示のときにタイルへ置き換わる(DB の列は増やさない)。

export type SupporterTileData = {
  id: string
  name: string
  supporterType: string | null
  createdAt: string
  bio: string | null
  resolvedCount: number
  badgeCount: number
  nationwide: boolean
  areaNames: string[]
}

// 本文に入れる団体ページのアドレス(本番のドメインで固定。表示のときはサイト内のリンクに置き換えるので環境によらない)
export const SUPPORTER_PAGE_ORIGIN = 'https://app.samasama.site'
export const supporterPageUrl = (id: string) => `${SUPPORTER_PAGE_ORIGIN}/supporters/${id}`

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const SUPPORTER_PATH = new RegExp(`^/(?:(?:ja|en|es)/)?supporters/(${UUID})/?$`, 'i')
// このサイトとして扱うホスト(本番・Staging やプレビュー・手元)
const isSiteHost = (host: string) =>
  host === 'app.samasama.site' || host.startsWith('localhost:') || host === 'localhost' || /^sdgs-matching-platform[a-z0-9-]*\.vercel\.app$/.test(host)

// サイト内の団体ページのアドレスなら団体 ID を返す
export function supporterIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!isSiteHost(parsed.host)) return null
    return parsed.pathname.match(SUPPORTER_PATH)?.[1]?.toLowerCase() ?? null
  } catch {
    return null
  }
}

// 団体の種類の名前(お知らせは日本語だけなので日本語で持つ。公開の団体ページの common.supporterType と同じ言葉)
export const SUPPORTER_TYPE_LABEL_JA: Record<string, string> = {
  NPO: 'NPO / 支援団体',
  CORPORATE: '企業',
  GOVERNMENT: '行政・公共機関',
  OTHER: 'その他',
}

// 「2026年5月から参加」。登録して1年たっていなくても「1年目」としない(公開の団体ページと同じ書き方)
export function joinedSinceJa(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', timeZone: 'Asia/Tokyo' }).format(date)}から参加`
}
