// 支える｜相談をさがす(盤 22)。?face=org:<id>|individual&category=1..17&remote=1&involvement=all|notOffered|mine
import { NextResponse } from 'next/server'
import { requireFace } from '@/lib/server/supportAuth'
import { findCases } from '@/lib/server/supportCases'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const auth = await requireFace(request, url.searchParams.get('face'))
  if ('response' in auth) return auth.response
  const cat = Number(url.searchParams.get('category'))
  const involvement = url.searchParams.get('involvement')
  try {
    const items = await findCases(auth.rf, {
      category: Number.isInteger(cat) && cat >= 1 && cat <= 17 ? cat : null,
      includeRemote: url.searchParams.get('remote') === '1',
      involvement: involvement === 'notOffered' || involvement === 'mine' ? involvement : 'all',
    })
    return NextResponse.json({
      cases: items,
      lockedCount: items.filter((i) => i.locked).length,
      face: { label: auth.rf.label, kind: auth.rf.face.kind, phoneVerified: auth.rf.phoneVerified, approved: auth.rf.face.kind === 'ORGANIZATION' ? auth.rf.face.organizationApproved : true },
    })
  } catch (e) {
    console.error('[api/support/cases]', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
