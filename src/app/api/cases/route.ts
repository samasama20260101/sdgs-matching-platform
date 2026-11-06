// 相談する側の相談(v2.0)。GET: わたしの相談の一覧 / POST: 相談を届ける(個人・会社・地域)
import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { loadFaces } from '@/lib/faces'
import { currentAge, isMinorAge, todayInTokyo } from '@/lib/domain/age'
import {
  assessIntake,
  canConsultAs,
  DESCRIPTION_MAX,
  EXTRA_MAX,
  optionsFor,
  provisionalTitle,
  sanitizeEntryCode,
  sanitizeSelection,
} from '@/lib/domain/intake'
import { isProductionDeployment } from '@/lib/deployEnv'
import { summarizeNewCase } from '@/lib/server/caseAi'
import { notifyOps } from '@/lib/server/opsNotify'
import { listMyCases } from '@/lib/server/myCases'

// 開いている相談(受付中・支援中)は 1 人 3 件まで(v1 と同じ)。本番だけ 24 時間に 10 件まで(取り消した分も数える)
const MAX_ACTIVE_CASES = 3
const DAILY_CASE_LIMIT = isProductionDeployment() ? 10 : null

const createSchema = z.object({
  subjectType: z.enum(['PERSON', 'COMPANY', 'COMMUNITY']),
  subjectOrganizationId: z.string().uuid().optional(),
  indicators: z.array(z.string()).max(10).default([]),
  description: z.string().transform((v) => v.trim()).pipe(z.string().min(1).max(DESCRIPTION_MAX)),
  since: z.string().max(EXTRA_MAX).optional(),
  wish: z.string().max(EXTRA_MAX).optional(),
  entryCode: z.string().optional(),
})

function serverError(where: string, error: unknown) {
  console.error(`[api/cases] ${where}:`, error)
  return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
}

export async function GET(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  try {
    return NextResponse.json({ cases: await listMyCases(auth.appUser.id) })
  } catch (e) {
    return serverError('list', e)
  }
}

