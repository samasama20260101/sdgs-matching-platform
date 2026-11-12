// 指標を世界の中で見る(11/12 定例。引き続き考えることの 3。数の意味は src/lib/domain/score.ts の冒頭)。
//   resolved = 明日もsamasama で、その指標が確定した解決済みの相談の数(同じ相談は1回だけ)。mine はあなたが関わった数
//   facing   = 国連の公表値から作った、いま困っている人の数(まだない指標は null)
//   possible = 起こりうる最大(世界の人口)
// 相談の中身・だれが解決したかは返さない(数だけ)
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { summarizeContributions, resolvedForIndicator, type ContributionRow } from '@/lib/domain/score'
import { WORLD_COUNTS, WORLD_POPULATION } from '@/lib/constants/worldCounts.generated'

const CODE = /^\d{1,2}\.[0-9a-z]{1,2}\.\d{1,2}$/

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!CODE.test(code)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: links, error } = await supabaseAdmin.from('case_indicators').select('case_id').eq('indicator_code', code).eq('status', 'CONFIRMED').limit(10000)
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  const caseIds = [...new Set((links ?? []).map((l) => l.case_id as string))]
  const resolved: { case_id: string; resolved_at: string | null }[] = []
  for (let i = 0; i < caseIds.length; i += 300) {
    const { data, error: e } = await supabaseAdmin.from('cases').select('id, resolved_at').in('id', caseIds.slice(i, i + 300)).eq('status', 'RESOLVED')
    if (e) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    for (const c of data ?? []) resolved.push({ case_id: c.id as string, resolved_at: (c.resolved_at as string | null) ?? null })
  }

  const { data: mine } = await supabaseAdmin
    .from('contributions')
    .select('kind, indicator_codes, case_id, created_at')
    .eq('user_id', auth.appUser.id)
    .neq('kind', 'THANKS')
    .order('created_at', { ascending: false })
    .limit(500)
  const now = new Date()
  return NextResponse.json({
    code,
    resolved: resolvedForIndicator(resolved, now),
    mine: summarizeContributions((mine ?? []) as ContributionRow[], now).byIndicator[code] ?? 0,
    facing: WORLD_COUNTS[code] ?? null,
    possible: WORLD_POPULATION,
  })
}
