import 'server-only'

// 相談に、だれがどの立場で関われるか(相談する側・選ばれた支え手)。やりとりと相談の詳細の API はここを通す。
// 支える側から相談を「さがす」ときの見える範囲は src/lib/domain/visibility.ts(選ばれる前の話)。
//   相談する側: 本人の相談の持ち主 / 会社・地域の相談の団体に今いるメンバー / 代理登録の団体(本人が引き継ぐまで)
//   選ばれた支え手: 選ばれた(ACCEPTED)個人の支え手 / 選ばれた団体に今いるメンバー(抜けた日から読めない、盤 65)
import { supabaseAdmin } from '@/lib/supabase/server'

export const CASE_COLUMNS =
  'id, display_id, owner_user_id, assignee_user_id, subject_type, subject_organization_id, proxy_organization_id, title, description_free, status, visibility, urgency, intake_qna, ai_sdg_suggestion, is_sensitive, is_minor, affected_population, region_country, region_code, city, locale, created_at, started_at, resolved_at, supporter_resolved_at, entry_code'

export type CaseRow = {
  id: string
  display_id: string
  owner_user_id: string | null
  assignee_user_id: string | null
  subject_type: 'PERSON' | 'COMPANY' | 'COMMUNITY' | 'NATION'
  subject_organization_id: string | null
  proxy_organization_id: string | null
  title: string
  description_free: string
  status: 'OPEN' | 'MATCHED' | 'RESOLVED' | 'CLOSED' | 'CANCELLED'
  visibility: string
  urgency: string | null
  intake_qna: { indicators?: string[]; indicator_texts?: string[]; since?: string | null; wish?: string | null } | null
  ai_sdg_suggestion: { title?: string; summary?: string } | null
  is_sensitive: boolean
  is_minor: boolean
  affected_population: number
  region_country: string | null
  region_code: string | null
  city: string | null
  locale: string
  created_at: string
  started_at: string | null
  resolved_at: string | null
  supporter_resolved_at: string | null
  entry_code: string | null
}

export type OfferRow = {
  id: string
  case_id: string
  supporter_kind: 'ORGANIZATION' | 'INDIVIDUAL'
  supporter_user_id: string
  supporter_organization_id: string | null
  status: 'PENDING' | 'INVITED' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN'
  accepted_order: number | null
  message: string
  invited_by_offer_id: string | null
  created_at: string
}

export type CaseAccess =
  | { role: 'CONSULTEE'; caseRow: CaseRow; canDecide: boolean }
  | { role: 'SUPPORTER'; caseRow: CaseRow; offer: OfferRow; organizationId: string | null; isLead: boolean }

async function activeOrgIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
  if (error) throw error
  return new Set((data ?? []).map((m) => m.organization_id as string))
}

export async function loadCase(caseId: string): Promise<CaseRow | null> {
  const { data, error } = await supabaseAdmin.from('cases').select(CASE_COLUMNS).eq('id', caseId).maybeSingle<CaseRow>()
  if (error) throw error
  return data
}

export async function resolveCaseAccess(userId: string, caseId: string): Promise<CaseAccess | null> {
  const caseRow = await loadCase(caseId)
  if (!caseRow) return null
  const orgIds = await activeOrgIds(userId)

  if (caseRow.subject_type === 'PERSON' && caseRow.owner_user_id === userId) {
    return { role: 'CONSULTEE', caseRow, canDecide: true }
  }
  if (caseRow.subject_organization_id && orgIds.has(caseRow.subject_organization_id)) {
    // 申し出を選ぶ・解決を確定するのは担当者(替わったら管理者が付け替える)
    return { role: 'CONSULTEE', caseRow, canDecide: caseRow.assignee_user_id === userId }
  }
  if (!caseRow.owner_user_id && caseRow.proxy_organization_id && orgIds.has(caseRow.proxy_organization_id)) {
    // 代理の相談は、登録した人(担当者)が本人に代わって選ぶ
    return { role: 'CONSULTEE', caseRow, canDecide: caseRow.assignee_user_id === userId }
  }

  const { data: offers, error } = await supabaseAdmin
    .from('offers')
    .select('id, case_id, supporter_kind, supporter_user_id, supporter_organization_id, status, accepted_order, message, invited_by_offer_id, created_at')
    .eq('case_id', caseId)
    .eq('status', 'ACCEPTED')
  if (error) throw error
  const accepted = (offers ?? []) as OfferRow[]
  const mine = accepted.find((o) =>
    (o.supporter_kind === 'INDIVIDUAL' && o.supporter_user_id === userId)
    || (o.supporter_kind === 'ORGANIZATION' && o.supporter_organization_id !== null && orgIds.has(o.supporter_organization_id)))
  if (!mine) return null
  return { role: 'SUPPORTER', caseRow, offer: mine, organizationId: mine.supporter_organization_id, isLead: mine.accepted_order === 1 }
}
