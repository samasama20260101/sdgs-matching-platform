// 代理で相談を登録する(盤 23)。団体の一員だけ。本人の同意を得てから登録し、登録した人の名前は団体の記録に残る。
// 本人がスマホを持ったら引き継ぎコードで自分の相談にできる。それまで申し出とやりとりは、この団体の「代理の相談」に届く
import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireFace } from '@/lib/server/supportAuth'
import { assessIntake, DESCRIPTION_MAX, optionsFor, provisionalTitle, sanitizeSelection } from '@/lib/domain/intake'
import { newHandoverCode } from '@/lib/server/handover'
import { notifyOps } from '@/lib/server/opsNotify'
import { summarizeNewCase } from '@/lib/server/caseAi'

const schema = z.object({
  face: z.string(),
  displayName: z.string().transform((v) => v.trim()).pipe(z.string().min(1).max(20)),
  isMinor: z.boolean(),
  country: z.string().regex(/^[A-Z]{2}$/),
  regionCode: z.string().regex(/^[A-Z]{2}-[0-9A-Z]{1,3}$/).nullable().optional(),
  indicators: z.array(z.string()).max(10).default([]),
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
    return NextResponse.json({ error: '代理の登録は、運営が承認した団体のメンバーだけができます', code: 'NOT_ALLOWED' }, { status: 403 })
  }
  const orgId = auth.rf.face.organizationId
  const indicatorIds = sanitizeSelection('PERSON', input.indicators)
  const texts = new Map(optionsFor('PERSON').map((o) => [o.id, o.text]))
  const assessment = assessIntake({ subject: 'PERSON', indicatorIds, text: input.words, personIsMinor: input.isMinor, organizationPopulation: null })
  const now = new Date().toISOString()

  const { data: created, error } = await supabaseAdmin.from('cases').insert({
    owner_user_id: null,
    assignee_user_id: auth.userId,
    proxy_organization_id: orgId,
    proxy_by_user_id: auth.userId,
    proxy_consented_at: now,
    subject_type: 'PERSON',
    title: provisionalTitle('PERSON', indicatorIds, input.words),
    description_free: input.words,
    urgency: assessment.urgency,
    status: 'OPEN',
    visibility: 'LISTED',
    intake_qna: { version: 3, indicators: indicatorIds, indicator_texts: indicatorIds.map((id) => texts.get(id) ?? id), proxy_display_name: input.displayName, locale: 'ja' },
    region_country: input.country,
    region_code: input.regionCode ?? null,
    locale: 'ja',
    is_minor: assessment.isMinor,
    is_sensitive: assessment.isSensitive,
    sensitive_reasons: assessment.sensitiveReasons,
    affected_population: 1,
    entry_channel: 'PROXY',
  }).select('id, display_id').single()
  if (error) {
    console.error('[api/support/proxy]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  if (indicatorIds.length > 0) {
    await supabaseAdmin.from('case_indicators').insert(indicatorIds.map((code) => ({ case_id: created.id, indicator_code: code, source: 'SELF', status: 'PROPOSED' })))
  }
  const handover = newHandoverCode()
  const { error: hError } = await supabaseAdmin.from('case_handover_codes').insert({ case_id: created.id, code_hash: handover.hash, expires_at: handover.expiresAt, created_by_user_id: auth.userId })
  if (hError) console.error('[api/support/proxy] handover', hError)
  await supabaseAdmin.from('audit_logs').insert({ actor_user_id: auth.userId, organization_id: orgId, action: 'case.proxy_register', target_table: 'cases', target_id: created.id, metadata: { display_id: created.display_id } })
  after(() => notifyOps({ kind: 'NEW_CASE', displayId: created.display_id, subjectType: 'PERSON', urgent: assessment.urgency === 'High', sensitive: assessment.isSensitive }).catch(() => undefined))
  // 代理の相談も、本人の相談と同じく AI で整理する(題・要約・機微の引き上げ)
  after(() => summarizeNewCase(created.id).catch((e) => console.error('[api/support/proxy] summarize:', e)))
  // コードはここで1回だけ返す(DB にはハッシュしかない)
  return NextResponse.json({ id: created.id, displayId: created.display_id, code: handover.code, expiresAt: handover.expiresAt })
}
