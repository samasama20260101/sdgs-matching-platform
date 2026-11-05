// 支える｜相談をさがす(盤 22)。?face=org:<id>|individual&subject=PERSON|COMPANY|COMMUNITY&category=1..17&remote=1&involvement=all|notOffered|mine&offset=<件数>
import { NextResponse } from 'next/server'
import { requireFace } from '@/lib/server/supportAuth'
import { findCases } from '@/lib/server/supportCases'
import { isAreaSubject } from '@/lib/domain/supportAreas'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const auth = await requireFace(request, url.searchParams.get('face'))
  if ('response' in auth) return auth.response
  const cat = Number(url.searchParams.get('category'))
  const subject = url.searchParams.get('subject')
  const involvement = url.searchParams.get('involvement')
  try {
    const offset = Number(url.searchParams.get('offset'))
    const { items, hasMore, nextOffset } = await findCases(auth.rf, {
      offset: Number.isInteger(offset) && offset > 0 ? offset : 0,
      subject: isAreaSubject(subject) ? subject : null,
      category: Number.isInteger(cat) && cat >= 1 && cat <= 17 ? cat : null,
      includeRemote: url.searchParams.get('remote') === '1',
      involvement: involvement === 'notOffered' || involvement === 'mine' ? involvement : 'all',
      escalated: url.searchParams.get('escalated') === '1',
    })
    return NextResponse.json({
      cases: items,
      hasMore,
      nextOffset,
      lockedCount: items.filter((i) => i.locked).length,
      face: { label: auth.rf.label, kind: auth.rf.face.kind, phoneVerified: auth.rf.phoneVerified, approved: auth.rf.face.kind === 'ORGANIZATION' ? auth.rf.face.organizationApproved : true, coordinator: auth.rf.coordinatorRegions.length > 0 },
    })
  } catch (e) {
    console.error('[api/support/cases]', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
