// ログインに使うメールアドレスの変更(#155、2026-11-23 運営了承)。純粋関数だけを置く。
// - 本人が「わたし」で変える: 新しいアドレスに届くコードで確定し、古いアドレスでは確かめない(退職などで使えなくなった人のため)
// - 古いアドレスでログインできなくなった個人の支え手: 確認済みの電話番号に届く SMS のコードで入り、本人が変える
// - 支援団体のメンバー: 運営が団体の管理の人に本人か確かめてから、運営の画面で変える(ここの adminEmailChangeBlocker で判定)
// - 相談者: 本人と確かめる手がかりがないので、運営は変えない(新しいアドレスで登録し直してもらう)
import { isSupporterPurpose } from './publicSupporter'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 入力のメールアドレスを、比べられる形にする(前後の空白を除き、小文字に。Supabase の Auth も小文字で持つ)。形が違えば null
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase()
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return null
  return email
}

// 電話番号を Auth が持つ形(E.164、+ から始まる)にする。日本の番号は 090-1234-5678 のように 0 から書いてもよい。
// 「+81 090…」と国番号のあとに 0 を残した書き方も直す。全角の数字・空白・ハイフン・かっこは除く。形が違えば null
export function normalizePhone(input: string): string | null {
  const half = input.replace(/[０-９＋]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  let s = half.replace(/[\s\-‐−－ー().（）]/g, '')
  if (/^0\d{9,10}$/.test(s)) s = `+81${s.slice(1)}`
  else if (/^\+810\d{9,10}$/.test(s)) s = `+81${s.slice(4)}`
  else if (/^81\d{9,10}$/.test(s)) s = `+${s}`
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : null
}

export type AdminEmailChangeTarget = {
  // 変える人(users)。運営のアカウント(ADMIN)は運営の画面では変えない
  user: { role: string; isSuspended: boolean } | null
  // 運営が本人か確かめるときに使った団体
  organization: { application: unknown; status: string } | null
  // その団体での所属。今いるメンバー(ACTIVE)だけ
  membershipStatus: string | null
}

export type AdminEmailChangeBlocker = 'NO_USER' | 'ADMIN_ACCOUNT' | 'SUSPENDED' | 'NO_ORGANIZATION' | 'NOT_SUPPORT_ORGANIZATION' | 'NOT_MEMBER'

// 運営の画面でアドレスを変えてよいか。変えてよければ null、だめなら理由を返す。
// 本人かどうかは団体の管理の人に確かめるので、相談者の会社・地域(相談のための団体)だけに入っている人は対象にしない
export function adminEmailChangeBlocker(target: AdminEmailChangeTarget): AdminEmailChangeBlocker | null {
  if (!target.user) return 'NO_USER'
  if (target.user.role === 'ADMIN') return 'ADMIN_ACCOUNT'
  if (target.user.isSuspended) return 'SUSPENDED'
  if (!target.organization || target.organization.status === 'ARCHIVED') return 'NO_ORGANIZATION'
  if (!isSupporterPurpose(target.organization.application)) return 'NOT_SUPPORT_ORGANIZATION'
  if (target.membershipStatus !== 'ACTIVE') return 'NOT_MEMBER'
  return null
}

// Auth がアドレスの変更を断ったときに、画面に出す言葉の種類
export type EmailChangeError = 'TAKEN' | 'TOO_MANY' | 'NEEDS_MFA' | 'INVALID' | 'FAILED'

export function emailChangeError(err: { code?: string; status?: number }): EmailChangeError {
  if (err.code === 'email_exists' || err.code === 'user_already_exists' || err.code === 'conflict') return 'TAKEN'
  if (err.status === 429 || err.code === 'over_email_send_rate_limit' || err.code === 'over_request_rate_limit') return 'TOO_MANY'
  if (err.code === 'insufficient_aal') return 'NEEDS_MFA'
  if (err.code === 'email_address_invalid' || err.code === 'validation_failed') return 'INVALID'
  return 'FAILED'
}
