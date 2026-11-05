// 運営のホームの道具の札に出す「待っている件数」(画面の見直し 所見 14)。GET → { vetting, indicators, inquiries }
// 審査 = 申し込み・面談の調整中の団体 / 指標の仕分け = 確かめ待ちの指標がある相談 / お問い合わせ = まだ対応していないもの
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  const [vetting, indicators, inquiries] = await Promise.all([
    supabaseAdmin.from('organizations').select('id', { count: 'exact', head: true }).in('vetting_status', ['APPLIED', 'INTERVIEW']).neq('status', 'ARCHIVED'),
    supabaseAdmin.from('case_indicators').select('case_id').eq('status', 'PROPOSED').limit(5000),
    supabaseAdmin.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'OPEN'),
  ])
  const failed = vetting.error ?? indicators.error ?? inquiries.error
  if (failed) {
    console.error('[api/admin/counts]', failed)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  return NextResponse.json({
    vetting: vetting.count ?? 0,
    indicators: new Set((indicators.data ?? []).map((r) => r.case_id as string)).size,
    inquiries: inquiries.count ?? 0,
  })
}
