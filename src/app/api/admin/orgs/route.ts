// 運営｜審査(盤 51): 団体の申し込みの一覧。?status=APPLIED|INTERVIEW|APPROVED|REJECTED|SUSPENDED
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

const STATUSES = ['APPLIED', 'INTERVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED']

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  const status = new URL(request.url).searchParams.get('status') ?? 'APPLIED'
  if (!STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  // 一覧と、審査の段階ごとの件数を並べて読む
  const [{ data, error }, ...countResults] = await Promise.all([
    supabaseAdmin
      .from('organizations')
      .select('id, display_id, name, org_type, vetting_status, applied_at, approved_at, application, contact_email, region_country, prefecture, population, created_at')
      .eq('vetting_status', status)
      .order('created_at', { ascending: false })
      .limit(200),
    ...STATUSES.map((s) => supabaseAdmin.from('organizations').select('id', { count: 'exact', head: true }).eq('vetting_status', s)),
  ])
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  const counts: Record<string, number> = Object.fromEntries(STATUSES.map((s, i) => [s, countResults[i].count ?? 0]))
  return NextResponse.json({ organizations: data ?? [], counts })
}
