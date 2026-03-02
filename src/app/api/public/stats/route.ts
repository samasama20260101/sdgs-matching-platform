// src/app/api/public/stats/route.ts（認証不要）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const [{ count: resolvedCount }, { count: supporterCount }, { data: areas }] = await Promise.all([
    supabaseAdmin.from('cases').select('*', { count: 'exact', head: true }).eq('status', 'RESOLVED'),
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'SUPPORTER'),
    supabaseAdmin.from('users').select('service_areas, service_area_nationwide').eq('role', 'SUPPORTER'),
  ])

  const prefSet = new Set<string>()
  let hasNationwide = false
  ;(areas || []).forEach((u: { service_area_nationwide: boolean; service_areas: Array<{ prefecture: string }> }) => {
    if (u.service_area_nationwide) { hasNationwide = true; return }
    ;(u.service_areas || []).forEach(a => { if (a.prefecture) prefSet.add(a.prefecture) })
  })

  return NextResponse.json({
    resolvedCount: resolvedCount ?? 0,
    supporterCount: supporterCount ?? 0,
    areaCount: hasNationwide ? 47 : prefSet.size,
  })
}