export async function POST(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const input = parsed.data

  const { data: person, error: personError } = await supabaseAdmin
    .from('users')
    .select('id, age_years, age_base_date, region_country, region_code, city, locale')
    .eq('id', auth.appUser.id)
    .single()
  if (personError) return serverError('person', personError)

  // 会社・地域として相談するときは、その団体に今いるメンバーであること
  let organization: { id: string; name: string; org_type: string; population: number | null; vetting_status: string } | null = null
  if (input.subjectType !== 'PERSON') {
    if (!input.subjectOrganizationId) return NextResponse.json({ error: '団体を選んでください', code: 'ORG_REQUIRED' }, { status: 400 })
    const faces = await loadFaces(auth.appUser.id).catch(() => null)
    if (!faces) return serverError('faces', 'load failed')
    const face = faces.organizations.find((f) => f.organizationId === input.subjectOrganizationId)
    if (!face) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, org_type, population, vetting_status')
      .eq('id', face.organizationId)
      .single()
    if (orgError) return serverError('org', orgError)
    if (!canConsultAs(input.subjectType, org.org_type) || ['REJECTED', 'SUSPENDED'].includes(org.vetting_status)) {
      return NextResponse.json({ error: 'この団体では相談できません', code: 'ORG_NOT_ALLOWED' }, { status: 400 })
    }
    organization = org
  }

  // 回数の上限(個人の相談は本人ごと、団体の相談は団体ごと)
  const activeQuery = supabaseAdmin.from('cases').select('id', { count: 'exact', head: true }).in('status', ['OPEN', 'MATCHED'])
  const { count: activeCount, error: countError } = organization
    ? await activeQuery.eq('subject_organization_id', organization.id)
    : await activeQuery.eq('owner_user_id', auth.appUser.id).eq('subject_type', 'PERSON')
  if (countError) return serverError('count', countError)
  if ((activeCount ?? 0) >= MAX_ACTIVE_CASES) {
    return NextResponse.json({ error: '開いている相談は3件までです', code: 'ACTIVE_LIMIT' }, { status: 429 })
  }
  if (DAILY_CASE_LIMIT !== null) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count, error } = await supabaseAdmin
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .eq('owner_user_id', auth.appUser.id)
      .gte('created_at', since)
    if (error) return serverError('daily', error)
    if ((count ?? 0) >= DAILY_CASE_LIMIT) {
      return NextResponse.json({ error: '少し時間をおいてから届けてください', code: 'DAILY_LIMIT' }, { status: 429 })
    }
  }

  const indicatorIds = sanitizeSelection(input.subjectType, input.indicators)
  const options = new Map(optionsFor(input.subjectType).map((o) => [o.id, o.text]))
  const age = currentAge(person.age_years, person.age_base_date, todayInTokyo())
  const assessment = assessIntake({
    subject: input.subjectType,
    indicatorIds,
    text: [input.description, input.since, input.wish].filter(Boolean).join('\n'),
    personIsMinor: isMinorAge(age),
    organizationPopulation: organization?.population ?? null,
  })
  const entryCode = sanitizeEntryCode(input.entryCode)

  const { data: created, error: insertError } = await supabaseAdmin
    .from('cases')
    .insert({
      owner_user_id: auth.appUser.id,
      assignee_user_id: auth.appUser.id,
      subject_type: input.subjectType,
      subject_organization_id: organization?.id ?? null,
      title: provisionalTitle(input.subjectType, indicatorIds, input.description),
      description_free: input.description,
      urgency: assessment.urgency,
      status: 'OPEN',
      // v2.0: 届いたらすぐ支え手に見えるようにする(AI の整理はあとから重ねる)
      visibility: 'LISTED',
      intake_qna: {
        version: 3,
        indicators: indicatorIds,
        indicator_texts: indicatorIds.map((id) => options.get(id) ?? id),
        since: input.since?.trim() || null,
        wish: input.wish?.trim() || null,
        locale: person.locale,
      },
      region_country: person.region_country ?? 'JP',
      region_code: person.region_code,
      city: person.city,
      locale: person.locale,
      is_minor: assessment.isMinor,
      is_sensitive: assessment.isSensitive,
      sensitive_reasons: assessment.sensitiveReasons,
      affected_population: assessment.affectedPopulation,
      entry_channel: entryCode ? 'SHOP_CODE' : 'DIRECT',
      entry_code: entryCode,
    })
    .select('id, display_id')
    .single()
  if (insertError) return serverError('insert', insertError)

  if (indicatorIds.length > 0) {
    const { error: ciError } = await supabaseAdmin.from('case_indicators').insert(
      indicatorIds.map((code) => ({ case_id: created.id, indicator_code: code, source: 'SELF', status: 'PROPOSED' })),
    )
    if (ciError) console.error('[api/cases] case_indicators:', ciError)
  }

  // 返事を待たせない処理はあとで。Workers では応答のあと 30 秒で打ち切られるので、
  // 緊急の印つきの運営への知らせは AI の整理を待たずに先に送る(AI が遅くても知らせは消えない)
  after(() => notifyOps({
    kind: 'NEW_CASE',
    displayId: created.display_id,
    caseId: created.id,
    subjectType: input.subjectType,
    subjectName: organization?.name ?? null,
    urgent: assessment.urgency === 'High',
    sensitive: assessment.isSensitive,
    minor: assessment.isMinor,
    indicators: indicatorIds,
    entryChannel: entryCode ? 'SHOP_CODE' : 'DIRECT',
    entryCode,
    proxyName: null,
    locale: person.locale ?? null,
    country: person.region_country ?? 'JP',
  }).catch((e) => console.error('[api/cases] notify:', e)))
  after(() => summarizeNewCase(created.id).catch((e) => console.error('[api/cases] summarize:', e)))

  return NextResponse.json({ id: created.id, displayId: created.display_id, urgent: assessment.urgency === 'High' })
}
