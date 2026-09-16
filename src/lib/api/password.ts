import 'server-only'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 64

/**
 * 現在のパスワードが正しいかを確認する。
 *
 * Supabase の updateUser は現在のパスワードを検証しないため、自前で確かめる必要がある。
 * signInWithPassword で試すが、以下2点に注意して呼び出し元のセッションを壊さないようにする。
 * - persistSession: false の使い捨てクライアントを使う（サーバー側に状態を残さない）
 * - signOut は呼ばない。既定スコープが global で、成功すると利用者の本来のセッションまで
 *   まとめて失効してしまうため（検証用に発行されたセッションは返さず破棄するだけでよい）
 *
 * 総当たり対策は GoTrue 側のトークン発行レート制限に依存している。
 */
export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  if (!email || !password) return false

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) return false
  return true
}

export function isAcceptablePassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= MIN_PASSWORD_LENGTH &&
    value.length <= MAX_PASSWORD_LENGTH
  )
}
