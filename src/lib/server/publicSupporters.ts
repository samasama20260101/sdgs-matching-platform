import 'server-only'

// 公開の団体一覧・団体ページ・お知らせの団体の札の読み込みを 1 か所に(dead-code のレビュー 11/5: 3 か所に写しがあり、
// 審査の絞り込みが札だけ抜けて、審査前や見送りの団体の名前と紹介文をお知らせに出せた)。
// 載せるのは、運営が承認した(APPROVED)・止めていない(ACTIVE)・支え手として登録した団体だけ
import { supabaseAdmin } from '@/lib/supabase/server'
import { isSupporterPurpose, publicSupporterType, type PublicSupporterType } from '@/lib/domain/publicSupporter'
import { effectiveServiceAreas } from '@/lib/domain/serviceAreas'

export type PublicArea = { region_code: string; country: string; name_local: string; name_en: string }
export type PublicSupporter = {
  id: string
  name: string
  supporterType: PublicSupporterType
  bio: string | null
  socialLinks: unknown
  createdAt: string
  resolvedCount: number
  badgeCount: number
  nationwide: boolean
  areas: PublicArea[]
}

type OrgRow = { id: string; name: string; supporter_type: string | null; org_type: string | null; bio: string | null; social_links: unknown; created_at: string; application: unknown; prefecture: string | null; region_country: string | null }

export async function listPublicSupporters(opts: { ids?: string[]; limit?: number } = {}): Promise<PublicSupporter[]> {
  let q = supabaseAdmin
    .from('organizations')
    .select('id, name, supporter_type, org_type, bio, social_links, created_at, application, prefecture, region_country')
    .eq('status', 'ACTIVE')
    .eq('vetting_status', 'APPROVED')
    .order('created_at', { ascending: false })
  if (opts.ids) q = q.in('id', opts.ids)
  const { data, error } = await q.limit(opts.limit ?? 100)
  if (error) throw error
  const orgs = ((data ?? []) as OrgRow[]).filter((o) => isSupporterPurpose(o.application))
  if (orgs.length === 0) return []
  const ids = orgs.map((o) => o.id)

  // 解決した相談とありがとうの数は DB の中で数える(v2_10。行を運んで数えると 1000 行で黙って切れる)
  const [counts, areas] = await Promise.all([
    supabaseAdmin.rpc('public_supporter_counts', { p_org_ids: ids }),
    supabaseAdmin.from('supporter_service_areas').select('organization_id, region_code, is_nationwide, country').in('organization_id', ids),
  ])
  const failed = counts.error ?? areas.error
  if (failed) throw failed
  const countRows = (counts.data ?? []) as { organization_id: string; resolved_cases: number; thanks: number }[]
  const resolved = new Map(countRows.map((r) => [r.organization_id, Number(r.resolved_cases)]))
  const badgeCount = new Map(countRows.map((r) => [r.organization_id, Number(r.thanks)]))
  const areaRows = (areas.data ?? []) as { organization_id: string; region_code: string | null; is_nationwide: boolean; country: string | null }[]

  // 活動地域: 団体が登録した地域(全国か地域の一覧)。登録がなければ申し込みのときの都道府県(src/lib/domain/serviceAreas.ts)
  const served = new Map(orgs.map((o) => [o.id, effectiveServiceAreas(areaRows.filter((a) => a.organization_id === o.id), o.prefecture)]))
  const codes = new Set<string>()
  for (const s of served.values()) for (const c of s.regionCodes) codes.add(c)
  const regionName = new Map<string, { name_local: string; name_en: string }>()
  if (codes.size > 0) {
    const { data: regions, error: rErr } = await supabaseAdmin.from('regions').select('code, name_local, name_en').in('code', [...codes])
    if (rErr) throw rErr
    for (const r of regions ?? []) regionName.set(r.code as string, { name_local: r.name_local as string, name_en: (r.name_en as string) ?? (r.name_local as string) })
  }
  const area = (code: string, country: string | null): PublicArea => ({
    region_code: code,
    country: country ?? 'JP',
    name_local: regionName.get(code)?.name_local ?? code,
    name_en: regionName.get(code)?.name_en ?? code,
  })

  return orgs.map((o) => {
    const s = served.get(o.id) ?? { nationwide: false, regionCodes: [] }
    return {
      id: o.id,
      name: o.name,
      supporterType: publicSupporterType(o.supporter_type, o.org_type),
      bio: o.bio,
      socialLinks: o.social_links,
      createdAt: o.created_at,
      resolvedCount: resolved.get(o.id) ?? 0,
      badgeCount: badgeCount.get(o.id) ?? 0,
      nationwide: s.nationwide,
      areas: s.regionCodes.map((c) => area(c, o.region_country)),
    }
  })
}

// 団体ページを開く id から団体を引く。旧 URL(/supporters/{user_id})から来た場合は、その人の団体に読み替える
// (本の相談所など外からのリンクが残っている)
export async function findPublicSupporter(id: string): Promise<PublicSupporter | null> {
  const [direct] = await listPublicSupporters({ ids: [id], limit: 1 })
  if (direct) return direct
  const { data: membership, error } = await supabaseAdmin
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', id)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!membership?.organization_id) return null
  const [viaUser] = await listPublicSupporters({ ids: [membership.organization_id as string], limit: 1 })
  return viaUser ?? null
}

// 相談した人が贈った「ありがとう」の言葉ごとの数
export async function publicThanksWords(organizationId: string): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin
    .from('supporter_badges')
    .select('badge_key')
    .eq('supporter_organization_id', organizationId)
  if (error) throw error
  const words: Record<string, number> = {}
  for (const b of data ?? []) words[b.badge_key as string] = (words[b.badge_key as string] ?? 0) + 1
  return words
}
