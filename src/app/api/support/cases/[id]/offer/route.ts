// 支える｜申し出る(POST)・取り下げる(DELETE)。申し出は1件の相談に1つの顔で1件。メッセージ必須(盤 05「メッセージを添えて申し出る」)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireFace } from '@/lib/server/supportAuth'
import { loadSupportCase } from '@/lib/server/supportCases'
import { OFFER_MESSAGE_MAX } from '@/lib/domain/offers'
import { postSystemMessage } from '@/lib/server/systemMessages'

const postSchema = z.object({
  face: z.string(),
  message: z.string().transform((v) => v.trim()).pipe(z.string().min(1).max(OFFER_MESSAGE_MAX)),
})
const deleteSchema = z.object({ face: z.string(), reason: z.string().max(500).optional() })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = postSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: `メッセージを1〜${OFFER_MESSAGE_MAX}文字で書いてください`, code: 'INVALID' }, { status: 400 })
  const auth = await requireFace(request, body.data.face)
  if ('response' in auth) return auth.response
  const loaded = await loadSupportCase(auth.rf, id).catch(() => null)
  if (!loaded || !loaded.caseRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!loaded.item.canOffer) {
    const code = auth.rf.face.kind === 'INDIVIDUAL' && !auth.rf.phoneVerified ? 'PHONE_REQUIRED' : 'CANNOT_OFFER'
    return NextResponse.json({ error: 'この相談には申し出られません', code }, { status: 409 })
  }
  const individual = auth.rf.face.kind === 'INDIVIDUAL'
  const row = {
    case_id: id,
    supporter_kind: individual ? 'INDIVIDUAL' : 'ORGANIZATION',
    supporter_user_id: auth.userId,
    supporter_organization_id: auth.rf.face.kind === 'ORGANIZATION' ? auth.rf.face.organizationId : null,
    created_by_user_id: auth.userId,
    message: body.data.message,
    status: 'PENDING',
    accepted_order: null,
    declined_at: null,
    withdrawn_at: null,
    withdrawal_reason: null,
    updated_at: new Date().toISOString(),
  }
  // 取り下げた・見送られた申し出は出し直せる(同じ行を使う)
  if (loaded.mine && ['WITHDRAWN', 'DECLINED'].includes(loaded.mine.status)) {
    const { error } = await supabaseAdmin.from('offers').update(row).eq('id', loaded.mine.id)
    if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    return NextResponse.json({ id: loaded.mine.id })
  }
  const { data, error } = await supabaseAdmin.from('offers').insert(row).select('id').single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'もう申し出ています', code: 'ALREADY' }, { status: 409 })
    console.error('[api/support/offer]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  return NextResponse.json({ id: data.id })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const auth = await requireFace(request, body.data.face)
  if ('response' in auth) return auth.response
  const loaded = await loadSupportCase(auth.rf, id).catch(() => null)
  const mine = loaded?.mine
  if (!loaded?.caseRow || !mine || !['PENDING', 'ACCEPTED'].includes(mine.status)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // 支援中の取り下げは理由が必須。解決の報告が相談した人の返事待ちのあいだは取り下げられない(v1 と同じ)
  if (mine.status === 'ACCEPTED') {
    if (!body.data.reason?.trim()) return NextResponse.json({ error: '理由を書いてください', code: 'REASON_REQUIRED' }, { status: 400 })
    if (loaded.caseRow.supporter_resolved_at) return NextResponse.json({ error: '解決の報告への返事を待っています', code: 'REPORT_PENDING' }, { status: 409 })
  }
  const now = new Date().toISOString()
  const { error } = await supabaseAdmin.from('offers').update({ status: 'WITHDRAWN', withdrawn_at: now, withdrawn_by_user_id: auth.userId, withdrawal_reason: body.data.reason?.trim() || null, updated_at: now }).eq('id', mine.id)
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  if (mine.status === 'ACCEPTED') {
    await postSystemMessage(id, auth.userId, 'offerWithdrawn')
    // 選ばれた支え手が誰もいなくなったら受付中に戻す
    const { count } = await supabaseAdmin.from('offers').select('id', { count: 'exact', head: true }).eq('case_id', id).eq('status', 'ACCEPTED')
    if ((count ?? 0) === 0) await supabaseAdmin.from('cases').update({ status: 'OPEN', updated_at: now }).eq('id', id).eq('status', 'MATCHED')
  }
  return NextResponse.json({ ok: true })
}
