// Supabase Auth のエラーの判定(クライアント・サーバー共通)。
//
// 「漏洩パスワードのチェック」(Have I Been Pwned)をオンにすると、過去に流出したパスワードは
// weak_password エラー(reasons に 'pwned')で弾かれ、英語の文
// 「Password is known to be weak and easy to guess, please choose a different one.」がそのまま返る。
// 画面には日本語(各言語)の案内に置き換えて出す。

// 運営・サポーター向け画面(翻訳しない)で返す文
export const PWNED_PASSWORD_MESSAGE_JA = 'このパスワードは過去に流出したことがあるため使えません。別のパスワードにしてください。'

type AuthErrorLike = {
  code?: unknown
  error_code?: unknown
  reasons?: unknown
  weak_password?: { reasons?: unknown } | null
  message?: unknown
  msg?: unknown
}

// supabase-js の AuthWeakPasswordError と、GoTrue の生の JSON 応答の両方を受け付ける
export function isPwnedPasswordError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as AuthErrorLike
  const reasons = e.reasons ?? e.weak_password?.reasons
  if (Array.isArray(reasons) && reasons.includes('pwned')) return true
  const code = e.code ?? e.error_code
  const text = typeof e.message === 'string' ? e.message : typeof e.msg === 'string' ? e.msg : ''
  return code === 'weak_password' && /known to be weak|pwned/i.test(text)
}
