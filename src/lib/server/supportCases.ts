import 'server-only'

// 支える側から見える相談(盤 20・22)。見える範囲は src/lib/domain/visibility.ts だけで決める。
// 顔(立場)は「団体の一員として(どの団体か)」か「個人として」。URL の face=org:<id> / face=individual
import { supabaseAdmin } from '@/lib/supabase/server'
import { offerBlock, supporterCaseAccess, type CaseAccess as Access, type OfferBlock, type SupporterFace } from '@/lib/domain/visibility'
import { optionsFor } from '@/lib/domain/intake'
import { caseAreaGoals, isAreaSubject, type AreaSubject } from '@/lib/domain/supportAreas'
import { stripConsolation } from '@/lib/ai/prompts/caseSummary'
import type { LastMessage } from '@/lib/domain/talk'
import { lastMessagesFor } from './lastMessages'
import { CASE_COLUMNS, type CaseRow, type OfferRow } from './caseAccess'

export type FaceKey = { kind: 'ORGANIZATION'; organizationId: string } | { kind: 'INDIVIDUAL' }

export function parseFaceParam(value: string | null): FaceKey | null {
  if (!value) return null
  if (value === 'individual') return { kind: 'INDIVIDUAL' }
  const m = /^org:([0-9a-f-]{36})$/i.exec(value)
  return m ? { kind: 'ORGANIZATION', organizationId: m[1].toLowerCase() } : null
}

export { requireMfaForSensitive } from './mfaPolicy'
import { requireMfaForSensitive } from './mfaPolicy'
import { effectiveServiceAreas, type ServiceAreaRow } from '@/lib/domain/serviceAreas'

export type ResolvedFace = { face: SupporterFace; key: FaceKey; label: string; phoneVerified: boolean; regionCodes: string[]; country: string; nationwide: boolean; coordinatorRegions: string[] }

// 顔を確かめる(その団体に今いるか・個人の支え手として登録しているか)。活動地域も一緒に読む。
// 支える側の API は毎回ここを通るので、その顔の分だけを 1 回の往復(並べた問い合わせ)で読む(性能のレビュー 11/5)。
// 決まりは loadFaces と同じ: 所属は ACTIVE、団体は ARCHIVED でない、コーディネーターは承認済みの団体だけ
type FaceMembershipRow = { organizations: { name: string; vetting_status: string; status: string; region_country: string | null; prefecture: string | null } | null }

export async function resolveFace(userId: string, key: FaceKey, aal: 'aal1' | 'aal2'): Promise<ResolvedFace | null> {
  if (key.kind === 'INDIVIDUAL') {
    const { data: p, error } = await supabaseAdmin
      .from('supporter_profiles')
      .select('real_name, phone_verified_at, status, region_country, region_code')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    if (!p) return null
    return {
      face: { kind: 'INDIVIDUAL', userId, profileActive: p.status !== 'SUSPENDED' },
      key,
      label: p.real_name as string,
      phoneVerified: Boolean(p.phone_verified_at),
      regionCodes: p.region_code ? [p.region_code as string] : [],
      country: (p.region_country as string | null) ?? 'JP',
      nationwide: false,
      coordinatorRegions: [],
    }
  }
  const [membership, areas, scopes] = await Promise.all([
    supabaseAdmin
      .from('organization_memberships')
      .select('organizations(name, vetting_status, status, region_country, prefecture)')
      .eq('user_id', userId)
      .eq('organization_id', key.organizationId)
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.from('supporter_service_areas').select('region_code, is_nationwide').eq('organization_id', key.organizationId),
    supabaseAdmin.from('coordinator_scopes').select('region_code').eq('organization_id', key.organizationId),
  ])
  const failed = membership.error ?? areas.error ?? scopes.error
  if (failed) throw failed
  const org = (membership.data as FaceMembershipRow | null)?.organizations
  if (!org || org.status === 'ARCHIVED') return null
  const approved = org.vetting_status === 'APPROVED'
  // 活動地域の決まりは公開の団体ページと同じ(登録した地域だけ。なければ申し込みのときの都道府県)
  const served = effectiveServiceAreas((areas.data ?? []) as ServiceAreaRow[], org.prefecture)
  return {
    face: {
      kind: 'ORGANIZATION',
      userId,
      organizationId: key.organizationId,
      organizationApproved: approved,
      membershipActive: true,
      mfaVerified: aal === 'aal2',
    },
    key,
    label: org.name,
    phoneVerified: true,
    regionCodes: served.regionCodes,
    country: org.region_country ?? 'JP',
    nationwide: served.nationwide,
    coordinatorRegions: approved ? (scopes.data ?? []).map((x) => x.region_code as string).filter(Boolean) : [],
  }
}

