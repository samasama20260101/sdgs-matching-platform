// src/app/api/public/supporters/[id]/route.ts（認証不要）
import { supabaseAdmin } from '@/lib/supabase/server'
import { isUuid } from '@/lib/api/validation'
import { NextResponse } from 'next/server'

type RegionRow = { code: string; name_local: string; name_en: string }
type ServiceAreaRow = {
    region_code: string | null
    is_nationwide: boolean
    country: string | null
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let { data: organization, error } = await supabaseAdmin
        .from('organizations')
        .select('id, name, supporter_type, bio, social_links, created_at')
        .eq('id', id)
        .eq('status', 'ACTIVE')
        .maybeSingle()

    // 旧URL（/supporters/{user_id}）から来た場合の互換。
    if (!organization) {
        const { data: membership } = await supabaseAdmin
            .from('organization_memberships')
            .select('organization_id')
            .eq('user_id', id)
            .eq('status', 'ACTIVE')
            .maybeSingle()
        if (membership?.organization_id) {
            const result = await supabaseAdmin
                .from('organizations')
                .select('id, name, supporter_type, bio, social_links, created_at')
                .eq('id', membership.organization_id)
                .eq('status', 'ACTIVE')
                .maybeSingle()
            organization = result.data
            error = result.error
        }
    }

    if (error || !organization) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [{ count: resolvedCount }, { data: badges }, { data: serviceAreas }] = await Promise.all([
        supabaseAdmin.from('offers').select('*', { count: 'exact', head: true })
            .eq('supporter_organization_id', organization.id).eq('status', 'ACCEPTED'),
        supabaseAdmin.from('supporter_badges')
            .select('badge_key, created_at')
            .eq('supporter_organization_id', organization.id)
            .order('created_at', { ascending: false }),
        supabaseAdmin.from('supporter_service_areas')
            .select('region_code, is_nationwide, country')
            .eq('organization_id', organization.id),
    ])

    const badgeSummary: Record<string, number> = {}
    ;(badges || []).forEach((b: { badge_key: string }) => {
        badgeSummary[b.badge_key] = (badgeSummary[b.badge_key] || 0) + 1
    })

    // region_code → name を明示的に引く
    const serviceAreaRows = (serviceAreas || []) as ServiceAreaRow[]
    const regionCodes = serviceAreaRows.filter((a) => a.region_code).map((a) => a.region_code as string)
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

    const isNationwide = serviceAreaRows.some((a) => a.is_nationwide)
    const regions = serviceAreaRows
        .filter((a) => !a.is_nationwide && a.region_code)
        .map((a) => {
            const code = a.region_code as string
            return {
                region_code: code,
                country: a.country || 'JP',
                name_local: regionMap[code]?.name_local ?? code,
                name_en: regionMap[code]?.name_en ?? code,
            }
        })

    return NextResponse.json({
        supporter: {
            id: organization.id,
            display_name: organization.name,
            organization_name: organization.name,
            supporter_type: organization.supporter_type,
            bio: organization.bio,
            social_links: organization.social_links,
            created_at: organization.created_at,
            resolved_count: resolvedCount ?? 0,
            service_area_nationwide: isNationwide,
            service_areas: regions,
        },
        badges: badgeSummary,
    }, { headers: { 'Cache-Control': 'no-store' } })
}
