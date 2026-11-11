import 'server-only'

// 1人1アカウントの「支える側の顔」(盤 03): 団体の一員(複数可)と個人の支え手。
// 相談する顔は全員が持つ。運営(ADMIN)は支える顔も相談する顔も持たない。
import { supabaseAdmin } from '@/lib/supabase/server'
import { canSupportAtAge, currentAge, todayInTokyo } from '@/lib/domain/age'

export type OrganizationFace = {
  kind: 'ORGANIZATION'
  organizationId: string
  organizationName: string
  orgType: string
  vettingStatus: string
  role: 'OWNER' | 'MEMBER'
  membershipId: string
  isCoordinator: boolean
}

export type IndividualFace = {
  kind: 'INDIVIDUAL'
  realName: string
  phoneVerified: boolean
  status: 'ACTIVE' | 'SUSPENDED'
}

export type Faces = {
  organizations: OrganizationFace[]
  individual: IndividualFace | null
}

type MembershipRow = {
  id: string
  role: string
  organization_id: string
  organizations: { id: string; name: string; org_type: string; vetting_status: string; status: string } | null
}

// 今の年齢で支える側として活動できるか。読めないときは止める側に倒す。
// loadFaces は会社・地域として相談するときにも使うので、ここでは絞らない(18歳未満でも相談はできる)
export async function canSupportNow(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('users').select('age_years, age_base_date').eq('id', userId).single()
  if (error) {
    console.error('[faces] age', error)
    return false
  }
  return canSupportAtAge(currentAge(data.age_years as number | null, data.age_base_date as string | null, todayInTokyo()))
}

export async function loadFaces(userId: string): Promise<Faces> {
  const [{ data: memberships, error: mErr }, { data: profile, error: pErr }] = await Promise.all([
    supabaseAdmin
      .from('organization_memberships')
      .select('id, role, organization_id, organizations(id, name, org_type, vetting_status, status)')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE'),
    supabaseAdmin
      .from('supporter_profiles')
      .select('real_name, phone_verified_at, status')
      .eq('user_id', userId)
      .maybeSingle(),
  ])
  if (mErr) throw mErr
  if (pErr) throw pErr

  const rows = (memberships ?? []) as unknown as MembershipRow[]
  const orgIds = rows.map((m) => m.organization_id)
  let coordinatorOrgIds = new Set<string>()
  if (orgIds.length > 0) {
    const { data: scopes, error: sErr } = await supabaseAdmin
      .from('coordinator_scopes')
      .select('organization_id')
      .in('organization_id', orgIds)
    if (sErr) throw sErr
    coordinatorOrgIds = new Set((scopes ?? []).map((s) => s.organization_id as string))
  }

  const organizations: OrganizationFace[] = rows.flatMap((m) => {
    const org = m.organizations
    if (!org || org.status === 'ARCHIVED') return []
    const role: OrganizationFace['role'] = m.role === 'OWNER' ? 'OWNER' : 'MEMBER'
    return [{
      kind: 'ORGANIZATION' as const,
      organizationId: m.organization_id,
      organizationName: org.name,
      orgType: org.org_type,
      vettingStatus: org.vetting_status,
      role,
      membershipId: m.id,
      isCoordinator: coordinatorOrgIds.has(m.organization_id),
    }]
  })

  const individual: IndividualFace | null = profile
    ? {
        kind: 'INDIVIDUAL',
        realName: profile.real_name as string,
        phoneVerified: Boolean(profile.phone_verified_at),
        status: profile.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
      }
    : null

  return { organizations, individual }
}
