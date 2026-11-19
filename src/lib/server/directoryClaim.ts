import 'server-only'

// 支援団体の登録で、掲載台帳の行と支援団体を結ぶ(#140)。決まりは src/lib/domain/directoryClaim.ts。
//   - 登録の画面: 名前の近い行を探す(searchClaimCandidates)。選べる行かを確かめる(isClaimableEntryId)
//   - 運営の承認: 申し込みに残した行を支援団体に結び、名前・活動地域を登録の内容に合わせる(linkDirectoryEntry)
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  claimOverwrite,
  claimQuery,
  claimState,
  directoryEntryIdOf,
  isClaimableEntry,
  isSearchableQuery,
  rankClaimCandidates,
  safeWebsite,
  type ClaimState,
} from '@/lib/domain/directoryClaim'
import { effectiveServiceAreas, type ServiceAreaRow } from '@/lib/domain/serviceAreas'

// DB の下ごしらえで拾う数(ここから決まりで並べ直して 5 つにする)
const SEARCH_FETCH_LIMIT = 30
// in で渡す id の数の上限(審査の一覧は 200 件まで読むので、URL が長くなりすぎないように分ける)
const IN_CHUNK = 100

async function inChunks<T>(ids: string[], read: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK))
  const results = await Promise.all(chunks.map(read))
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
  return results.flatMap((r) => r.data ?? [])
}

export type ClaimCandidate = {
  id: string
  name: string
  prefectureCode: string | null
  prefectureNameLocal: string | null
  prefectureNameEn: string | null
  website: string | null
  attribution: string | null
  sourceUrl: string
}

type SearchRow = {
  id: string
  name: string
  corporate_number: string | null
  prefecture_code: string | null
  website_url: string | null
  attribution: string | null
  source_url: string
}

async function regionNames(codes: string[]): Promise<Map<string, { local: string; en: string }>> {
  const unique = [...new Set(codes)]
  if (unique.length === 0) return new Map()
  const { data, error } = await supabaseAdmin.from('regions').select('code, name_local, name_en').in('code', unique)
  if (error) throw error
  return new Map((data ?? []).map((r) => [r.code as string, { local: r.name_local as string, en: r.name_en as string }]))
}

export async function searchClaimCandidates(name: string, corporateNumber: string | null): Promise<ClaimCandidate[]> {
  const q = claimQuery(name, corporateNumber)
  if (!isSearchableQuery(q)) return []
  const { data, error } = await supabaseAdmin.rpc('search_directory_organizations', {
    p_key: q.key,
    p_corporate_number: q.corporateNumber,
    p_limit: SEARCH_FETCH_LIMIT,
  })
  if (error) throw error
  const rows = ((data ?? []) as SearchRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    corporateNumber: r.corporate_number,
    prefectureCode: r.prefecture_code,
    websiteUrl: r.website_url,
    attribution: r.attribution,
    sourceUrl: r.source_url,
  }))
  const ranked = rankClaimCandidates(rows, q)
  const names = await regionNames(ranked.flatMap((r) => (r.prefectureCode ? [r.prefectureCode] : [])))
  return ranked.map((r) => ({
    id: r.id,
    name: r.name,
    prefectureCode: r.prefectureCode,
    prefectureNameLocal: r.prefectureCode ? names.get(r.prefectureCode)?.local ?? null : null,
    prefectureNameEn: r.prefectureCode ? names.get(r.prefectureCode)?.en ?? null : null,
    website: safeWebsite(r.websiteUrl),
    attribution: r.attribution,
    sourceUrl: r.sourceUrl,
  }))
}

// 登録のときに選べる行か(民間の団体の行で、公開していて、まだ結んでいない)
export async function isClaimableEntryId(entryId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('directory_entries').select('kind, visibility, claim_status').eq('id', entryId).maybeSingle()
  if (error) throw error
  return isClaimableEntry(data ? { kind: data.kind as string, visibility: data.visibility as string, claimStatus: data.claim_status as string } : null)
}

export type LinkResult = ClaimState | 'NO_ENTRY'

