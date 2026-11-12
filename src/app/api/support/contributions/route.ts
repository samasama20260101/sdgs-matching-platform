// わたしの社会貢献(盤 30)。関わった解決した相談の数(m)と指標ごとの数、ありがとうは別に数える(11/12。人口を掛けるスコアはやめた)。
// 記録には相談の中身を出さない(指標とその時の所属だけ。団体を抜けても記録は残る)
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { summarizeContributions, type ContributionRow } from '@/lib/domain/score'

export async function GET(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  const { data, error } = await supabaseAdmin
    .from('contributions')
    .select('kind, indicator_codes, case_id, organization_id, created_at')
    .eq('user_id', auth.appUser.id)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  const rows = (data ?? []) as (ContributionRow & { organization_id: string | null })[]
  const orgIds = [...new Set(rows.map((r) => r.organization_id).filter((v): v is string => Boolean(v)))]
  const { data: orgs } = orgIds.length ? await supabaseAdmin.from('organizations').select('id, name').in('id', orgIds) : { data: [] as { id: string; name: string }[] }
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]))
  return NextResponse.json({
    summary: summarizeContributions(rows, new Date()),
    records: rows.filter((r) => r.kind !== 'CORRECTION').slice(0, 100).map((r) => ({
      kind: r.kind,
      at: r.created_at,
      organization: r.organization_id ? orgName.get(r.organization_id) ?? null : null,
      indicators: r.indicator_codes,
    })),
  })
}
