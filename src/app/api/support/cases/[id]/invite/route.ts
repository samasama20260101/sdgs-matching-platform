// 支える｜共同支援に招く(中心の支え手だけ、盤 15・22)。招かれた団体が受けると、相談した人に「提案」として届き、
// 相談した人が同意すると加わる。招けるのは運営が承認した団体だけ(個人の相談に個人の支え手は招けない)
import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireFace } from '@/lib/server/supportAuth'
import { loadSupportCase } from '@/lib/server/supportCases'
import { MAX_SUPPORTERS_PER_CASE, OFFER_MESSAGE_MAX } from '@/lib/domain/offers'
import { notifyUsers } from '@/lib/server/notifyUser'

const schema = z.object({
  face: z.string(),
  targetOrganizationId: z.string().uuid(),
  message: z.string().transform((v) => v.trim()).pipe(z.string().min(1).max(OFFER_MESSAGE_MAX)),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = schema.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const auth = await requireFace(request, body.data.face)
  if ('response' in auth) return auth.response
  const loaded = await loadSupportCase(auth.rf, id).catch(() => null)
  const mine = loaded?.mine
  if (!loaded?.caseRow || !mine || mine.status !== 'ACCEPTED' || mine.accepted_order !== 1) return NextResponse.json({ error: '招けるのは中心の支え手です', code: 'NOT_LEAD' }, { status: 403 })
  if (loaded.caseRow.status !== 'MATCHED') return NextResponse.json({ error: 'いまは招けません', code: 'NOT_MATCHED' }, { status: 409 })
  if (body.data.targetOrganizationId === mine.supporter_organization_id) return NextResponse.json({ error: '自分の団体は招けません', code: 'SELF' }, { status: 400 })

  const { count: accepted } = await supabaseAdmin.from('offers').select('id', { count: 'exact', head: true }).eq('case_id', id).eq('status', 'ACCEPTED')
  if ((accepted ?? 0) >= MAX_SUPPORTERS_PER_CASE) return NextResponse.json({ error: '支え手は3者までです', code: 'MAX_REACHED' }, { status: 409 })
  const { data: target } = await supabaseAdmin.from('organizations').select('id, vetting_status, status').eq('id', body.data.targetOrganizationId).maybeSingle()
  if (!target || target.vetting_status !== 'APPROVED' || target.status !== 'ACTIVE') return NextResponse.json({ error: '招けない団体です', code: 'NOT_APPROVED' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('offers').insert({
    case_id: id,
    supporter_kind: 'ORGANIZATION',
    supporter_organization_id: target.id,
    // 招かれた団体の誰かが受けるまでは、招いた人を仮に置く(受けた人に付け替える)
    supporter_user_id: auth.userId,
    created_by_user_id: auth.userId,
    invited_by_offer_id: mine.id,
    message: body.data.message,
    status: 'INVITED',
  }).select('id').single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'その団体はもう関わっています', code: 'ALREADY' }, { status: 409 })
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  after(async () => {
    const { data: owners } = await supabaseAdmin.from('organization_memberships').select('user_id').eq('organization_id', target.id).eq('status', 'ACTIVE').eq('role', 'OWNER')
    await notifyUsers((owners ?? []).map((m) => m.user_id as string), 'INVITED').catch(() => undefined)
  })
  return NextResponse.json({ id: data.id })
}
