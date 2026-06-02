import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type RegionRow = {
    code: string
    country: string
    level: string
    name_local: string
    name_en: string | null
    sort_order?: number | null
}

type SosRegionRow = {
    sos_region_code: string | null
}

type ServiceAreaRow = {
    organization_id: string
    region_code: string | null
    country: string | null
    is_nationwide: boolean
}

async function verifyAdmin(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null

    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('auth_user_id', user.id)
        .single()

    return userData?.role === 'ADMIN' ? user : null
}

export async function GET(request: Request) {
    const admin = await verifyAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country') || 'JP'
    const level = searchParams.get('level') || 'prefecture'

    const [
        { data: regions, error: regionsError },
        { data: sosUsers, error: sosError },
        { data: serviceAreas, error: serviceAreaError },
    ] = await Promise.all([
        supabaseAdmin
            .from('regions')
            .select('code, country, level, name_local, name_en, sort_order')
            .eq('country', country)
            .eq('level', level)
            .order('sort_order', { ascending: true }),
        supabaseAdmin
            .from('users')
            .select('sos_region_code')
            .eq('role', 'SOS'),
        supabaseAdmin
            .from('supporter_service_areas')
            .select('organization_id, region_code, country, is_nationwide')
            .eq('country', country),
    ])

    if (regionsError) return NextResponse.json({ error: regionsError.message }, { status: 500 })
    if (sosError) return NextResponse.json({ error: sosError.message }, { status: 500 })
    if (serviceAreaError) return NextResponse.json({ error: serviceAreaError.message }, { status: 500 })

    const sosCounts = new Map<string, number>()
    const unmappedSosCounts = new Map<string, number>()
    const regionCodes = new Set(((regions ?? []) as RegionRow[]).map((region) => region.code))

    ;((sosUsers ?? []) as SosRegionRow[]).forEach((user) => {
        const code = user.sos_region_code
        if (!code) return
        if (regionCodes.has(code)) {
            sosCounts.set(code, (sosCounts.get(code) ?? 0) + 1)
        } else {
            unmappedSosCounts.set(code, (unmappedSosCounts.get(code) ?? 0) + 1)
        }
    })

    const supporterOrganizationSets = new Map<string, Set<string>>()
    const nationwideOrganizations = new Set<string>()

    ;((serviceAreas ?? []) as ServiceAreaRow[]).forEach((area) => {
        if (area.is_nationwide) {
            nationwideOrganizations.add(area.organization_id)
            return
        }
        if (!area.region_code) return
        if (!supporterOrganizationSets.has(area.region_code)) {
            supporterOrganizationSets.set(area.region_code, new Set<string>())
        }
        supporterOrganizationSets.get(area.region_code)?.add(area.organization_id)
    })

    const mappedRegions = ((regions ?? []) as RegionRow[]).map((region) => ({
        ...region,
        sos_users_count: sosCounts.get(region.code) ?? 0,
        supporter_organizations_count: supporterOrganizationSets.get(region.code)?.size ?? 0,
    }))

    return NextResponse.json({
        country,
        level,
        regions: mappedRegions,
        unmapped_sos_regions: Array.from(unmappedSosCounts.entries()).map(([code, count]) => ({ code, count })),
        nationwide_supporter_organizations_count: nationwideOrganizations.size,
        totals: {
            regions: mappedRegions.length,
            sos_users_with_region: Array.from(sosCounts.values()).reduce((sum, count) => sum + count, 0),
            sos_users_with_unmapped_region: Array.from(unmappedSosCounts.values()).reduce((sum, count) => sum + count, 0),
        },
    })
}
