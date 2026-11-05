// ログインのあとに戻る先(純粋関数)。同じサイトの中のパスだけを通す(オープンリダイレクト対策)。
// 「/\evil.example」のような書き方はブラウザが「//evil.example」と読むので、\ と制御文字を断り、URL として解いて origin を確かめる
const BASE = 'https://same-origin.invalid'

export function safeNext(value: string | null | undefined, fallback = '/home'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback
  let url: URL
  try {
    url = new URL(value, BASE)
  } catch {
    return fallback
  }
  if (url.origin !== BASE) return fallback
  const path = `${url.pathname}${url.search}${url.hash}`
  return path.startsWith('/start') ? fallback : path
}
