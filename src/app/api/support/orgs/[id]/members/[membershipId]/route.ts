// メンバーの役割を変える・団体から外す(管理だけ)。外した日から、その人は団体の相談を読めない(盤 65)。
// 最後の管理者は外せない(DB の prevent_last_active_organization_owner_removal が止める)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { myOrgRole } from '@/lib/server/orgAccess'

const schema = z.union([z.object({ role: z.enum(['OWNER', 'MEMBER']) }), z.object({ remove: z.literal(true) })])

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; membershipId: string }> }) {
  const { id, membershipId } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id) || !isUuid(membershipId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((await myOrgRole(auth.appUser.id, id)) !== 'OWNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const update = 'remove' in parsed.data
    ? { status: 'LEFT', left_at: new Date().toISOString() }
    : { role: parsed.data.role }
  const { data, error } = await supabaseAdmin.from('organization_memberships').update(update).eq('id', membershipId).eq('organization_id', id).in('status', ['ACTIVE', 'SUSPENDED']).select('id').maybeSingle()
  if (error) {
    // 最後の管理者を外そうとした
    return NextResponse.json({ error: '最後の管理者は外せません', code: 'LAST_OWNER' }, { status: 409 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await supabaseAdmin.from('audit_logs').insert({ actor_user_id: auth.appUser.id, organization_id: id, action: 'remove' in parsed.data ? 'organization.member_remove' : 'organization.member_role', target_table: 'organization_memberships', target_id: membershipId, metadata: update })
  return NextResponse.json({ ok: true })
}
