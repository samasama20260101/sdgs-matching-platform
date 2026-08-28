import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/server'

export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export type ActiveOrganizationContext = {
  membershipId: string
  organizationId: string
  organizationRole: OrganizationRole
  department: string | null
  externalPhone: string | null
  phoneExtension: string | null
  organization: {
    id: string
    name: string
    supporter_type: string | null
    bio: string | null
    social_links: Record<string, unknown> | null
    phone: string | null
    postal_code: string | null
    prefecture: string | null
    city: string | null
    address_structured: Record<string, unknown> | null
    reception_status: string
    status: string
    is_featured: boolean
    featured_order: number
  }
}

export async function getActiveOrganizationForUser(userId: string): Promise<ActiveOrganizationContext | null> {
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('organization_memberships')
    .select('id, organization_id, role, department, external_phone, phone_extension')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    console.error('[organizations] membership fetch error:', membershipError)
    return null
  }
  if (!membership) return null

  const { data: organization, error: organizationError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, supporter_type, bio, social_links, phone, postal_code, prefecture, city, address_structured, reception_status, status, is_featured, featured_order')
    .eq('id', membership.organization_id)
    .eq('status', 'ACTIVE')
    .single()

  if (organizationError) {
    console.error('[organizations] organization fetch error:', organizationError)
    return null
  }

  return {
    membershipId: membership.id,
    organizationId: membership.organization_id,
    organizationRole: membership.role as OrganizationRole,
    department: membership.department,
    externalPhone: membership.external_phone,
    phoneExtension: membership.phone_extension,
    organization,
  }
}

export type OrganizationSummary = {
  id: string
  name: string
  supporter_type: string | null
}

/**
 * 複数ユーザーの所属団体をまとめて解決する（管理画面の一覧用）。
 * 団体名・種別の正本は organizations 側であり、users の同名列は移行前の遺物で
 * プロフィール更新では書き換わらないため、一覧表示では必ずこちらを使うこと。
 * FK JOIN は使わず2ステップで取得する。
 */
export async function getOrganizationsByUserIds(
  userIds: string[],
): Promise<Record<string, OrganizationSummary>> {
  const uniqueUserIds = [...new Set(userIds)]
  if (uniqueUserIds.length === 0) return {}

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('organization_memberships')
    .select('user_id, organization_id')
    .in('user_id', uniqueUserIds)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: true })

  if (membershipError) {
    console.error('[organizations] memberships fetch error:', membershipError)
    return {}
  }

  // 複数所属なら最古のACTIVE所属を採用（getActiveOrganizationForUser と同じ規則）
  const organizationIdByUserId: Record<string, string> = {}
  ;(memberships ?? []).forEach((m: { user_id: string; organization_id: string }) => {
    if (!organizationIdByUserId[m.user_id]) {
      organizationIdByUserId[m.user_id] = m.organization_id
    }
  })

  const organizationIds = [...new Set(Object.values(organizationIdByUserId))]
  if (organizationIds.length === 0) return {}

  // status では絞らない（PAUSED / ARCHIVED の団体も管理画面には実データを出す）
  const { data: organizations, error: organizationError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, supporter_type')
    .in('id', organizationIds)

  if (organizationError) {
    console.error('[organizations] organizations fetch error:', organizationError)
    return {}
  }

  const organizationById: Record<string, OrganizationSummary> = {}
  ;(organizations ?? []).forEach((o: OrganizationSummary) => {
    organizationById[o.id] = o
  })

  const organizationByUserId: Record<string, OrganizationSummary> = {}
  Object.entries(organizationIdByUserId).forEach(([userId, organizationId]) => {
    const organization = organizationById[organizationId]
    if (organization) organizationByUserId[userId] = organization
  })

  return organizationByUserId
}
