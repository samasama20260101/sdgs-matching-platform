// 参加団体・インタビューの AI 下書き用に、URL のページから本文テキストを読み取る(サーバー専用・管理者だけが使う)。
// サーバーから外部へ接続するので、内部ネットワークへ向けた悪用(SSRF)を防ぐ:
//   - http(s) だけ / 名前解決したすべてのアドレスを確かめる / 転送(リダイレクト)は自分で追い、転送先も毎回確かめる
//   - 時間・大きさ・種類(HTML だけ)を制限する
import 'server-only'

import { lookup } from 'node:dns/promises'
import { extractPageText, isBlockedAddress } from '@/lib/news/pageTextExtract'

const TIMEOUT_MS = 10_000
const MAX_BYTES = 2 * 1024 * 1024
const MAX_REDIRECTS = 3
export const PAGE_TEXT_MAX = 6000 // 1 ページあたり AI に渡す文字数の上限

export type PageTextResult =
  | { ok: true; url: string; title: string; text: string }
  | { ok: false; url: string; reason: string }

async function assertPublicHost(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('http(s) の URL だけ読み取れます')
  if (url.username || url.password) throw new Error('この URL は読み取れません')
  let addresses: { address: string }[]
  try {
    addresses = await lookup(url.hostname, { all: true })
  } catch {
    throw new Error('サイトが見つかりませんでした(URL を確かめてください)')
  }
  if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) throw new Error('この URL は読み取れません')
}

export async function fetchPageText(rawUrl: string): Promise<PageTextResult> {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    return { ok: false, url: rawUrl, reason: 'URL の形が正しくありません' }
  }
  try {
    let response: Response | null = null
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicHost(url)
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; samasama-news-draft/1.0; +https://app.samasama.site)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ja,en;q=0.5',
        },
      })
      const location = response.headers.get('location')
      if (response.status >= 300 && response.status < 400 && location) {
        url = new URL(location, url)
        continue
      }
      break
    }
    if (!response || (response.status >= 300 && response.status < 400)) return { ok: false, url: rawUrl, reason: '転送が多すぎて読み取れませんでした' }
    if (!response.ok) return { ok: false, url: rawUrl, reason: `ページを開けませんでした(${response.status})` }
    const type = response.headers.get('content-type') ?? ''
    if (!/text\/html|application\/xhtml/i.test(type)) return { ok: false, url: rawUrl, reason: 'HTML のページではありません' }
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > MAX_BYTES) return { ok: false, url: rawUrl, reason: 'ページが大きすぎます' }
    const { title, text } = extractPageText(new TextDecoder('utf-8').decode(buffer), PAGE_TEXT_MAX)
    if (text.length < 50) return { ok: false, url: rawUrl, reason: '本文を読み取れませんでした(画面を後から組み立てるページの可能性があります)' }
    return { ok: true, url: url.toString(), title, text }
  } catch (err) {
    const message = err instanceof Error && err.name === 'TimeoutError' ? '時間内に読み取れませんでした' : err instanceof Error ? err.message : '読み取れませんでした'
    return { ok: false, url: rawUrl, reason: message }
  }
}
