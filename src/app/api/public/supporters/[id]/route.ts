// src/app/api/public/supporters/[id]/route.ts（認証不要）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const { data: supporter, error } = await supabaseAdmin
        .from('users')
        .select('id, display_name, organization_name, supporter_type, bio, social_links, created_at')
        .eq('id', id)
        .eq('role', 'SUPPORTER')
        .single()

    if (error || !supporter) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [{ count: resolvedCount }, { data: badges }, { data: serviceAreas }] = await Promise.all([
        supabaseAdmin.from('offers').select('*', { count: 'exact', head: true })
            .eq('supporter_user_id', id).eq('status', 'ACCEPTED'),
        supabaseAdmin.from('supporter_badges')
            .select('badge_key, created_at')
            .eq('supporter_user_id', id)
            .order('created_at', { ascending: false }),
        supabaseAdmin.from('supporter_service_areas')
            .select('region_code, is_nationwide, country')
            .eq('supporter_user_id', id),
    ])

    const badgeSummary: Record<string, number> = {}
    ;(badges || []).forEach((b: { badge_key: string }) => {
        badgeSummary[b.badge_key] = (badgeSummary[b.badge_key] || 0) + 1
    })

    // region_code → name を明示的に引く
    const regionCodes = (serviceAreas || []).filter((a: any) => a.region_code).map((a: any) => a.region_code as string)
    let regionMap: Record<string, { name_local: string; name_en: string }> = {}
    if (regionCodes.length > 0) {
        const { data: regionRows } = await supabaseAdmin
            .from('regions')
            .select('code, name_local, name_en')
            .in('code', regionCodes)
        regionMap = Object.fromEntries(
            (regionRows || []).map((r: any) => [r.code, { name_local: r.name_local, name_en: r.name_en }])
        )
    }

    const isNationwide = (serviceAreas || []).some((a: any) => a.is_nationwide)
    const regions = (serviceAreas || [])
        .filter((a: any) => !a.is_nationwide && a.region_code)
        .map((a: any) => ({
            region_code: a.region_code,
            country: a.country || 'JP',
            name_local: regionMap[a.region_code]?.name_local ?? a.region_code,
            name_en:    regionMap[a.region_code]?.name_en    ?? a.region_code,
        }))

    return NextResponse.json({
        supporter: {
            ...supporter,
            resolved_count: resolvedCount ?? 0,
            service_area_nationwide: isNationwide,
            service_areas: regions,
        },
        badges: badgeSummary,
    }, { headers: { 'Cache-Control': 'no-store' } })
}
