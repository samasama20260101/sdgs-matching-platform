// 知らせの受け取り方(本人が選ぶ。既定はどちらもオフ)。中身は件名にも本文にも書かない
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

const schema = z.object({ email: z.boolean().optional(), push: z.boolean().optional() })

export async function GET(request: Request) {
  const auth = await requireActiveAppUser(request)
  if ('response' in auth) return auth.response
  const { data, error } = await supabaseAdmin
    .from('notification_prefs')
    .select('email_enabled, push_enabled')
    .eq('user_id', auth.appUser.id)
    .maybeSingle()
  if (error) {
    console.error('[api/me/notifications]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  return NextResponse.json({ email: data?.email_enabled ?? false, push: data?.push_enabled ?? false })
}

export async function PATCH(request: Request) {
  const auth = await requireActiveAppUser(request)
  if ('response' in auth) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const row: Record<string, unknown> = { user_id: auth.appUser.id, updated_at: new Date().toISOString() }
  if (parsed.data.email !== undefined) row.email_enabled = parsed.data.email
  if (parsed.data.push !== undefined) row.push_enabled = parsed.data.push
  const { error } = await supabaseAdmin.from('notification_prefs').upsert(row, { onConflict: 'user_id' })
  if (error) {
    console.error('[api/me/notifications]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
