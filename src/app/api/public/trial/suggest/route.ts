// 体験ページ(/trial)の「近いもの」。ログインなし。POST { text } → { ids, source }。個人の相談の選択肢から出す。
// 本番と同じく、伏せてから AI に渡し(src/lib/server/suggest.ts)、何も保存しない。書いた文はログにも残さない。
// 費用を抑えるため、同じ端末(IP)から 10 分に 10 回、全体で 1 日 300 回まで AI を使い、超えたら文字の重なりで並べる(v2_12)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { DESCRIPTION_MAX, EXTRA_MAX } from '@/lib/domain/intake'
import { clientIpFrom } from '@/lib/rateLimitKey'
import { allowedByRateLimit } from '@/lib/server/rateLimit'
import { suggestIndicators } from '@/lib/server/suggest'

const schema = z.object({
  text: z.string().transform((v) => v.trim()).pipe(z.string().min(1).max(DESCRIPTION_MAX + EXTRA_MAX * 2)),
})

const PER_DEVICE = { bucket: 'trial-suggest', windowSeconds: 10 * 60, max: 10 }
const PER_DAY = { bucket: 'trial-suggest-day', windowSeconds: 24 * 60 * 60, max: 300 }

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid', code: 'INVALID' }, { status: 400 })
  // 端末ごとの上限を先に見る(1 つの端末が全体の回数を使い切らないように、超えた端末は全体を数えない)
  const useAi = (await allowedByRateLimit(PER_DEVICE, clientIpFrom(request.headers) ?? 'unknown')) && (await allowedByRateLimit(PER_DAY, 'all'))
  const result = await suggestIndicators('PERSON', parsed.data.text, useAi)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
