// 運営｜分析(盤 51)。今月の相談・解決まで届いた割合・24時間申し出のない相談・支え手の数・申し出が少ない指標
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0
  const [thisMonth, resolved, closedAll, unmatched, orgs, individuals] = await Promise.all([
    count(supabaseAdmin.from('cases').select('id', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString())),
    count(supabaseAdmin.from('cases').select('id', { count: 'exact', head: true }).eq('status', 'RESOLVED')),
    count(supabaseAdmin.from('cases').select('id', { count: 'exact', head: true }).in('status', ['RESOLVED', 'CLOSED', 'CANCELLED'])),
    count(supabaseAdmin.from('cases').select('id', { count: 'exact', head: true }).eq('status', 'OPEN').not('escalated_at', 'is', null)),
    count(supabaseAdmin.from('organizations').select('id', { count: 'exact', head: true }).eq('vetting_status', 'APPROVED')),
    count(supabaseAdmin.from('supporter_profiles').select('user_id', { count: 'exact', head: true }).eq('status', 'ACTIVE')),
  ])
  // 申し出が少ない指標: 受付中の相談の指標ごとの件数
  const { data: open } = await supabaseAdmin.from('cases').select('id, intake_qna').eq('status', 'OPEN').limit(1000)
  const byCode: Record<string, number> = {}
  for (const c of open ?? []) for (const code of ((c.intake_qna as { indicators?: string[] } | null)?.indicators ?? [])) byCode[code] = (byCode[code] ?? 0) + 1
  return NextResponse.json({
    thisMonth,
    resolvedRate: closedAll > 0 ? Math.round((resolved / closedAll) * 100) : null,
    unmatched,
    supporters: { organizations: orgs, individuals },
    waitingByIndicator: Object.entries(byCode).sort((a, b) => b[1] - a[1]).slice(0, 10),
  })
}