function myOffer(offers: OfferRow[], rf: ResolvedFace): OfferRow | undefined {
  return offers.find((o) =>
    rf.face.kind === 'INDIVIDUAL'
      ? o.supporter_kind === 'INDIVIDUAL' && o.supporter_user_id === rf.face.userId
      : o.supporter_kind === 'ORGANIZATION' && o.supporter_organization_id === rf.face.organizationId)
}

export type SupportCaseItem = {
  id: string
  locked: boolean
  title: string | null
  summary: string | null
  status: CaseRow['status']
  subjectType: CaseRow['subject_type']
  subjectName: string | null
  indicators: { code: string; text: string; source: 'SELF' | 'AI'; status: string }[]
  // 支える側の大項目(相談した人の種類ごとの名前で出す。src/lib/domain/supportAreas.ts)
  areaGoals: number[]
  urgent: boolean
  isMinor: boolean
  isSensitive: boolean
  regionCode: string | null
  // 地域の名前(regions の name_local と name_en)。札に「JP-13」と出さない(画面の見直し 所見 3)
  regionName: { local: string; en: string | null } | null
  country: string | null
  language: string
  waitingHours: number
  offersCount: number
  myOfferStatus: OfferRow['status'] | null
  // 関わっている相談の一覧(やりとり・ホーム)でだけ入れる
  lastMessage?: LastMessage | null
  createdAt: string
  canOffer: boolean
  // 申し出られない理由(画面の案内の出し分け)。申し出られるなら null
  offerBlock: OfferBlock | null
}

function indicatorText(subject: CaseRow['subject_type'], code: string): string {
  return optionsFor(subject).find((o) => o.id === code)?.text ?? code
}

async function decorate(rows: CaseRow[], rf: ResolvedFace, nowMs: number): Promise<SupportCaseItem[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const orgIds = [...new Set(rows.map((r) => r.subject_organization_id).filter((v): v is string => Boolean(v)))]
  // 地域は外部キーの JOIN を使わず、2 回に分けて取る(AGENTS.md)
  const regionCodes = [...new Set(rows.map((r) => r.region_code).filter((v): v is string => Boolean(v)))]
  const [{ data: offers }, { data: indicators }, { data: orgs }, { data: regions }] = await Promise.all([
    supabaseAdmin.from('offers').select('id, case_id, supporter_kind, supporter_user_id, supporter_organization_id, status, accepted_order, message, invited_by_offer_id, created_at').in('case_id', ids),
    supabaseAdmin.from('case_indicators').select('case_id, indicator_code, source, status').in('case_id', ids).in('source', ['SELF', 'AI']).neq('status', 'REJECTED'),
    orgIds.length ? supabaseAdmin.from('organizations').select('id, name').in('id', orgIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    regionCodes.length ? supabaseAdmin.from('regions').select('code, name_local, name_en').in('code', regionCodes) : Promise.resolve({ data: [] as { code: string; name_local: string; name_en: string | null }[] }),
  ])
  const regionName = new Map((regions ?? []).map((r) => [r.code as string, { local: r.name_local as string, en: (r.name_en as string | null) ?? null }]))
  const byCase = new Map<string, OfferRow[]>()
  for (const o of (offers ?? []) as OfferRow[]) byCase.set(o.case_id, [...(byCase.get(o.case_id) ?? []), o])
  const indByCase = new Map<string, { indicator_code: string; source: 'SELF' | 'AI'; status: string }[]>()
  for (const i of indicators ?? []) indByCase.set(i.case_id as string, [...(indByCase.get(i.case_id as string) ?? []), i as { indicator_code: string; source: 'SELF' | 'AI'; status: string }])
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]))

  return rows.flatMap((c) => {
    const caseOffers = byCase.get(c.id) ?? []
    const mine = myOffer(caseOffers, rf)
    const involved = Boolean(mine && ['PENDING', 'INVITED', 'ACCEPTED'].includes(mine.status))
    const access: Access = supporterCaseAccess(c, rf.face, { involved, requireMfaForSensitive: requireMfaForSensitive() })
    if (access === 'NONE') return []
    const locked = access === 'LOCKED'
    const block = offerBlock(c, rf.face, { alreadyOffered: Boolean(mine && mine.status !== 'WITHDRAWN' && mine.status !== 'DECLINED'), phoneVerified: rf.phoneVerified, requireMfaForSensitive: requireMfaForSensitive() })
    return [{
      id: c.id,
      locked,
      title: locked ? null : c.title,
      // v1 の頃に作った要約には、相談した人に向けた共感の文が入っているので、表示のときに除く(画面の見直し 所見 4)
      summary: locked || !c.ai_sdg_suggestion?.summary ? null : stripConsolation(c.ai_sdg_suggestion.summary),
      status: c.status,
      subjectType: c.subject_type,
      // 2つ目の確認がまだ(LOCKED)なら、相談した団体の名前・地域・印・言語・申し出の数も出さない(セキュリティのレビュー 11/5)
      subjectName: !locked && c.subject_organization_id ? orgName.get(c.subject_organization_id) ?? null : null,
      indicators: locked ? [] : (indByCase.get(c.id) ?? []).map((i) => ({ code: i.indicator_code, text: indicatorText(c.subject_type, i.indicator_code), source: i.source, status: i.status })),
      areaGoals: locked || !isAreaSubject(c.subject_type) ? [] : caseAreaGoals(c.subject_type, (indByCase.get(c.id) ?? []).map((i) => i.indicator_code)),
      urgent: !locked && c.urgency === 'High',
      isMinor: !locked && c.is_minor,
      isSensitive: !locked && c.is_sensitive,
      regionCode: locked ? null : c.region_code,
      regionName: !locked && c.region_code ? regionName.get(c.region_code) ?? null : null,
      country: locked ? null : c.region_country,
      language: locked ? '' : c.locale,
      waitingHours: Math.max(0, Math.floor((nowMs - new Date(c.created_at).getTime()) / 3_600_000)),
      createdAt: c.created_at,
      offersCount: locked ? 0 : caseOffers.filter((o) => ['PENDING', 'ACCEPTED'].includes(o.status)).length,
      myOfferStatus: mine?.status ?? null,
      canOffer: block === null,
      offerBlock: block,
    }]
  })
}

