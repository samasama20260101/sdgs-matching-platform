// 支える｜相談の詳細(盤 22 から開く)。見える範囲は visibility.ts で決める。中身は名前や連絡先をもともと持たない
import { NextResponse } from 'next/server'
import { isUuid } from '@/lib/api/validation'
import { requireFace } from '@/lib/server/supportAuth'
import { loadSupportCase, type ResolvedFace } from '@/lib/server/supportCases'
import type { OfferRow } from '@/lib/server/caseAccess'
import { supabaseAdmin } from '@/lib/supabase/server'
import { myOrgRole } from '@/lib/server/orgAccess'
import { canChangeCaseMember, isMemberChangeableOffer } from '@/lib/domain/caseMember'

// 団体の申し出を受け持つメンバー(#118)。替えられる人には、替える相手(団体の今いるメンバー)も返す
async function caseMember(rf: ResolvedFace, userId: string, mine: OfferRow | null) {
  if (rf.face.kind !== 'ORGANIZATION' || !mine || !isMemberChangeableOffer(mine.status)) return null
  const organizationId = rf.face.organizationId
  const [role, { data: memberships }, { data: current }] = await Promise.all([
    myOrgRole(userId, organizationId),
    supabaseAdmin.from('organization_memberships').select('user_id, users!organization_memberships_user_id_fkey(display_name)').eq('organization_id', organizationId).eq('status', 'ACTIVE').order('joined_at', { ascending: true }),
    supabaseAdmin.from('users').select('display_name').eq('id', mine.supporter_user_id).maybeSingle(),
  ])
  const active = (memberships ?? []).map((m) => ({ userId: m.user_id as string, displayName: (m.users as unknown as { display_name?: string } | null)?.display_name ?? '—' }))
  const canChange = role !== null && canChangeCaseMember({ userId, role }, mine.supporter_user_id)
  return {
    userId: mine.supporter_user_id,
    displayName: (current?.display_name as string | undefined) ?? '—',
    isMe: mine.supporter_user_id === userId,
    // 団体を抜けた人が受け持ったままなら、替えるよう出す
    active: active.some((m) => m.userId === mine.supporter_user_id),
    canChange,
    candidates: canChange ? active.filter((m) => m.userId !== mine.supporter_user_id).map((m) => ({ ...m, isMe: m.userId === userId })) : [],
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const auth = await requireFace(request, new URL(request.url).searchParams.get('face'))
  if ('response' in auth) return auth.response
  try {
    const loaded = await loadSupportCase(auth.rf, id)
    if (!loaded) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!loaded.caseRow) return NextResponse.json({ case: loaded.item, locked: true })
    const c = loaded.caseRow
    const mine = loaded.mine
    return NextResponse.json({
      case: {
        ...loaded.item,
        description: c.description_free,
        since: c.intake_qna?.since ?? null,
        wish: c.intake_qna?.wish ?? null,
        supporterResolvedAt: c.supporter_resolved_at,
        createdAt: c.created_at,
      },
      myOffer: mine ? { id: mine.id, status: mine.status, message: mine.message, acceptedOrder: mine.accepted_order, invited: Boolean(mine.invited_by_offer_id) } : null,
      isLead: mine?.status === 'ACCEPTED' && mine.accepted_order === 1,
      member: await caseMember(auth.rf, auth.userId, mine),
      locked: false,
    })
  } catch (e) {
    console.error('[api/support/cases/:id]', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
