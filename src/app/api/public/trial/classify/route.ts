// 体験ページ(/trial)の分類。POST { text } → { title, ids, source }。ログインなし。
// 本番で相談を届けるときと同じ分類(src/lib/server/caseAi.ts。伏せてから AI に渡す)を個人の選択肢で動かし、
// 「届けると、サービスの側でこう分類して支援団体に届く」を見せる。何も保存しない。書いた文はログにも残さない。
// 返すのは題と指標の番号だけ(緊急・機微の判定は返さない。画面は書いた言葉の判定で窓口を出す)。
// 費用を抑えるため、同じ端末(IP)から 10 分に 10 回、全体で 1 日 300 回まで AI を使い、超えたら AI を使わない(source: none。v2_12)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { DESCRIPTION_MAX, EXTRA_MAX } from '@/lib/domain/intake'
import { clientIpFrom } from '@/lib/rateLimitKey'
import { allowedByRateLimit } from '@/lib/server/rateLimit'
import { classifyConsultation } from '@/lib/server/caseAi'

const schema = z.object({
  text: z.string().transform((v) => v.trim()).pipe(z.string().min(1).max(DESCRIPTION_MAX + EXTRA_MAX * 2)),
})

// 枠の名前は「近いもの」を出していた頃のまま(数え方を続けるため)
const PER_DEVICE = { bucket: 'trial-suggest', windowSeconds: 10 * 60, max: 10 }
const PER_DAY = { bucket: 'trial-suggest-day', windowSeconds: 24 * 60 * 60, max: 300 }
// 体験ページで待たせる長さの上限(本番の届けるときより短く)
const TRIAL_TIMEOUT_MS = 10_000

type TrialClassification = { title: string | null; ids: string[]; source: 'ai' | 'none' }

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid', code: 'INVALID' }, { status: 400 })
  const headers = { 'Cache-Control': 'no-store' }
  // 端末ごとの上限を先に見る(1 つの端末が全体の回数を使い切らないように、超えた端末は全体を数えない)
  const useAi = (await allowedByRateLimit(PER_DEVICE, clientIpFrom(request.headers) ?? 'unknown')) && (await allowedByRateLimit(PER_DAY, 'all'))
  const none: TrialClassification = { title: null, ids: [], source: 'none' }
  if (!useAi) return NextResponse.json(none, { headers })
  const result = await classifyConsultation('PERSON', parsed.data.text, TRIAL_TIMEOUT_MS)
  if (!result.ok) return NextResponse.json(none, { headers })
  const body: TrialClassification = { title: result.title, ids: result.indicators.map((i) => i.id), source: 'ai' }
  return NextResponse.json(body, { headers })
}
