// Vercel Cron からのリクエストかを確かめる(Authorization: Bearer <CRON_SECRET>)。
// CRON_SECRET が未設定・空のときは必ず拒否する。素朴に `Bearer ${process.env.CRON_SECRET}` と比べると、
// 未設定の環境では「Bearer undefined」で通ってしまうため。
import { createHash, timingSafeEqual } from 'node:crypto'

export function isValidCronAuthorization(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret || !authHeader) return false
  // 長さの違いも漏らさないよう、ハッシュ同士を一定時間で比べる
  const expected = createHash('sha256').update(`Bearer ${secret}`).digest()
  const actual = createHash('sha256').update(authHeader).digest()
  return timingSafeEqual(expected, actual)
}
