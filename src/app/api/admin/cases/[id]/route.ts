// 運営｜相談の中身(運営への知らせのリンクの行き先)。2つ目の確認まで済んだ運営だけが読める。
// 番号・状態・主体・印・分野と選んだもの・AI の整理・本文・入口・言語と地域・申し出・つなぎ先の同意
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { optionsFor, type SubjectType } from '@/lib/domain/intake'
import { areaLabels } from '@/lib/server/opsNotifyFormat'

const CASE_COLUMNS = 'id, display_id, title, status, subject_type, subject_organization_id, proxy_organization_id, description_free, intake_qna, urgency, is_minor, is_sensitive, sensitive_reasons, region_country, region_code, city, locale, entry_channel, entry_code, created_at, escalated_at, supporter_resolved_at, resolved_at, ai_sdg_suggestion'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: c, error } = await supabaseAdmin.from('cases').select(CASE_COLUMNS).eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [indicators, offers, referrals, region] = await Promise.all([
    supabaseAdmin.from('case_indicators').select('indicator_code, source, status, confidence, reason').eq('case_id', id).order('created_at', { ascending: true }),
    supabaseAdmin.from('offers').select('id, supporter_kind, supporter_user_id, supporter_organization_id, status, accepted_order, created_at').eq('case_id', id).order('created_at', { ascending: true }),
    supabaseAdmin.from('case_referrals').select('status, consented_at, directory_entries(name, phone, kind)').eq('case_id', id),
    c.region_code ? supabaseAdmin.from('regions').select('name_local').eq('code', c.region_code).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  const failed = indicators.error ?? offers.error ?? referrals.error ?? region.error
  if (failed) {
    console.error('[api/admin/cases/[id]]', failed)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }

  const offerRows = offers.data ?? []
  const orgIds = [...new Set([c.subject_organization_id, c.proxy_organization_id, ...offerRows.map((o) => o.supporter_organization_id)].filter((v): v is string => Boolean(v)))]
  const individualIds = offerRows.filter((o) => o.supporter_kind === 'INDIVIDUAL').map((o) => o.supporter_user_id as string)
  const [orgs, profiles] = await Promise.all([
    orgIds.length ? supabaseAdmin.from('organizations').select('id, name').in('id', orgIds) : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    individualIds.length ? supabaseAdmin.from('supporter_profiles').select('user_id, real_name').in('user_id', individualIds) : Promise.resolve({ data: [] as { user_id: string; real_name: string }[], error: null }),
  ])
  if (orgs.error ?? profiles.error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  const orgName = new Map((orgs.data ?? []).map((o) => [o.id as string, o.name as string]))
  const personName = new Map((profiles.data ?? []).map((p) => [p.user_id as string, p.real_name as string]))

  const subject = c.subject_type as SubjectType
  const text = new Map(optionsFor(subject).map((o) => [o.id, o.text]))
  const intake = (c.intake_qna ?? {}) as { indicators?: string[]; since?: string | null; wish?: string | null; proxy_display_name?: string }
  const ai = c.ai_sdg_suggestion as { title?: string; summary?: string; provider?: string; model?: string } | null

  return NextResponse.json({
    case: {
      id: c.id,
      displayId: c.display_id,
      title: c.title,
      status: c.status,
      subjectType: subject,
      subjectName: c.subject_organization_id ? orgName.get(c.subject_organization_id) ?? null : null,
      urgent: c.urgency === 'High',
      isMinor: c.is_minor,
      isSensitive: c.is_sensitive,
      sensitiveReasons: c.sensitive_reasons ?? [],
      areas: areaLabels(subject, intake.indicators ?? []),
      indicators: (indicators.data ?? []).map((i) => ({ code: i.indicator_code, text: text.get(i.indicator_code as string) ?? i.indicator_code, source: i.source, status: i.status, confidence: i.confidence, reason: i.reason })),
      aiSummary: ai?.summary ?? null,
      aiModel: ai?.model ?? null,
      description: c.description_free,
      since: intake.since ?? null,
      wish: intake.wish ?? null,
      entryChannel: c.entry_channel,
      entryCode: c.entry_code,
      proxyName: c.proxy_organization_id ? orgName.get(c.proxy_organization_id) ?? null : null,
      proxyDisplayName: intake.proxy_display_name ?? null,
      locale: c.locale,
      country: c.region_country,
      regionName: (region.data?.name_local as string | undefined) ?? c.region_code,
      city: c.city,
      createdAt: c.created_at,
      escalatedAt: c.escalated_at,
      supporterResolvedAt: c.supporter_resolved_at,
      resolvedAt: c.resolved_at,
    },
    offers: offerRows.map((o) => ({
      id: o.id,
      kind: o.supporter_kind,
      name: o.supporter_kind === 'ORGANIZATION' ? orgName.get(o.supporter_organization_id as string) ?? '—' : personName.get(o.supporter_user_id as string) ?? '—',
      status: o.status,
      acceptedOrder: o.accepted_order,
      createdAt: o.created_at,
    })),
    referrals: (referrals.data ?? []).map((r) => {
      const e = r.directory_entries as unknown as { name: string; phone: string | null; kind: string } | null
      return { status: r.status, consentedAt: r.consented_at, name: e?.name ?? '—', phone: e?.phone ?? null }
    }),
  })
}
