// 待つあいだの近くの窓口(つなぎ先、盤 13)。GET: 地域と分野と、だれの相談か(個人・会社)に合う窓口 / POST: 「運営から伝えてよい」を選ぶ
// 運営の担当者が窓口の受付(電話や相談フォーム)から伝える。自動のメールにはしない(決めてほしいこと 12 の推奨)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { resolveCaseAccess } from '@/lib/server/caseAccess'
import { optionsFor } from '@/lib/domain/intake'
import { referralAudience, type ReferralAudience } from '@/lib/domain/referrals'
import { notifyOps } from '@/lib/server/opsNotify'

const MAX_LOCAL = 3
const MAX_NATIONAL = 2
const COLUMNS = 'id, kind, name, categories, phone, website_url, hours_text, address, address_precision, sdgs_goals, verification_status, claim_status, attribution, source_url, service_scope'

type Entry = {
  id: string
  kind: string
  name: string
  categories: string[]
  phone: string | null
  website_url: string | null
  hours_text: string | null
  address: string | null
  address_precision: string
  sdgs_goals: number[]
  verification_status: string
  claim_status: string
  attribution: string | null
  source_url: string
  service_scope: string
}

// だれの相談かで窓口の種類を絞る(個人の相談に事業者の窓口を出さない・会社の相談に個人の窓口を出さない)
function forAudience<Q extends { overlaps: (column: string, value: string[]) => Q; not: (column: string, operator: string, value: string) => Q }>(q: Q, audience: ReferralAudience): Q {
  if (audience.kind === 'only') return q.overlaps('categories', [...audience.categories])
  if (audience.kind === 'except') return q.not('categories', 'ov', `{${audience.categories.join(',')}}`)
  return q
}

function present(e: Entry) {
  // 電話番号は、出典で照合が取れたものだけ出す(決めてほしいこと 7)
  const phoneOk = e.verification_status === 'SOURCE_OFFICIAL' || e.verification_status === 'VERIFIED'
  return {
    id: e.id,
    kind: e.kind,
    name: e.name,
    categories: e.categories,
    phone: phoneOk ? e.phone : null,
    website: e.website_url,
    hours: e.hours_text,
    address: e.address_precision === 'NONE' ? null : e.address,
    unregistered: e.claim_status !== 'CLAIMED',
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
  const audience = referralAudience(c.subject_type)
  if (audience.kind === 'none') return NextResponse.json({ local: [], national: [] })

  const optionCategory = new Map(optionsFor(c.subject_type).map((o) => [o.id, o.category]))
  const goals = [...new Set((c.intake_qna?.indicators ?? []).map((code) => optionCategory.get(code)).filter((g): g is number => typeof g === 'number'))]

  const local: Entry[] = []
  if (c.region_country === 'JP' && c.region_code) {
    let q = forAudience(supabaseAdmin.from('directory_entries').select(COLUMNS).eq('visibility', 'PUBLIC').eq('prefecture_code', c.region_code).neq('kind', 'NATIONAL_HOTLINE'), audience)
    if (goals.length > 0) q = q.overlaps('sdgs_goals', goals)
    const { data, error } = await q.order('kind', { ascending: false }).limit(40)
    if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    // 公的な窓口を先に、同じ種類は名前の順
    local.push(...((data ?? []) as Entry[]).sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'ja') : a.kind === 'PUBLIC_WINDOW' ? -1 : 1)).slice(0, MAX_LOCAL))
  }
  let national: Entry[] = []
  if (c.region_country === 'JP') {
    let q = forAudience(supabaseAdmin.from('directory_entries').select(COLUMNS).eq('visibility', 'PUBLIC').eq('kind', 'NATIONAL_HOTLINE'), audience)
    if (goals.length > 0) q = q.overlaps('sdgs_goals', goals)
    const { data } = await q.limit(MAX_NATIONAL)
    national = (data ?? []) as Entry[]
  }
  return NextResponse.json({ local: local.map(present), national: national.map(present) })
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

  const { data: entry } = await supabaseAdmin.from('directory_entries').select('id, visibility').eq('id', parsed.data.entryId).maybeSingle()
  if (!entry || entry.visibility !== 'PUBLIC') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { error } = await supabaseAdmin.from('case_referrals').upsert(
    { case_id: id, directory_entry_id: parsed.data.entryId, status: 'CONSENTED', consented_at: new Date().toISOString() },
    { onConflict: 'case_id,directory_entry_id' },
  )
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  await notifyOps({ kind: 'REFERRAL_CONSENT', displayId: access.caseRow.display_id }).catch(() => undefined)
  return NextResponse.json({ ok: true })
}
