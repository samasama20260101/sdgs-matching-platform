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
const SUPPORTER_PATH = new RegExp(`^/(?:(?:ja|en|zh)/)?supporters/(${UUID})/?$`, 'i')
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

export function yearsSince(iso: string) {
  return Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 365)))
}
