// 電話番号の確認(SMS)が済んだことを記録する。番号そのものは Auth の中だけに置き、users・supporter_profiles には書かない。
// 確認は画面から Supabase Auth(updateUser → verifyOtp type=phone_change)で行い、ここは Auth の確認済みの印を読むだけ
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!auth.authUser.phone || !auth.authUser.phone_confirmed_at) {
    return NextResponse.json({ error: '電話番号の確認が済んでいません', code: 'NOT_CONFIRMED' }, { status: 409 })
  }
  const { data, error } = await supabaseAdmin
    .from('supporter_profiles')
    .update({ phone_verified_at: auth.authUser.phone_confirmed_at })
    .eq('user_id', auth.appUser.id)
    .select('user_id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  if (!data) return NextResponse.json({ error: '先に支え手として登録してください', code: 'NO_PROFILE' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
