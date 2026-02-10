import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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