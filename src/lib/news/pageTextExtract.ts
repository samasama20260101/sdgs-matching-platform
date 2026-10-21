// URL から材料を取り込むときの、HTML → 本文テキストの取り出しと、接続先アドレスの判定(純粋関数・テスト用に分離)。

// 内部ネットワーク・ループバック・リンクローカルなど、外部サイトではないアドレスへは接続しない
export function isBlockedAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (ip.includes(':')) {
    if (ip === '::' || ip === '::1') return true
    if (ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) return true // fe80::/10
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true // fc00::/7
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    return mapped ? isBlockedAddress(mapped[1]) : false
  }
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b] = parts
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+|#39);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}

function metaContent(html: string, key: string) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i')
  const tag = html.match(re)?.[0]
  return tag?.match(/content=["']([^"']*)["']/i)?.[1]
}

// ページのタイトルと本文テキストを取り出す。<article> か <main> があればその中だけ、なければ <body> 全体。
// メニュー・ヘッダー・フッター・スクリプトなどは除く。
export function extractPageText(html: string, maxChars: number): { title: string; text: string } {
  const title = decodeEntities(metaContent(html, 'og:title') ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim()
  let scope = html
  const pick = (tag: string) => {
    const m = scope.match(new RegExp(`<${tag}[\\s>][\\s\\S]*<\\/${tag}>`, 'i'))
    return m ? m[0] : null
  }
  scope = pick('article') ?? pick('main') ?? pick('body') ?? html
  const text = decodeEntities(
    scope
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|button|iframe|template)[\s>][\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/blockquote)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .split('\n')
    .map((line) => line.replace(/[ \t 　]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
  return { title, text: text.slice(0, maxChars) }
}
