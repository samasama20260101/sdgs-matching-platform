// 相談を書いたあとに「近いもの」を出す(画面の見直し 所見 5)。POST { subjectType, text } → { ids, source }
// AI は候補を出すだけで、選ぶのは本人(大項目を AI に決めさせない)。中身は src/lib/server/suggest.ts(体験ページと共用)。
// 1 人あたりの回数の上限は DB で数える(v2_12)。上限を超えたら文字の重なりで並べる(source: 'overlap')。届ける前なので何も保存しない
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { DESCRIPTION_MAX, EXTRA_MAX } from '@/lib/domain/intake'
import { allowedByRateLimit } from '@/lib/server/rateLimit'
import { suggestIndicators } from '@/lib/server/suggest'

const schema = z.object({
  subjectType: z.enum(['PERSON', 'COMPANY', 'COMMUNITY']),
  text: z.string().transform((v) => v.trim()).pipe(z.string().min(1).max(DESCRIPTION_MAX + EXTRA_MAX * 2)),
})

// 1 人あたり 10 分に 20 回まで(AI の費用を抑えるため)
const PER_USER = { bucket: 'suggest', windowSeconds: 10 * 60, max: 20 }

export async function POST(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const useAi = await allowedByRateLimit(PER_USER, auth.appUser.id)
  return NextResponse.json(await suggestIndicators(parsed.data.subjectType, parsed.data.text, useAi))
}