// escalated: コーディネーターの一覧(その地域で 24 時間申し出のない相談、盤 05「地域のコーディネーターの一覧に回す」)
// offset: 何件目から(待っている時間が長い順 = 届いた順)。1 回に FIND_PAGE_SIZE 件
export type FindFilters = { subject: AreaSubject | null; category: number | null; includeRemote: boolean; involvement: 'all' | 'notOffered' | 'mine'; escalated?: boolean; offset?: number }
export const FIND_PAGE_SIZE = 50

// 絞り込みは DB の中で行い、件数で切る前に絞る(性能のレビュー 11/5: 古い順の 200 件で切ってから JS で絞っていたので、
// 受付中の相談が 200 件を超えると新しい相談が出なくなり、大項目で絞ると 0 件に見えることもあった)
export async function findCases(rf: ResolvedFace, filters: FindFilters): Promise<{ items: SupportCaseItem[]; hasMore: boolean; nextOffset: number }> {
  const none = { items: [], hasMore: false, nextOffset: 0 }
  let q = supabaseAdmin.from('cases').select(CASE_COLUMNS).in('status', ['OPEN', 'MATCHED']).eq('visibility', 'LISTED')
  if (filters.escalated) {
    if (rf.coordinatorRegions.length === 0) return none
    q = q.eq('status', 'OPEN').not('escalated_at', 'is', null).in('region_code', rf.coordinatorRegions)
  } else if (!filters.includeRemote && !rf.nationwide && rf.regionCodes.length > 0) {
    // 地域: 活動地域の相談だけ。全国対応・遠隔を含めるときは地域で絞らない
    q = q.in('region_code', rf.regionCodes)
  }
  if (rf.face.kind === 'INDIVIDUAL') q = q.in('subject_type', ['COMPANY', 'COMMUNITY']).eq('is_sensitive', false).eq('is_minor', false)
  if (filters.subject) {
    if (rf.face.kind === 'INDIVIDUAL' && filters.subject === 'PERSON') return none
    q = q.eq('subject_type', filters.subject)
  }
  // 大項目: その種類の、その大項目の選択肢のどれかを相談した人が選んでいる(intake_qna.indicators に入っている)
  if (filters.category !== null) {
    const subjects: AreaSubject[] = filters.subject ? [filters.subject] : ['PERSON', 'COMPANY', 'COMMUNITY']
    const codes = [...new Set(subjects.flatMap((sub) => optionsFor(sub).filter((o) => o.category === filters.category).map((o) => o.id)))]
    if (codes.length === 0) return none
    q = q.or(codes.map((code) => `intake_qna->indicators.cs.["${code}"]`).join(','))
  }
  // 関わり: 自分の顔の申し出で絞る
  if (filters.involvement !== 'all') {
    let oq = supabaseAdmin.from('offers').select('case_id, status')
    oq = rf.face.kind === 'INDIVIDUAL' ? oq.eq('supporter_kind', 'INDIVIDUAL').eq('supporter_user_id', rf.face.userId) : oq.eq('supporter_organization_id', rf.face.organizationId)
    const { data: mine, error: oErr } = await oq.limit(1000)
    if (oErr) throw oErr
    if (filters.involvement === 'mine') {
      const ids = (mine ?? []).filter((o) => ['PENDING', 'INVITED', 'ACCEPTED'].includes(o.status as string)).map((o) => o.case_id as string)
      if (ids.length === 0) return none
      q = q.in('id', ids)
    } else {
      // まだ申し出ていない: 取り下げたものは、もう一度申し出られるので残す
      const ids = (mine ?? []).filter((o) => o.status !== 'WITHDRAWN').map((o) => o.case_id as string)
      if (ids.length > 0) q = q.not('id', 'in', `(${ids.join(',')})`)
    }
  }
  const offset = Math.max(0, Math.floor(filters.offset ?? 0))
  const { data, error } = await q.order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + FIND_PAGE_SIZE - 1)
  if (error) throw error
  const rows = (data ?? []) as CaseRow[]
  const items = await decorate(rows, rf, Date.now())
  // 待っている時間が長い順(盤 22)。DB の並び(届いた順)と同じ
  // 見えない相談は decorate で落ちるので、続きの位置は DB の行の数で返す
  return { items: items.sort((a, b) => b.waitingHours - a.waitingHours), hasMore: rows.length === FIND_PAGE_SIZE, nextOffset: offset + rows.length }
}

