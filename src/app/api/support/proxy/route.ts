// 代理で相談を登録する(盤 23)。承認された支援団体の一員だけ。本人の同意を得てから登録し、登録した人の名前は支援団体の記録に残る。
// 本人がスマホを持ったら引き継ぎコードで自分の相談にできる。それまで申し出とやりとりは、この支援団体の「代理の相談」に届く。
// 困りごとは選ばない。相談者が届けるときと同じく、保存する前に AI が分類する(#133、src/lib/server/caseAi.ts)
import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireFace } from '@/lib/server/supportAuth'
import { assessIntake, DESCRIPTION_MAX, optionsFor, provisionalTitle } from '@/lib/domain/intake'
import { newHandoverCode } from '@/lib/server/handover'
import { notifyOps } from '@/lib/server/opsNotify'
import { classificationRecord, classifyConsultation } from '@/lib/server/caseAi'

const schema = z.object({
  face: z.string(),
  displayName: z.string().transform((v) => v.trim()).pipe(z.string().min(1).max(20)),
  isMinor: z.boolean(),
  country: z.string().regex(/^[A-Z]{2}$/),
  regionCode: z.string().regex(/^[A-Z]{2}-[0-9A-Z]{1,3}$/).nullable().optional(),
  words: z.string().transform((v) => v.trim()).pipe(z.string().min(1).max(DESCRIPTION_MAX)),
  consent: z.literal(true),
})

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const input = parsed.data
  const auth = await requireFace(request, input.face)
  if ('response' in auth) return auth.response
  if (auth.rf.face.kind !== 'ORGANIZATION' || !auth.rf.face.organizationApproved) {
    return NextResponse.json({ error: '代理の登録は、運営が承認した支援団体のメンバーだけができます', code: 'NOT_ALLOWED' }, { status: 403 })
  }
  const orgId = auth.rf.face.organizationId
  const classified = await classifyConsultation('PERSON', input.words)
  if (!classified.ok) console.error(`[api/support/proxy] classification unavailable (${classified.code}); treating as sensitive`)
  const assessment = assessIntake({
    subject: 'PERSON',
    text: input.words,
    personIsMinor: input.isMinor,
    organizationPopulation: null,
    ai: classified.ok ? { ok: true, indicatorIds: classified.indicators.map((i) => i.id), urgent: classified.urgent, sensitive: classified.sensitive } : { ok: false },
  })
  const indicatorIds = assessment.indicatorIds
  const texts = new Map(optionsFor('PERSON').map((o) => [o.id, o.text]))
  const now = new Date().toISOString()

  const { data: created, error } = await supabaseAdmin.from('cases').insert({
    owner_user_id: null,
    assignee_user_id: auth.userId,
    proxy_organization_id: orgId,
    proxy_by_user_id: auth.userId,
    proxy_consented_at: now,
    subject_type: 'PERSON',
    title: (classified.ok && classified.title) || provisionalTitle('PERSON', indicatorIds, input.words),
    description_free: input.words,
    urgency: assessment.urgency,
    status: 'OPEN',
    visibility: 'LISTED',
    intake_qna: { version: 4, indicators: indicatorIds, indicator_texts: indicatorIds.map((id) => texts.get(id) ?? id), indicator_source: 'AI', proxy_display_name: input.displayName, locale: 'ja' },
    region_country: input.country,
    region_code: input.regionCode ?? null,
    locale: 'ja',
    is_minor: assessment.isMinor,
    is_sensitive: assessment.isSensitive,
    sensitive_reasons: assessment.sensitiveReasons,
    affected_population: 1,
    entry_channel: 'PROXY',
    ai_sdg_suggestion: classified.ok ? classificationRecord(classified, new Date()) : null,
  }).select('id, display_id').single()
  if (error) {
    console.error('[api/support/proxy]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  const aiIndicators = classified.ok ? classified.indicators.filter((i) => indicatorIds.includes(i.id)) : []
  if (aiIndicators.length > 0) {
    const { error: ciError } = await supabaseAdmin.from('case_indicators').insert(
      aiIndicators.map((i) => ({ case_id: created.id, indicator_code: i.id, source: 'AI', status: 'PROPOSED', confidence: i.confidence, reason: i.reason })),
    )
    if (ciError) console.error('[api/support/proxy] case_indicators', ciError)
  }
  const handover = newHandoverCode()
  const { error: hError } = await supabaseAdmin.from('case_handover_codes').insert({ case_id: created.id, code_hash: handover.hash, expires_at: handover.expiresAt, created_by_user_id: auth.userId })
  if (hError) console.error('[api/support/proxy] handover', hError)
  await supabaseAdmin.from('audit_logs').insert({ actor_user_id: auth.userId, organization_id: orgId, action: 'case.proxy_register', target_table: 'cases', target_id: created.id, metadata: { display_id: created.display_id } })
  after(async () => {
    const { data: proxyOrg } = await supabaseAdmin.from('organizations').select('name').eq('id', orgId).maybeSingle()
    await notifyOps({
      kind: 'NEW_CASE',
      displayId: created.display_id,
      caseId: created.id,
      subjectType: 'PERSON',
      subjectName: null,
      urgent: assessment.urgency === 'High',
      sensitive: assessment.isSensitive,
      minor: assessment.isMinor,
      aiUnavailable: !classified.ok,
      indicators: indicatorIds,
      entryChannel: 'PROXY',
      entryCode: null,
      proxyName: (proxyOrg?.name as string | undefined) ?? null,
      locale: 'ja',
      country: input.country,
    }).catch(() => undefined)
  })
  // コードはここで1回だけ返す(DB にはハッシュしかない)
  return NextResponse.json({ id: created.id, displayId: created.display_id, code: handover.code, expiresAt: handover.expiresAt })
}
