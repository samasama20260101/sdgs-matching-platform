import 'server-only'

// 団体の管理(盤 27 の団体の画面のうちメンバーまわり)。役割は管理(OWNER)・追加(ADMIN)・担当(MEMBER)の3つ(今と同じ)
import { supabaseAdmin } from '@/lib/supabase/server'

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export async function myOrgRole(userId: string, organizationId: string): Promise<OrgRole | null> {
  const { data } = await supabaseAdmin
    .from('organization_memberships')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('status', 'ACTIVE')
    .maybeSingle()
  const role = data?.role
  return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER' ? role : null
}

// 招ける役割: 管理は ADMIN と MEMBER、追加は MEMBER だけ
export function canInvite(actor: OrgRole, target: 'ADMIN' | 'MEMBER'): boolean {
  if (actor === 'OWNER') return true
  return actor === 'ADMIN' && target === 'MEMBER'
}
