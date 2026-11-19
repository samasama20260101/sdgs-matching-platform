// 相談に合う支援団体の提案(#138、盤 13 の置き換え)。
// GET: 提案した支援団体(3 つまで。緊急と判定した相談では全国の電話窓口が入ることがある) / POST: 「運営から伝えてもらう」を選ぶ
// 運営の担当者が支援団体の受付(電話や問い合わせフォーム)から伝える。自動のメールにはしない(2026-11-19 定例)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { resolveCaseAccess } from '@/lib/server/caseAccess'
import { areaNoteFor, channelsForCard } from '@/lib/domain/suggestions'
import { generateSuggestions, loadSuggestions, type SavedSuggestion } from '@/lib/server/suggestions'
import { notifyOps } from '@/lib/server/opsNotify'

// 届けた直後は応答のあとの処理が提案を作っているので、この間は画面に待ってもらう(その場で二重に AI を呼ばない)
const PENDING_WINDOW_MS = 45_000

type RegionName = { name_local: string; name_en: string }

function presentSuggestion(s: SavedSuggestion, e: NonNullable<SavedSuggestion['entry']>, locale: string, regionCode: string | null, regionNames: Map<string, RegionName>) {
  // 相談者と違う都道府県の団体は所在を出し、来所・訪問の手段は出さない(#148)
  const area = areaNoteFor({ serviceScope: e.service_scope, serviceCodes: e.service_codes ?? [], prefectureCode: e.prefecture_code }, regionCode)
  const prefecture = area?.kind === 'OTHER_PREFECTURE' && area.code ? regionNames.get(area.code) : undefined
  // 電話番号は、出典で照合が取れたものだけ出す(決めてほしいこと 7)
  const phoneOk = e.verification_status === 'SOURCE_OFFICIAL' || e.verification_status === 'VERIFIED'
  return {
    id: e.id,
    kind: e.kind,
    name: e.name,
    // 理由は相談者の言語で AI が書く。AI が使えなかったときは、日本語の画面にだけ調べた要約を出す
    reason: s.reason ?? (locale === 'ja' ? e.consult_summary : null),
    channels: channelsForCard(e.consult_channels ?? [], area?.kind === 'OTHER_PREFECTURE'),
    area: area?.kind === 'NATIONWIDE' ? { kind: 'NATIONWIDE' as const } : area ? { kind: 'OTHER_PREFECTURE' as const, name: prefecture ? (locale === 'ja' ? prefecture.name_local : prefecture.name_en) : null } : null,
    phone: phoneOk ? e.phone : null,
    website: e.website_url,
    hours: e.hours_text,
    unregistered: e.claim_status !== 'CLAIMED',
    canShare: e.kind !== 'NATIONAL_HOTLINE',
    attribution: e.attribution,
    sourceUrl: e.source_url,
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const access = await resolveCaseAccess(auth.appUser.id, id, auth.aal).catch(() => null)
  if (!access || access.role !== 'CONSULTEE') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const c = access.caseRow
  if (c.status !== 'OPEN') return NextResponse.json({ pending: false, suggestions: [] })

  const { data: meta, error: metaError } = await supabaseAdmin.from('cases').select('suggestions_generated_at').eq('id', id).single()
  if (metaError) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  if (!meta.suggestions_generated_at) {
    if (Date.now() - Date.parse(c.created_at) < PENDING_WINDOW_MS) return NextResponse.json({ pending: true, suggestions: [] })
    await generateSuggestions(id).catch((e) => console.error('[api/referrals] generate:', e))
  }
  const saved = await loadSuggestions(id).catch((e) => {
    console.error('[api/referrals] load:', e)
    return [] as SavedSuggestion[]
  })
  const locale = c.locale ?? 'ja'
  // 都道府県の名前は 2 回に分けて取る(AGENTS.md: regions は JOIN しない)
  const codes = [...new Set(saved.flatMap((s) => (s.entry?.prefecture_code ? [s.entry.prefecture_code] : [])))]
  const { data: regionRows } = codes.length > 0 ? await supabaseAdmin.from('regions').select('code, name_local, name_en').in('code', codes) : { data: [] }
  const regionNames = new Map(((regionRows ?? []) as (RegionName & { code: string })[]).map((r) => [r.code, r]))
  return NextResponse.json({ pending: false, suggestions: saved.flatMap((s) => (s.entry ? [presentSuggestion(s, s.entry, locale, c.region_code, regionNames)] : [])) })
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
