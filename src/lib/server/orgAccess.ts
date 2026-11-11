import 'server-only'

// 団体の管理(盤 27 の団体の画面のうちメンバーまわり)。役割は管理(OWNER)とメンバー(MEMBER)の2つ(2026-11-11、v2_13)
import { supabaseAdmin } from '@/lib/supabase/server'

export type OrgRole = 'OWNER' | 'MEMBER'

export async function myOrgRole(userId: string, organizationId: string): Promise<OrgRole | null> {
  const { data } = await supabaseAdmin
    .from('organization_memberships')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('status', 'ACTIVE')
    .maybeSingle()
  const role = data?.role
  return role === 'OWNER' || role === 'MEMBER' ? role : null
}

// メンバーを招けるのは管理の人だけ(管理としてもメンバーとしても招ける)
export function canInvite(actor: OrgRole): boolean {
  return actor === 'OWNER'
}
