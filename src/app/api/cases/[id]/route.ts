// 相談する側の相談の詳細(盤 13・14)
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { resolveCaseAccess } from '@/lib/server/caseAccess'
import { buildConsulteeView } from '@/lib/server/consulteeView'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const access = await resolveCaseAccess(auth.appUser.id, id)
    if (!access || access.role !== 'CONSULTEE') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ case: await buildConsulteeView(access.caseRow), canDecide: access.canDecide })
  } catch (e) {
    console.error('[api/cases/:id]', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
