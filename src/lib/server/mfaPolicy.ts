import 'server-only'

// 団体のメンバーが機微な相談の中身を見るときに、2つ目の確認(認証アプリ)を求めるか。既定は求める
export function requireMfaForSensitive(): boolean {
  return process.env.REQUIRE_MFA_FOR_SENSITIVE !== 'false'
}
