import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/server'

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

  // 複数所属なら最古のACTIVE所属を採用
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
