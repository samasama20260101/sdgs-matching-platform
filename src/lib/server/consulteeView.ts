import 'server-only'

// 相談する側に見せる相談の中身(申し出・つなぎ先の同意・進み具合)。支え手の連絡先は持っていないので渡しようがない
import { supabaseAdmin } from '@/lib/supabase/server'
import { MAX_SUPPORTERS_PER_CASE } from '@/lib/domain/offers'
import type { CaseRow, OfferRow } from './caseAccess'

export type ConsulteeOffer = {
  id: string
  status: OfferRow['status']
  kind: OfferRow['supporter_kind']
  name: string
  orgType: string | null
  approved: boolean
  phoneVerified: boolean
  remoteOk: boolean
  message: string
  acceptedOrder: number | null
  invitedByName: string | null
  createdAt: string
}

export type ConsulteeCaseView = {
  id: string
  displayId: string
  title: string
  status: CaseRow['status']
  subjectType: CaseRow['subject_type']
  subjectName: string | null
  description: string
  indicators: string[]
  indicatorTexts: string[]
  since: string | null
  wish: string | null
  isMinor: boolean
  urgent: boolean
  createdAt: string
  supporterResolvedAt: string | null
  resolvedAt: string | null
  regionCode: string | null
  country: string | null
  offers: ConsulteeOffer[]
  acceptedCount: number
  maxSupporters: number
  consentedReferralIds: string[]
  thanked: boolean
}

export async function buildConsulteeView(c: CaseRow): Promise<ConsulteeCaseView> {
  const [{ data: offerRows, error: oErr }, { data: referrals, error: rErr }, { count: thanksCount, error: tErr }] = await Promise.all([
    supabaseAdmin
      .from('offers')
      .select('id, case_id, supporter_kind, supporter_user_id, supporter_organization_id, status, accepted_order, message, invited_by_offer_id, created_at')
      .eq('case_id', c.id)
      .in('status', ['PENDING', 'ACCEPTED'])
      .order('created_at', { ascending: true }),
    supabaseAdmin.from('case_referrals').select('directory_entry_id').eq('case_id', c.id).neq('status', 'WITHDRAWN'),
    supabaseAdmin.from('supporter_badges').select('id', { count: 'exact', head: true }).eq('case_id', c.id),
  ])
  if (oErr) throw oErr
  if (rErr) throw rErr
  if (tErr) throw tErr
  const offers = (offerRows ?? []) as OfferRow[]

  const orgIds = [...new Set([...offers.map((o) => o.supporter_organization_id), c.subject_organization_id].filter((v): v is string => Boolean(v)))]
  const individualIds = offers.filter((o) => o.supporter_kind === 'INDIVIDUAL').map((o) => o.supporter_user_id)
  const [{ data: orgs, error: gErr }, { data: profiles, error: pErr }] = await Promise.all([
    orgIds.length ? supabaseAdmin.from('organizations').select('id, name, org_type, vetting_status, remote_ok').in('id', orgIds) : Promise.resolve({ data: [], error: null }),
    individualIds.length ? supabaseAdmin.from('supporter_profiles').select('user_id, real_name, phone_verified_at, remote_ok').in('user_id', individualIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (gErr) throw gErr
  if (pErr) throw pErr
  const orgById = new Map((orgs ?? []).map((o) => [o.id as string, o]))
  const profileById = new Map((profiles ?? []).map((p) => [p.user_id as string, p]))

  const nameOf = (o: OfferRow) =>
    o.supporter_kind === 'ORGANIZATION'
      ? (orgById.get(o.supporter_organization_id ?? '')?.name as string | undefined) ?? '—'
      : (profileById.get(o.supporter_user_id)?.real_name as string | undefined) ?? '—'
  const byId = new Map(offers.map((o) => [o.id, o]))

  const view: ConsulteeOffer[] = offers.map((o) => {
    const org = o.supporter_organization_id ? orgById.get(o.supporter_organization_id) : undefined
    const profile = o.supporter_kind === 'INDIVIDUAL' ? profileById.get(o.supporter_user_id) : undefined
    const inviter = o.invited_by_offer_id ? byId.get(o.invited_by_offer_id) : undefined
    return {
      id: o.id,
      status: o.status,
      kind: o.supporter_kind,
      name: nameOf(o),
      orgType: (org?.org_type as string | undefined) ?? null,
      approved: org?.vetting_status === 'APPROVED',
      phoneVerified: Boolean(profile?.phone_verified_at),
      remoteOk: Boolean(org?.remote_ok ?? profile?.remote_ok),
      message: o.message,
      acceptedOrder: o.accepted_order,
      invitedByName: inviter ? nameOf(inviter) : null,
      createdAt: o.created_at,
    }
  })
  const intake = c.intake_qna ?? {}
  return {
    id: c.id,
    displayId: c.display_id,
    title: c.title,
    status: c.status,
    subjectType: c.subject_type,
    subjectName: c.subject_organization_id ? ((orgById.get(c.subject_organization_id)?.name as string | undefined) ?? null) : null,
    description: c.description_free,
    indicators: intake.indicators ?? [],
    indicatorTexts: intake.indicator_texts ?? [],
    since: intake.since ?? null,
    wish: intake.wish ?? null,
    isMinor: c.is_minor,
    urgent: c.urgency === 'High',
    createdAt: c.created_at,
    supporterResolvedAt: c.supporter_resolved_at,
    resolvedAt: c.resolved_at,
    regionCode: c.region_code,
    country: c.region_country,
    offers: view,
    acceptedCount: view.filter((o) => o.status === 'ACCEPTED').length,
    maxSupporters: MAX_SUPPORTERS_PER_CASE,
    consentedReferralIds: (referrals ?? []).map((r) => r.directory_entry_id as string),
    thanked: (thanksCount ?? 0) > 0,
  }
}
