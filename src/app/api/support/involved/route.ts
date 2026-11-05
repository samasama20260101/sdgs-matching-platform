// 支える｜ホームとやりとり(盤 20): その顔で関わっている相談(申し出中・選ばれた・招かれた)
import { NextResponse } from 'next/server'
import { requireFace } from '@/lib/server/supportAuth'
import { involvedCases } from '@/lib/server/supportCases'

export async function GET(request: Request) {
  const auth = await requireFace(request, new URL(request.url).searchParams.get('face'))
  if ('response' in auth) return auth.response
  try {
    return NextResponse.json({ cases: await involvedCases(auth.rf) })
  } catch (e) {
    console.error('[api/support/involved]', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
