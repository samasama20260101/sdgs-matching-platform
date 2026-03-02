// src/app/api/public/supporters/route.ts（認証不要）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data: supporters, error } = await supabaseAdmin
    .from('users')
    .select('id, display_name, organization_name, supporter_type, service_area_nationwide, service_areas, created_at')
    .eq('role', 'SUPPORTER')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('supporters API error:', error)
    return NextResponse.json({ error: error.message, supporters: [] }, { status: 500 })
  }

  if (!supporters || supporters.length === 0) return NextResponse.json({ supporters: [] })

  const ids = supporters.map((s: { id: string }) => s.id)

  const [{ data: resolvedOffers }, { data: badges }] = await Promise.all([
    supabaseAdmin.from('offers')
      .select('supporter_user_id')
      .in('supporter_user_id', ids)
      .eq('status', 'ACCEPTED'),
    supabaseAdmin.from('supporter_badges')
      .select('supporter_user_id')
      .in('supporter_user_id', ids),
  ])

  const resolvedMap: Record<string, number> = {}
  ;(resolvedOffers || []).forEach((o: { supporter_user_id: string }) => {
    resolvedMap[o.supporter_user_id] = (resolvedMap[o.supporter_user_id] || 0) + 1
  })
  const badgeMap: Record<string, number> = {}
  ;(badges || []).forEach((b: { supporter_user_id: string }) => {
    badgeMap[b.supporter_user_id] = (badgeMap[b.supporter_user_id] || 0) + 1
  })

  return NextResponse.json({
    supporters: supporters.map((s: { id: string }) => ({
      ...s,
      resolved_count: resolvedMap[s.id] || 0,
      badge_count: badgeMap[s.id] || 0,
    }))
  })
}
