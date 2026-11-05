// メンバーを招く(メールで。アカウントがあればその人に、なければ登録したときに届く)。団体のメールではなく本人のメールで入る(盤 65)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { canInvite, myOrgRole } from '@/lib/server/orgAccess'

const schema = z.object({ email: z.string().email().max(254).transform((v) => v.trim().toLowerCase()), role: z.enum(['ADMIN', 'MEMBER']) })
const INVITE_DAYS = 14

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'メールアドレスを確かめてください', code: 'INVALID' }, { status: 400 })
  const role = await myOrgRole(auth.appUser.id, id)
  if (!role || !canInvite(role, parsed.data.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { error } = await supabaseAdmin.from('organization_invitations').insert({
    organization_id: id,
    email: parsed.data.email,
    role: parsed.data.role,
    status: 'PENDING',
    invited_by_user_id: auth.appUser.id,
    expires_at: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'もう招いています', code: 'ALREADY' }, { status: 409 })
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  await supabaseAdmin.from('audit_logs').insert({ actor_user_id: auth.appUser.id, organization_id: id, action: 'organization.invite', target_table: 'organization_invitations', metadata: { role: parsed.data.role } })
  return NextResponse.json({ ok: true })
}
