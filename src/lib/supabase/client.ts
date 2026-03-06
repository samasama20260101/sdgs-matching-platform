import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 無効なRefresh Tokenをサイレントにクリアする
    // "Invalid Refresh Token: Refresh Token Not Found" エラーを防ぐ
    onAuthStateChange: undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// 無効なRefresh Tokenエラーを自動クリアするリスナー
// ブラウザ環境でのみ実行
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED' && !session) {
      // リフレッシュ失敗 → セッションをクリア
      supabase.auth.signOut()
    }
  })

  // 起動時に無効なセッションをチェック
  supabase.auth.getSession().catch(() => {
    supabase.auth.signOut()
  })
}

// ユーザータイプの型定義
export type UserType = 'help_seeker' | 'npo' | 'corporation'

// サインアップデータの型定義
export interface SignupData {
  userType: UserType
  email: string
  password: string
  // 困っている人
  name?: string
  // NPO/企業
  organizationName?: string
  representativeName?: string
  address?: string
  phone?: string
}