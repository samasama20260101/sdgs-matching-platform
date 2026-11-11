// 支える｜団体の中で、この相談を受け持つメンバーを替える(#118、11/11 代表の検討キャンバス 5)。
//   替えられるのは団体の管理の人と、いま受け持っている本人。相手は団体の今いるメンバー(18歳以上)だけ。
//   受け持つメンバーは知らせとありがとうの宛先を決めるだけで、相談とやりとりは今いるメンバー全員が読める
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireFace } from '@/lib/server/supportAuth'
import { loadSupportCase } from '@/lib/server/supportCases'
import { myOrgRole } from '@/lib/server/orgAccess'
import { canSupportNow } from '@/lib/faces'
import { canChangeCaseMember, isMemberChangeableOffer, isValidNextMember } from '@/lib/domain/caseMember'

const schema = z.object({ face: z.string(), memberUserId: z.string().uuid() })

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const auth = await requireFace(request, parsed.data.face)
  if ('response' in auth) return auth.response
  if (auth.rf.face.kind !== 'ORGANIZATION') return NextResponse.json({ error: '団体の申し出だけ替えられます', code: 'NOT_ORGANIZATION' }, { status: 403 })
  const organizationId = auth.rf.face.organizationId

  const loaded = await loadSupportCase(auth.rf, id).catch(() => null)
  const mine = loaded?.mine ?? null
  if (!loaded || !loaded.caseRow || !mine) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isMemberChangeableOffer(mine.status)) return NextResponse.json({ error: 'いまは替えられません', code: 'NOT_CHANGEABLE' }, { status: 409 })

  const role = await myOrgRole(auth.userId, organizationId)
  if (!role || !canChangeCaseMember({ userId: auth.userId, role }, mine.supporter_user_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const target = parsed.data.memberUserId
  const { data: members, error: mError } = await supabaseAdmin
    .from('organization_memberships')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('status', 'ACTIVE')
  if (mError) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  const activeIds = (members ?? []).map((m) => m.user_id as string)
  if (!isValidNextMember(target, activeIds, mine.supporter_user_id)) {
    return NextResponse.json({ error: '団体の今いるメンバーを選んでください', code: 'NOT_MEMBER' }, { status: 400 })
  }
  if (!(await canSupportNow(target))) return NextResponse.json({ error: '支える側として活動できるのは18歳からです', code: 'UNDER_SUPPORTER_AGE' }, { status: 400 })

  // 同時に替えられたときに、あとの人が前の人の変更を黙って上書きしない
  const { data: updated, error } = await supabaseAdmin
    .from('offers')
    .update({ supporter_user_id: target, updated_at: new Date().toISOString() })
    .eq('id', mine.id)
    .eq('supporter_user_id', mine.supporter_user_id)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'ほかの人が先に替えました。読み直してください', code: 'CONFLICT' }, { status: 409 })

  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.userId,
    organization_id: organizationId,
    action: 'offer.member_change',
    target_table: 'offers',
    target_id: mine.id,
    metadata: { case_id: id, from: mine.supporter_user_id, to: target },
  })
  return NextResponse.json({ ok: true })
}
