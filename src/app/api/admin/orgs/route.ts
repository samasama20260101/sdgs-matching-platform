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
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, display_id, name, org_type, vetting_status, applied_at, approved_at, application, contact_email, region_country, prefecture, population, created_at')
    .eq('vetting_status', status)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  const counts: Record<string, number> = {}
  for (const s of STATUSES) {
    const { count } = await supabaseAdmin.from('organizations').select('id', { count: 'exact', head: true }).eq('vetting_status', s)
    counts[s] = count ?? 0
  }
  return NextResponse.json({ organizations: data ?? [], counts })
}
