// 差出人の設定 "明日もsamasama <no-reply@samasama.site>" を { name, email } に分ける(純粋関数)。
// Cloudflare Email Sending のバインディングは表示名とアドレスを別々に受け取るため(#166)
export interface Mailbox {
  email: string
  name: string
}

// 表示名がなければ name は空。形が合わなければ null
export function parseMailbox(value: string): Mailbox | null {
  const trimmed = value.trim()
  const named = /^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/.exec(trimmed)
  if (named) return { name: named[1].trim().replace(/^"(.*)"$/, '$1'), email: named[2] }
  if (/^[^<>\s]+@[^<>\s]+$/.test(trimmed)) return { name: '', email: trimmed }
  return null
}

// バインディングに渡す差出人。表示名があればオブジェクト、なければアドレスの文字列
export function senderForBinding(value: string | undefined): Mailbox | string | null {
  if (!value) return null
  const box = parseMailbox(value)
  if (!box) return null
  return box.name ? box : box.email
}
