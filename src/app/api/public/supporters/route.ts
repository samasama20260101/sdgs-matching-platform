// src/app/api/public/supporters/route.ts（認証不要）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type RegionRow = { code: string; name_local: string; name_en: string }
type ServiceAreaRow = {
    organization_id: string
    region_code: string | null
    is_nationwide: boolean
    country: string | null
}
type ServiceArea = {
    region_code: string
    country: string
    name_local: string
    name_en: string
}

export async function GET() {
    const { data: supporters, error } = await supabaseAdmin
        .from('organizations')
        .select('id, name, supporter_type, created_at')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(100)  // 上限100件（将来的にページネーション対応予定）

    if (error) {
        console.error('supporters API error:', error)
        return NextResponse.json({ error: error.message, supporters: [] }, { status: 500 })
    }

    if (!supporters || supporters.length === 0) return NextResponse.json({ supporters: [] })

    const ids = supporters.map((s: { id: string }) => s.id)

    const [{ data: resolvedOffers }, { data: badges }, { data: rawAreas }] = await Promise.all([
        supabaseAdmin.from('offers')
            .select('supporter_organization_id')
            .in('supporter_organization_id', ids)
            .eq('status', 'ACCEPTED'),
        supabaseAdmin.from('supporter_badges')
            .select('supporter_organization_id')
            .in('supporter_organization_id', ids),
        supabaseAdmin.from('supporter_service_areas')
            .select('organization_id, region_code, is_nationwide, country')
            .in('organization_id', ids),
    ])

    const resolvedMap: Record<string, number> = {}
    ;(resolvedOffers || []).forEach((o: { supporter_organization_id: string }) => {
        resolvedMap[o.supporter_organization_id] = (resolvedMap[o.supporter_organization_id] || 0) + 1
    })
    const badgeMap: Record<string, number> = {}
    ;(badges || []).forEach((b: { supporter_organization_id: string }) => {
        badgeMap[b.supporter_organization_id] = (badgeMap[b.supporter_organization_id] || 0) + 1
    })

    // region_code → name を明示的に引く（FK依存を回避）
    const areas = (rawAreas || []) as ServiceAreaRow[]
    const regionCodes = [...new Set(areas.filter((a) => a.region_code).map((a) => a.region_code as string))]
    let regionMap: Record<string, { name_local: string; name_en: string }> = {}
    if (regionCodes.length > 0) {
        const { data: regionRows } = await supabaseAdmin
            .from('regions')
            .select('code, name_local, name_en')
            .in('code', regionCodes)
        regionMap = Object.fromEntries(
            ((regionRows || []) as RegionRow[]).map((r) => [r.code, { name_local: r.name_local, name_en: r.name_en }])
        )
    }

    const areaMap: Record<string, { regions: ServiceArea[]; is_nationwide: boolean }> = {}
    areas.forEach((a) => {
        if (!areaMap[a.organization_id]) {
            areaMap[a.organization_id] = { regions: [], is_nationwide: false }
        }
        if (a.is_nationwide) {
            areaMap[a.organization_id].is_nationwide = true
        } else if (a.region_code) {
            areaMap[a.organization_id].regions.push({
                region_code: a.region_code,
                country: a.country || 'JP',
                name_local: regionMap[a.region_code]?.name_local ?? a.region_code,
                name_en:    regionMap[a.region_code]?.name_en    ?? a.region_code,
            })
        }
    })

    return NextResponse.json({
        supporters: supporters.map((s: { id: string; name: string; supporter_type: string | null }) => ({
            id: s.id,
            display_name: s.name,
            organization_name: s.name,
            supporter_type: s.supporter_type,
            resolved_count: resolvedMap[s.id] || 0,
            badge_count: badgeMap[s.id] || 0,
            service_area_nationwide: areaMap[s.id]?.is_nationwide || false,
            service_areas: areaMap[s.id]?.regions || [],
        }))
    }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
}
