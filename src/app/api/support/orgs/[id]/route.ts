// 団体のページ(メンバーが見る)。GET: 団体の中身・メンバー・招待中 / PATCH: 紹介・連絡先・人数・遠隔・言語(管理だけ)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { myOrgRole } from '@/lib/server/orgAccess'
import { locales } from '@/i18n/routing'

const patchSchema = z.object({
  bio: z.string().max(1000).nullable().optional(),
  contactEmail: z.string().email().max(254).nullable().optional(),
  population: z.number().int().positive().max(2_000_000_000).nullable().optional(),
  remoteOk: z.boolean().optional(),
  languages: z.array(z.enum(locales)).min(1).optional(),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = await myOrgRole(auth.appUser.id, id)
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // organization_memberships と users の間には外部キーが 2 つある(本人と、招いた人)。
  // どちらで結ぶかを名指ししないと PostgREST が断り(PGRST201)、一員の一覧が空になる
  const [orgRes, membersRes, invitesRes] = await Promise.all([
    supabaseAdmin.from('organizations').select('id, display_id, name, org_type, vetting_status, bio, contact_email, population, remote_ok, languages').eq('id', id).single(),
    supabaseAdmin.from('organization_memberships').select('id, role, status, joined_at, user_id, users!organization_memberships_user_id_fkey(display_name)').eq('organization_id', id).in('status', ['ACTIVE', 'SUSPENDED']).order('joined_at', { ascending: true }),
    role === 'MEMBER' ? Promise.resolve({ data: [], error: null }) : supabaseAdmin.from('organization_invitations').select('id, email, role, created_at, expires_at').eq('organization_id', id).eq('status', 'PENDING'),
  ])
  const failed = orgRes.error ?? membersRes.error ?? invitesRes.error
  if (failed) {
    console.error('[api/support/orgs/[id]] GET', failed)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  const org = orgRes.data
  const members = membersRes.data
  const invites = invitesRes.data
  return NextResponse.json({
    organization: org,
    myRole: role,
    members: (members ?? []).map((m) => {
      const u = m.users as unknown as { display_name?: string } | null
      return { id: m.id, role: m.role, status: m.status, joinedAt: m.joined_at, displayName: u?.display_name ?? '—', isMe: m.user_id === auth.appUser.id }
    }),
    invitations: invites ?? [],
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((await myOrgRole(auth.appUser.id, id)) !== 'OWNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const p = parsed.data
  const update: Record<string, unknown> = {}
  if (p.bio !== undefined) update.bio = p.bio
  if (p.contactEmail !== undefined) update.contact_email = p.contactEmail
  if (p.population !== undefined) update.population = p.population
  if (p.remoteOk !== undefined) update.remote_ok = p.remoteOk
  if (p.languages !== undefined) update.languages = p.languages
  const { error } = await supabaseAdmin.from('organizations').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  await supabaseAdmin.from('audit_logs').insert({ actor_user_id: auth.appUser.id, organization_id: id, action: 'organization.update', target_table: 'organizations', target_id: id, metadata: { fields: Object.keys(update) } })
  return NextResponse.json({ ok: true })
}
