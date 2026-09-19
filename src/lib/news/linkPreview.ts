// リンク先の OGP(タイトル・説明・画像)を取得する(サーバー専用)。
// お知らせ本文に URL を1行だけで置いたときと、外部リンクボタンの上にカードとして出す。
// 取れなくても記事は落とさない(ドメインだけのカードにフォールバック)。
import 'server-only'

export type LinkPreview = {
  url: string
  hostname: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
}

const MAX_BYTES = 512 * 1024          // 先頭 512KB だけ見る(meta は head にある)
const MAX_CONTENT_LENGTH = 5 * 1024 * 1024
const TIMEOUT_MS = 4000
const REVALIDATE_SECONDS = 60 * 60 * 24
// 内部ネットワークへ向けた取得は拒否(URL は管理者入力だが念のため)
const BLOCKED_HOST = /^(localhost|127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]|::1$)/i

function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function clean(value: string | null | undefined) {
  if (!value) return null
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, 300) : null
}

// <meta property="og:title" content="..."> と、content が先に来る書き方の両方を拾う
function metaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*?content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${escaped}["']`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return clean(match[1])
  }
  return null
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function emptyPreview(url: string): LinkPreview {
  return { url, hostname: safeHostname(url), title: null, description: null, image: null, siteName: null }
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const fallback = emptyPreview(url)
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return fallback
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fallback
  if (BLOCKED_HOST.test(parsed.hostname)) return fallback

  try {
    // 遅いサイトで記事の描画を止めない。タイムアウト時はドメインだけのカードにする
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS))
    const response = await Promise.race([
      fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; samasama-link-preview/1.0; +https://app.samasama.site)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
        next: { revalidate: REVALIDATE_SECONDS },
      }),
      timeout,
    ])
    if (!response || !response.ok) return fallback
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('html')) return fallback
    const contentLength = Number(response.headers.get('content-length') ?? 0)
    if (contentLength > MAX_CONTENT_LENGTH) return fallback

    const buffer = await response.arrayBuffer()
    const html = new TextDecoder('utf-8').decode(buffer.slice(0, MAX_BYTES))
    const finalUrl = response.url || url

    const title = metaContent(html, 'og:title')
      ?? metaContent(html, 'twitter:title')
      ?? clean(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1])
    const description = metaContent(html, 'og:description')
      ?? metaContent(html, 'twitter:description')
      ?? metaContent(html, 'description')
    const rawImage = metaContent(html, 'og:image')
      ?? metaContent(html, 'og:image:url')
      ?? metaContent(html, 'twitter:image')
    let image: string | null = null
    if (rawImage) {
      try {
        const resolved = new URL(rawImage, finalUrl)
        if (resolved.protocol === 'https:' || resolved.protocol === 'http:') image = resolved.toString()
      } catch {
        image = null
      }
    }
    return {
      url,
      hostname: safeHostname(finalUrl),
      title,
      description,
      image,
      siteName: metaContent(html, 'og:site_name'),
    }
  } catch (error) {
    console.error('[linkPreview] fetch error:', url, error instanceof Error ? error.message : error)
    return fallback
  }
}
