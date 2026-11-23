// 運営｜メールアドレスの変更(#155): 支援団体を名前で探し、今いるメンバーを並べる。?q=団体名の一部
// 変えられるのは支援団体のメンバーだけなので、相談者の会社・地域(相談のための団体)は出さない。メールアドレスは出さない
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { isSupporterPurpose } from '@/lib/domain/publicSupporter'

type MemberRow = { organization_id: string; user_id: string; role: string; users: { display_name: string | null; display_id: string | null; role: string; is_suspended: boolean } | null }

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 100)
  if (q.length === 0) return NextResponse.json({ organizations: [] })
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const { data: orgs, error } = await supabaseAdmin
    .from('organizations')
    .select('id, display_id, name, vetting_status, application')
    .ilike('name', pattern)
    .neq('status', 'ARCHIVED')
    .order('name')
    .limit(30)
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  const supportOrgs = (orgs ?? []).filter((o) => isSupporterPurpose(o.application)).slice(0, 20)
  if (supportOrgs.length === 0) return NextResponse.json({ organizations: [] })
  const { data: members, error: mError } = await supabaseAdmin
    .from('organization_memberships')
    // 所属から利用者へは本人(user_id)と招いた人(invited_by_user_id)の 2 本があるので、本人の側を名前で指す
    .select('organization_id, user_id, role, users!organization_memberships_user_id_fkey(display_name, display_id, role, is_suspended)')
    .in('organization_id', supportOrgs.map((o) => o.id as string))
    .eq('status', 'ACTIVE')
  if (mError) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  const rows = (members ?? []) as unknown as MemberRow[]
  const organizations = supportOrgs.map((o) => ({
    id: o.id as string,
    displayId: o.display_id as string,
    name: o.name as string,
    vettingStatus: o.vetting_status as string,
    members: rows
      .filter((m) => m.organization_id === o.id && m.users && m.users.role !== 'ADMIN')
      .map((m) => ({
        userId: m.user_id,
        displayName: m.users?.display_name ?? '',
        displayId: m.users?.display_id ?? '',
        role: m.role === 'OWNER' ? 'OWNER' : 'MEMBER',
        suspended: Boolean(m.users?.is_suspended),
      })),
  }))
  return NextResponse.json({ organizations })
}
