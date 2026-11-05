// 規約・ポリシーの版が上がったときの同意し直し
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { recordConsents } from '@/lib/server/consents'

export async function POST(request: Request) {
  const auth = await requireActiveAppUser(request)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as { acceptTerms?: unknown } | null
  if (body?.acceptTerms !== true) return NextResponse.json({ error: '同意が必要です', code: 'INVALID' }, { status: 400 })
  try {
    await recordConsents(auth.appUser.id)
  } catch (e) {
    console.error('[api/me/consents]', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
