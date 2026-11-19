// 相談に合う支援団体の提案(#138、盤 13 の置き換え)。
// GET: 提案した支援団体 3 つと、緊急と判定した相談にだけ全国の電話窓口 / POST: 「運営から伝えてもらう」を選ぶ
// 運営の担当者が支援団体の受付(電話や問い合わせフォーム)から伝える。自動のメールにはしない(2026-11-19 定例)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { resolveCaseAccess } from '@/lib/server/caseAccess'
import { fitsAudience } from '@/lib/domain/referrals'
import { EMERGENCY_HOTLINE_LIMIT, displayChannels, emergencyHotlinesFor, goalsOf } from '@/lib/domain/suggestions'
import { generateSuggestions, loadSuggestions, type SavedSuggestion } from '@/lib/server/suggestions'
import { notifyOps } from '@/lib/server/opsNotify'

// 届けた直後は応答のあとの処理が提案を作っているので、この間は画面に待ってもらう(その場で二重に AI を呼ばない)
const PENDING_WINDOW_MS = 45_000

type Hotline = { id: string; name: string; categories: string[]; phone: string | null; website_url: string | null; hours_text: string | null; sdgs_goals: number[]; attribution: string | null; source_url: string }

function presentSuggestion(s: SavedSuggestion, e: NonNullable<SavedSuggestion['entry']>, locale: string) {
  // 電話番号は、出典で照合が取れたものだけ出す(決めてほしいこと 7)
  const phoneOk = e.verification_status === 'SOURCE_OFFICIAL' || e.verification_status === 'VERIFIED'
  return {
    id: e.id,
    kind: e.kind,
    name: e.name,
    // 理由は相談者の言語で AI が書く。AI が使えなかったときは、日本語の画面にだけ調べた要約を出す
    reason: s.reason ?? (locale === 'ja' ? e.consult_summary : null),
    channels: displayChannels(e.consult_channels ?? []),
    phone: phoneOk ? e.phone : null,
    website: e.website_url,
    hours: e.hours_text,
    unregistered: e.claim_status !== 'CLAIMED',
    canShare: e.kind !== 'NATIONAL_HOTLINE',
    attribution: e.attribution,
    sourceUrl: e.source_url,
  }
}

function presentHotline(h: Hotline) {
  return { id: h.id, name: h.name, phone: h.phone, website: h.website_url, hours: h.hours_text, attribution: h.attribution, sourceUrl: h.source_url }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const access = await resolveCaseAccess(auth.appUser.id, id, auth.aal).catch(() => null)
  if (!access || access.role !== 'CONSULTEE') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const c = access.caseRow
  if (c.status !== 'OPEN') return NextResponse.json({ pending: false, suggestions: [], emergency: [] })

  // 緊急と判定した個人の相談にだけ、相談の大項目に近い全国の電話窓口を出す
  let emergency: ReturnType<typeof presentHotline>[] = []
  const hotlines = emergencyHotlinesFor(c.subject_type, c.urgency === 'High')
  if (hotlines.show && (c.region_country ?? 'JP') === 'JP') {
    const { data, error } = await supabaseAdmin.from('directory_entries').select('id, name, categories, phone, website_url, hours_text, sdgs_goals, attribution, source_url').eq('visibility', 'PUBLIC').eq('kind', 'NATIONAL_HOTLINE')
    if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    const goals = new Set(goalsOf(c.intake_qna?.indicators ?? []))
    const near = (h: Hotline) => (h.sdgs_goals ?? []).filter((g) => goals.has(g)).length
    emergency = ((data ?? []) as Hotline[])
      .filter((h) => fitsAudience(h.categories ?? [], hotlines.audience))
      .sort((a, b) => near(b) - near(a) || a.name.localeCompare(b.name, 'ja'))
      .slice(0, EMERGENCY_HOTLINE_LIMIT)
      .map(presentHotline)
  }

  const { data: meta, error: metaError } = await supabaseAdmin.from('cases').select('suggestions_generated_at').eq('id', id).single()
  if (metaError) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  if (!meta.suggestions_generated_at) {
    if (Date.now() - Date.parse(c.created_at) < PENDING_WINDOW_MS) return NextResponse.json({ pending: true, suggestions: [], emergency })
    await generateSuggestions(id).catch((e) => console.error('[api/referrals] generate:', e))
  }
  const saved = await loadSuggestions(id).catch((e) => {
    console.error('[api/referrals] load:', e)
    return [] as SavedSuggestion[]
  })
  const locale = c.locale ?? 'ja'
  return NextResponse.json({ pending: false, suggestions: saved.flatMap((s) => (s.entry ? [presentSuggestion(s, s.entry, locale)] : [])), emergency })
}

const postSchema = z.object({ entryId: z.string().uuid() })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = postSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const access = await resolveCaseAccess(auth.appUser.id, id, auth.aal).catch(() => null)
  if (!access || access.role !== 'CONSULTEE' || !access.canDecide) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['OPEN', 'MATCHED'].includes(access.caseRow.status)) return NextResponse.json({ error: '受付が終わっています', code: 'NOT_ACTIVE' }, { status: 409 })

  const { data: entry } = await supabaseAdmin.from('directory_entries').select('id, visibility, name, phone').eq('id', parsed.data.entryId).maybeSingle()
  if (!entry || entry.visibility !== 'PUBLIC') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { error } = await supabaseAdmin.from('case_referrals').upsert(
    { case_id: id, directory_entry_id: parsed.data.entryId, status: 'CONSENTED', consented_at: new Date().toISOString() },
    { onConflict: 'case_id,directory_entry_id' },
  )
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  await notifyOps({ kind: 'REFERRAL_CONSENT', displayId: access.caseRow.display_id, caseId: id, entryName: entry.name as string, entryPhone: (entry.phone as string | null) ?? null }).catch(() => undefined)
  return NextResponse.json({ ok: true })
}
