// 申し出を選ぶ / 今回は見送る(盤 14)。中心からの招待は、招かれた団体が受けたあと(PENDING + invited_by_offer_id)に相談する側が同意する(盤 15)
import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { resolveCaseAccess } from '@/lib/server/caseAccess'
import { MAX_SUPPORTERS_PER_CASE } from '@/lib/domain/offers'
import { postSystemMessage } from '@/lib/server/systemMessages'
import { notifyUsers } from '@/lib/server/notifyUser'

const schema = z.object({ action: z.enum(['accept', 'decline']) })

export async function POST(request: Request, { params }: { params: Promise<{ id: string; offerId: string }> }) {
  const { id, offerId } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id) || !isUuid(offerId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })

  const access = await resolveCaseAccess(auth.appUser.id, id).catch(() => null)
  if (!access || access.role !== 'CONSULTEE') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!access.canDecide) return NextResponse.json({ error: '担当の人だけが選べます', code: 'NOT_ASSIGNEE' }, { status: 403 })

  const { data: offer, error } = await supabaseAdmin.from('offers').select('id, case_id, status').eq('id', offerId).maybeSingle()
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  if (!offer || offer.case_id !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // 招かれた団体がまだ受けていない招待(INVITED)は、相談する側からは選べない
  if (offer.status === 'INVITED') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (parsed.data.action === 'decline') {
    // 見送っても、相手に理由は伝わらない(盤 14)
    const { error: declineError } = await supabaseAdmin
      .from('offers')
      .update({ status: 'DECLINED', declined_at: new Date().toISOString(), declined_by_user_id: auth.appUser.id })
      .eq('id', offerId)
      .in('status', ['PENDING', 'INVITED'])
    if (declineError) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // 本人の相談では持ち主、会社・地域・代理の相談では担当者として選ぶ(DB の関数が確かめる)
  const actor = access.caseRow.subject_type === 'PERSON' && access.caseRow.owner_user_id ? access.caseRow.owner_user_id : auth.appUser.id
  const { data: result, error: rpcError } = await supabaseAdmin.rpc('accept_sos_offer', {
    p_offer_id: offerId,
    p_sos_user_id: actor,
    p_max_accepted: MAX_SUPPORTERS_PER_CASE,
  })
  if (rpcError) {
    console.error('[api/cases/offers] accept:', rpcError)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  const r = result as { ok?: boolean; error?: string; accepted_order?: number }
  if (!r.ok) {
    const status = r.error === 'MAX_REACHED' ? 409 : r.error === 'FORBIDDEN' ? 403 : 409
    return NextResponse.json({ error: '選べませんでした', code: r.error }, { status })
  }
  const { data: accepted } = await supabaseAdmin.from('offers').select('invited_by_offer_id').eq('id', offerId).single()
  if (accepted?.invited_by_offer_id) await postSystemMessage(id, auth.appUser.id, 'joined')
  after(async () => {
    const { data: o } = await supabaseAdmin.from('offers').select('created_by_user_id, supporter_user_id').eq('id', offerId).single()
    await notifyUsers([(o?.created_by_user_id as string | null) ?? (o?.supporter_user_id as string)], 'CHOSEN').catch(() => undefined)
  })
  return NextResponse.json({ ok: true, acceptedOrder: r.accepted_order })
}
