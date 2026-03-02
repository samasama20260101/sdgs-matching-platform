// src/app/api/public/stats/route.ts（認証不要）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const [{ count: resolvedCount }, { count: supporterCount }, { data: areas }] = await Promise.all([
    supabaseAdmin.from('cases').select('*', { count: 'exact', head: true }).eq('status', 'RESOLVED'),
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'SUPPORTER'),
    supabaseAdmin.from('supporter_service_areas').select('region_code, is_nationwide, country'),
  ])

  const regionSet = new Set<string>()
  let hasNationwide = false
    ; (areas || []).forEach((a: { region_code: string; is_nationwide: boolean; country: string }) => {
      if (a.is_nationwide) { hasNationwide = true; return }
      if (a.region_code) regionSet.add(a.region_code)
    })

  return NextResponse.json({
    resolvedCount: resolvedCount ?? 0,
    supporterCount: supporterCount ?? 0,
    areaCount: hasNationwide ? 47 : regionSet.size,
  })
}