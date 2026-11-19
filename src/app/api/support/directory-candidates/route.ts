// 支援団体の登録のとき、掲載台帳から名前の近い団体を「この団体でしょうか」と出す(#140、2026-11-19 定例)。
// GET ?name=<団体名>&corporateNumber=<法人番号(任意)> → { candidates: [...] }(5 つまで)
// 返すのは名前・所在の都道府県・サイトと出典の表記だけ(電話・住所・相談の受け方の引用は返さない)。
// 出典の表記は、掲載台帳を画面に出すときの決まり(PDL1.0・CC BY)のため一覧の下に 1 回出す
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { searchClaimCandidates } from '@/lib/server/directoryClaim'

const schema = z.object({
  name: z.string().max(100).default(''),
  corporateNumber: z.string().max(32).nullable().default(null),
})

export async function GET(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  const params = new URL(request.url).searchParams
  const parsed = schema.safeParse({ name: params.get('name') ?? undefined, corporateNumber: params.get('corporateNumber') })
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  try {
    const candidates = await searchClaimCandidates(parsed.data.name, parsed.data.corporateNumber)
    return NextResponse.json({ candidates }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) {
    console.error('[api/support/directory-candidates]', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
