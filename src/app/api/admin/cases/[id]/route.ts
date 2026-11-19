// 運営｜相談の中身(運営への知らせのリンクの行き先)。2つ目の確認まで済んだ運営だけが読める。
// GET: 番号・状態・主体・印・分野と指標・AI の分類・本文・入口・言語と地域・申し出・つなぎ先の同意
// PATCH { sensitive }: 機微の扱いを運営が直す(AI で分類できず機微にした相談など。#133)。理由の付け方は src/lib/domain/sensitivity.ts
// 相談の時点の AI の要約は作らなくなった(#134)。前に作った要約も出さない(本文をそのまま読む)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { optionsFor, type SubjectType } from '@/lib/domain/intake'
import { normalizeReasons, setSensitivityByAdmin } from '@/lib/domain/sensitivity'
import { areaLabels } from '@/lib/server/opsNotifyFormat'

const patchSchema = z.object({ sensitive: z.boolean() })

const CASE_COLUMNS = 'id, display_id, title, status, subject_type, subject_organization_id, proxy_organization_id, description_free, intake_qna, urgency, is_minor, is_sensitive, sensitive_reasons, region_country, region_code, city, locale, entry_channel, entry_code, created_at, escalated_at, supporter_resolved_at, resolved_at, ai_sdg_suggestion'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: c, error } = await supabaseAdmin.from('cases').select(CASE_COLUMNS).eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [indicators, offers, referrals, region, suggestions] = await Promise.all([
    supabaseAdmin.from('case_indicators').select('indicator_code, source, status, confidence, reason').eq('case_id', id).order('created_at', { ascending: true }),
    supabaseAdmin.from('offers').select('id, supporter_kind, supporter_user_id, supporter_organization_id, status, accepted_order, created_at').eq('case_id', id).order('created_at', { ascending: true }),
    supabaseAdmin.from('case_referrals').select('status, consented_at, directory_entries(name, phone, kind, website_url)').eq('case_id', id),
    c.region_code ? supabaseAdmin.from('regions').select('name_local').eq('code', c.region_code).maybeSingle() : Promise.resolve({ data: null, error: null }),
    // 相談者に提案した支援団体(#138)
    supabaseAdmin.from('case_suggestions').select('rank, reason, method, directory_entries(name, phone, website_url)').eq('case_id', id).order('rank', { ascending: true }),
  ])
  const failed = indicators.error ?? offers.error ?? referrals.error ?? region.error ?? suggestions.error
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
  const intake = (c.intake_qna ?? {}) as { indicators?: string[]; indicator_source?: string; since?: string | null; wish?: string | null; proxy_display_name?: string }
  // 分類の記録(version 4、#133)。前の版(相談の時点の要約)の記録はモデル名だけ使う
  const ai = c.ai_sdg_suggestion as { version?: number; kind?: string; urgent?: boolean; sensitive?: boolean; model?: string; generated_at?: string } | null
  const classification = ai?.kind === 'CLASSIFICATION' ? { urgent: ai.urgent === true, sensitive: ai.sensitive === true, model: ai.model ?? null, generatedAt: ai.generated_at ?? null } : null

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
      sensitiveReasons: normalizeReasons(c.sensitive_reasons),
      areas: areaLabels(subject, intake.indicators ?? []),
      indicatorsBy: intake.indicator_source === 'AI' ? 'AI' : 'SELF',
      indicators: (indicators.data ?? []).map((i) => ({ code: i.indicator_code, text: text.get(i.indicator_code as string) ?? i.indicator_code, source: i.source, status: i.status, confidence: i.confidence, reason: i.reason })),
      classification,
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
      const e = r.directory_entries as unknown as { name: string; phone: string | null; kind: string; website_url: string | null } | null
      return { status: r.status, consentedAt: r.consented_at, name: e?.name ?? '—', phone: e?.phone ?? null, website: e?.website_url ?? null }
    }),
    suggestions: (suggestions.data ?? []).map((r) => {
      const e = r.directory_entries as unknown as { name: string; phone: string | null; website_url: string | null } | null
      return { rank: r.rank as number, reason: (r.reason as string | null) ?? null, method: r.method as string, name: e?.name ?? '—', phone: e?.phone ?? null, website: e?.website_url ?? null }
    }),
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const { data: c, error } = await supabaseAdmin.from('cases').select('id, display_id, is_sensitive, sensitive_reasons').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const before = normalizeReasons(c.sensitive_reasons)
  const next = setSensitivityByAdmin(before, parsed.data.sensitive)
  // 読んだときの扱いのままのときだけ書く(毎日の処理がその間に機微へ上げていたら、古い画面のまま外さない)
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('cases')
    .update({ is_sensitive: next.isSensitive, sensitive_reasons: next.reasons })
    .eq('id', id)
    .eq('is_sensitive', c.is_sensitive)
    .select('id')
    .maybeSingle()
  if (updateError) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'ほかの操作と重なりました。読み直してください', code: 'CONFLICT' }, { status: 409 })
  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.appUser.id,
    action: 'admin.case_sensitivity',
    target_table: 'cases',
    target_id: id,
    metadata: { display_id: c.display_id, before: { is_sensitive: c.is_sensitive, reasons: before }, after: next },
  })
  return NextResponse.json({ isSensitive: next.isSensitive, sensitiveReasons: next.reasons })
}
