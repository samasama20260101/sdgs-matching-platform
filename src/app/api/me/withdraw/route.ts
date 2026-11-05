// 退会(v2.0)。DB の withdraw_person が記録・所属・相談・個人情報をまとめて片付け、続けて Auth のアカウント(メール)を消す
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null
  if (body?.confirm !== true) return NextResponse.json({ error: '確認が必要です', code: 'INVALID' }, { status: 400 })

  const { data, error } = await supabaseAdmin.rpc('withdraw_person', { p_user_id: auth.appUser.id })
  if (error) {
    console.error('[api/me/withdraw] rpc:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  const result = data as { ok?: boolean; error?: string }
  if (result.error === 'LAST_OWNER') {
    return NextResponse.json({ error: '団体の管理者を別の人に替えてから退会してください', code: 'LAST_OWNER' }, { status: 409 })
  }
  if (!result.ok) return NextResponse.json({ error: '退会できませんでした', code: result.error }, { status: 400 })

  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.appUser.id,
    action: 'person.withdraw',
    target_table: 'users',
    target_id: auth.appUser.id,
    metadata: {},
  })

  // メールを Auth から消す(users の行は伏せた形で残る。相談の相手の画面で「退会した人」と出る)
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(auth.authUser.id)
  if (deleteError) console.error('[api/me/withdraw] auth delete:', deleteError)

  return NextResponse.json({ ok: true })
}