// 自分の顔で関わっている相談(申し出中・選ばれた・招かれた)。受付が終わったものも含む
export async function involvedCases(rf: ResolvedFace): Promise<SupportCaseItem[]> {
  let q = supabaseAdmin.from('offers').select('case_id').in('status', ['PENDING', 'INVITED', 'ACCEPTED'])
  q = rf.face.kind === 'INDIVIDUAL' ? q.eq('supporter_kind', 'INDIVIDUAL').eq('supporter_user_id', rf.face.userId) : q.eq('supporter_organization_id', rf.face.organizationId)
  const { data: offers, error } = await q.limit(200)
  if (error) throw error
  const ids = [...new Set((offers ?? []).map((o) => o.case_id as string))]
  if (ids.length === 0) return []
  const { data, error: cErr } = await supabaseAdmin.from('cases').select(CASE_COLUMNS).in('id', ids).order('updated_at', { ascending: false })
  if (cErr) throw cErr
  const items = await decorate((data ?? []) as CaseRow[], rf, Date.now())
  // やりとりを読めるのは選ばれた(ACCEPTED)支え手だけ(caseAccess.ts と同じ)。申し出中・招かれただけの相談には付けない
  const readable = items.filter((i) => !i.locked && i.myOfferStatus === 'ACCEPTED').map((i) => i.id)
  const last = await lastMessagesFor(readable)
  return items.map((i) => ({ ...i, lastMessage: readable.includes(i.id) ? last.get(i.id) ?? null : null }))
}

export async function loadSupportCase(rf: ResolvedFace, caseId: string) {
  const { data, error } = await supabaseAdmin.from('cases').select(CASE_COLUMNS).eq('id', caseId).maybeSingle<CaseRow>()
  if (error) throw error
  if (!data) return null
  const [item] = await decorate([data], rf, Date.now())
  if (!item || item.locked) return item ? { item, caseRow: null, mine: null } : null
  const { data: offers } = await supabaseAdmin
    .from('offers')
    .select('id, case_id, supporter_kind, supporter_user_id, supporter_organization_id, status, accepted_order, message, invited_by_offer_id, created_at')
    .eq('case_id', caseId)
  const mine = myOffer((offers ?? []) as OfferRow[], rf) ?? null
  return { item, caseRow: data, mine }
}
