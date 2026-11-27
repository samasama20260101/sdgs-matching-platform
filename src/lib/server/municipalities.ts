import 'server-only'

// 相談者の市区町村(全国地方公共団体コード、#173)を確かめて読む。市区町村は選んだ都道府県の中のものだけを受け付ける
import { supabaseAdmin } from '@/lib/supabase/server'

// 受け付けてよい市区町村か(空は「選ばない」で受け付ける)。日本で、都道府県の中のコードだけ
export async function municipalityAllowed(code: string | null | undefined, country: string | null | undefined, regionCode: string | null | undefined): Promise<boolean> {
  if (!code) return true
  if (country !== 'JP' || !regionCode) return false
  const { data, error } = await supabaseAdmin.from('municipalities').select('code').eq('code', code).eq('prefecture_code', regionCode).maybeSingle()
  if (error) throw error
  return data !== null
}

// 画面に出す市区町村の名前(政令市の区は「熊本市中央区」の形)。分からなければ null
export async function municipalityName(code: string | null | undefined): Promise<string | null> {
  if (!code) return null
  const { data, error } = await supabaseAdmin.from('municipalities').select('name').eq('code', code).maybeSingle()
  if (error) throw error
  return (data?.name as string | undefined) ?? null
}
