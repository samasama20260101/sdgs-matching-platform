// 支える｜相談の詳細(盤 22 から開く)。見える範囲は visibility.ts で決める。中身は名前や連絡先をもともと持たない
import { NextResponse } from 'next/server'
import { isUuid } from '@/lib/api/validation'
import { requireFace } from '@/lib/server/supportAuth'
import { loadSupportCase } from '@/lib/server/supportCases'

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
      locked: false,
    })
  } catch (e) {
    console.error('[api/support/cases/:id]', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
