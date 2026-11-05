// 回数の上限(DB の hit_rate_limit で数える。v2_12)。IP や人の id はそのまま残さず、HMAC で伏せた値だけを送る。
// 数えられなかったとき(DB の不調)は「上限を超えた」と同じに扱う(AI の費用を守る側に倒す)
import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/server'

export type RateLimit = { bucket: string; windowSeconds: number; max: number }

async function keyHash(key: string): Promise<string> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(`rate-limit:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(key))
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function allowedByRateLimit(limit: RateLimit, key: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc('hit_rate_limit', {
      p_bucket: limit.bucket,
      p_key_hash: await keyHash(key),
      p_window_seconds: limit.windowSeconds,
      p_max: limit.max,
    })
    if (error) throw error
    return data === true
  } catch (error) {
    console.error('[rateLimit]', limit.bucket, error)
    return false
  }
}

// 古い区切りの行を消す(毎日の自動処理から)
export async function pruneRateLimitHits(olderThanMs = 2 * 24 * 60 * 60 * 1000): Promise<void> {
  const { error } = await supabaseAdmin.from('rate_limit_hits').delete().lt('window_start', new Date(Date.now() - olderThanMs).toISOString())
  if (error) console.error('[rateLimit] prune', error)
}