// 申し込みに残した行を支援団体に結ぶ(運営の承認のとき)。結べたら LINKED(結び済みなら合わせ直す)。
// 行の名前・活動地域を登録の内容に合わせ、前の値は audit_logs に残す(戻すときに使う)。出典の列は変えない
export async function linkDirectoryEntry(organizationId: string, actorUserId: string): Promise<LinkResult> {
  const [{ data: org, error: orgError }, { data: areaRows, error: areaError }] = await Promise.all([
    supabaseAdmin.from('organizations').select('id, name, corporate_number, application').eq('id', organizationId).maybeSingle(),
    supabaseAdmin.from('supporter_service_areas').select('region_code, is_nationwide').eq('organization_id', organizationId),
  ])
  if (orgError) throw orgError
  if (areaError) throw areaError
  const entryId = org ? directoryEntryIdOf(org.application) : null
  if (!org || !entryId) return 'NO_ENTRY'

  const { data: entry, error: entryError } = await supabaseAdmin
    .from('directory_entries')
    .select('id, kind, name, corporate_number, service_scope, service_codes, claim_status, claimed_organization_id')
    .eq('id', entryId)
    .maybeSingle()
  if (entryError) throw entryError
  const state = claimState(entry ? { kind: entry.kind as string, claimStatus: entry.claim_status as string, claimedOrganizationId: (entry.claimed_organization_id as string | null) ?? null } : null, organizationId)
  if (!entry || state === 'GONE' || state === 'TAKEN') return state

  const areas = (areaRows ?? []).length > 0 ? effectiveServiceAreas((areaRows ?? []) as ServiceAreaRow[], null) : null
  const update = claimOverwrite(
    { corporateNumber: (entry.corporate_number as string | null) ?? null },
    { id: organizationId, name: org.name as string, corporateNumber: (org.corporate_number as string | null) ?? null, areas },
  )
  // ほかの支援団体と結んだ行は書き換えない(読んでから書くまでに結ばれたときも、ここで止まる)
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('directory_entries')
    .update(update)
    .eq('id', entryId)
    .eq('kind', 'ORGANIZATION')
    .or(`claim_status.neq.CLAIMED,claimed_organization_id.eq.${organizationId}`)
    .select('id')
    .maybeSingle()
  if (updateError) throw updateError
  if (!updated) return 'TAKEN'

  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: actorUserId,
    organization_id: organizationId,
    action: 'admin.directory_entry_claim',
    target_table: 'directory_entries',
    target_id: entryId,
    metadata: {
      before: {
        name: entry.name,
        corporate_number: entry.corporate_number,
        service_scope: entry.service_scope,
        service_codes: entry.service_codes,
        claim_status: entry.claim_status,
      },
      after: update,
    },
  })
  return 'LINKED'
}

export type AdminDirectoryEntry = {
  id: string
  name: string
  prefectureName: string | null
  website: string | null
  corporateNumber: string | null
  state: ClaimState
}

// 運営の審査の画面に出す、申し込みで選んだ行と、その状態(結べる・結び済み・ほかの支援団体と結び済み・行が無い)
export async function loadAdminDirectoryEntries(orgs: { id: string; application: unknown }[]): Promise<Map<string, AdminDirectoryEntry | { id: string; state: 'GONE' }>> {
  const wanted = orgs.flatMap((o) => {
    const entryId = directoryEntryIdOf(o.application)
    return entryId ? [{ orgId: o.id, entryId }] : []
  })
  const result = new Map<string, AdminDirectoryEntry | { id: string; state: 'GONE' }>()
  if (wanted.length === 0) return result
  type EntryRow = { id: string; kind: string; name: string; prefecture_code: string | null; website_url: string | null; corporate_number: string | null; claim_status: string; claimed_organization_id: string | null }
  const data = await inChunks<EntryRow>([...new Set(wanted.map((w) => w.entryId))], (chunk) => supabaseAdmin
    .from('directory_entries')
    .select('id, kind, name, prefecture_code, website_url, corporate_number, claim_status, claimed_organization_id')
    .in('id', chunk))
  const byId = new Map(data.map((e) => [e.id, e]))
  const names = await regionNames(data.flatMap((e) => (e.prefecture_code ? [e.prefecture_code] : [])))
  for (const { orgId, entryId } of wanted) {
    const e = byId.get(entryId)
    const state = claimState(e ? { kind: e.kind, claimStatus: e.claim_status, claimedOrganizationId: e.claimed_organization_id ?? null } : null, orgId)
    if (!e || state === 'GONE') {
      result.set(orgId, { id: entryId, state: 'GONE' })
      continue
    }
    result.set(orgId, {
      id: entryId,
      name: e.name,
      prefectureName: e.prefecture_code ? names.get(e.prefecture_code)?.local ?? e.prefecture_code : null,
      website: safeWebsite(e.website_url),
      corporateNumber: e.corporate_number ?? null,
      state,
    })
  }
  return result
}

// 運営の審査の画面に出す、登録で選んだ活動地域(全国か地域の名前の一覧)。登録が無い団体は入れない
export async function loadAdminServiceAreas(orgIds: string[]): Promise<Map<string, { nationwide: boolean; regionNames: string[] }>> {
  const result = new Map<string, { nationwide: boolean; regionNames: string[] }>()
  if (orgIds.length === 0) return result
  type AreaRow = { organization_id: string; region_code: string | null; is_nationwide: boolean }
  const data = await inChunks<AreaRow>(orgIds, (chunk) => supabaseAdmin.from('supporter_service_areas').select('organization_id, region_code, is_nationwide').in('organization_id', chunk))
  const rowsByOrg = new Map<string, ServiceAreaRow[]>()
  for (const r of data) {
    const list = rowsByOrg.get(r.organization_id) ?? []
    list.push({ region_code: r.region_code ?? null, is_nationwide: r.is_nationwide })
    rowsByOrg.set(r.organization_id, list)
  }
  const names = await regionNames(data.flatMap((r) => (r.region_code ? [r.region_code] : [])))
  for (const [orgId, rows] of rowsByOrg) {
    const areas = effectiveServiceAreas(rows, null)
    result.set(orgId, { nationwide: areas.nationwide, regionNames: areas.regionCodes.map((c) => names.get(c)?.local ?? c) })
  }
  return result
}
