import 'server-only'

// わたしの相談(相談する側)。本人の相談と、今いる団体が会社・地域として相談したもの(同じ団体のメンバーにも見える、盤 05b)
import { supabaseAdmin } from '@/lib/supabase/server'
import type { MyCaseItem } from '@/components/consult/MyCases'

type Row = {
  id: string
  title: string
  status: MyCaseItem['status']
  subject_type: MyCaseItem['subjectType']
  subject_organization_id: string | null
  created_at: string
}

export async function consulteeOrganizationIds(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
  if (error) throw error
  return (data ?? []).map((m) => m.organization_id as string)
}

export async function listMyCases(userId: string): Promise<MyCaseItem[]> {
  const orgIds = await consulteeOrganizationIds(userId)
  const filters = [`and(owner_user_id.eq.${userId},subject_type.eq.PERSON)`]
  if (orgIds.length > 0) filters.push(`subject_organization_id.in.(${orgIds.join(',')})`)
  const { data, error } = await supabaseAdmin
    .from('cases')
    .select('id, title, status, subject_type, subject_organization_id, created_at')
    .or(filters.join(','))
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  const rows = (data ?? []) as Row[]
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const subjectOrgIds = [...new Set(rows.map((r) => r.subject_organization_id).filter((v): v is string => Boolean(v)))]
  const [{ data: offers, error: oErr }, { data: orgs, error: gErr }] = await Promise.all([
    supabaseAdmin.from('offers').select('case_id, status').in('case_id', ids).in('status', ['PENDING', 'INVITED']),
    subjectOrgIds.length > 0
      ? supabaseAdmin.from('organizations').select('id, name').in('id', subjectOrgIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ])
  if (oErr) throw oErr
  if (gErr) throw gErr
  const pending = new Map<string, number>()
  for (const o of offers ?? []) pending.set(o.case_id as string, (pending.get(o.case_id as string) ?? 0) + 1)
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]))

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    subjectType: r.subject_type,
    subjectName: r.subject_organization_id ? orgName.get(r.subject_organization_id) ?? null : null,
    pendingOffers: pending.get(r.id) ?? 0,
    unread: 0,
    createdAt: r.created_at,
  }))
}
