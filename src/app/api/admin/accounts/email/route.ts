// 運営｜メールアドレスの変更(#155): 古いアドレスでログインできなくなった支援団体のメンバーのアドレスを、運営が変える。
// 運営は先に団体の管理の人へ本人からの依頼か確かめる(画面で確かめたことを送らせる)。変えてよい人の決まりは
// src/lib/domain/accountEmail.ts の adminEmailChangeBlocker だけで判定する(相談者・運営のアカウントは変えない)。
// 新しいアドレスは運営が本人と確かめたものなので、確認のメールを送らずに確定する。変えたことは audit_logs に残す(アドレスは残さない)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { adminEmailChangeBlocker, normalizeEmail } from '@/lib/domain/accountEmail'

const schema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
  email: z.string().max(254),
  confirmedWithOrganization: z.literal(true),
})

const BLOCKER_MESSAGES: Record<string, string> = {
  NO_USER: '利用者が見つかりません',
  ADMIN_ACCOUNT: '運営のアカウントは、この画面では変えません',
  SUSPENDED: '止めている利用者です',
  NO_ORGANIZATION: '団体が見つかりません',
  NOT_SUPPORT_ORGANIZATION: '支援団体ではありません。相談者は新しいアドレスで登録し直していただきます',
  NOT_MEMBER: 'この団体の今のメンバーではありません',
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const { organizationId, userId, email: rawEmail } = parsed.data
  const email = normalizeEmail(rawEmail)
  if (!email) return NextResponse.json({ error: 'メールアドレスの形を確かめてください', code: 'INVALID_EMAIL' }, { status: 400 })

  const [{ data: user, error: uError }, { data: org, error: oError }, { data: membership, error: mError }] = await Promise.all([
    supabaseAdmin.from('users').select('id, auth_user_id, role, is_suspended').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('organizations').select('id, application, status').eq('id', organizationId).maybeSingle(),
    supabaseAdmin.from('organization_memberships').select('status').eq('organization_id', organizationId).eq('user_id', userId).eq('status', 'ACTIVE').maybeSingle(),
  ])
  if (uError || oError || mError) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  const blocker = adminEmailChangeBlocker({
    user: user ? { role: user.role as string, isSuspended: Boolean(user.is_suspended) } : null,
    organization: org ? { application: org.application, status: org.status as string } : null,
    membershipStatus: (membership?.status as string | undefined) ?? null,
  })
  if (blocker || !user?.auth_user_id) {
    return NextResponse.json({ error: BLOCKER_MESSAGES[blocker ?? 'NO_USER'], code: blocker ?? 'NO_USER' }, { status: 409 })
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.auth_user_id as string, { email, email_confirm: true })
  if (updateError) {
    if (updateError.code === 'email_exists' || updateError.status === 422) {
      return NextResponse.json({ error: 'このメールアドレスは、ほかのアカウントで使われています', code: 'TAKEN' }, { status: 409 })
    }
    console.error('[api/admin/accounts/email] update', updateError.code, updateError.status)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  const { error: logError } = await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.appUser.id,
    action: 'admin.email_change',
    target_table: 'users',
    target_id: userId,
    metadata: { organization_id: organizationId, confirmed_with_organization: true },
  })
  if (logError) console.error('[api/admin/accounts/email] audit', logError.code)
  return NextResponse.json({ ok: true })
}
