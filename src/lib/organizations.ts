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
