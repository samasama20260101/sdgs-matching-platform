// src/app/api/auth/get-role/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { getActiveOrganizationForUser, type ActiveOrganizationContext } from '@/lib/organizations'
import { NextResponse } from 'next/server'

type RegionRow = { code: string; name_local: string; name_en: string }
type ServiceAreaRow = {
    region_code: string | null
    is_nationwide: boolean
    country: string | null
}
type ServiceArea = {
    region_code: string | null
    is_nationwide: boolean
    country: string
    name_local: string
    name_en: string
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id, role, real_name, display_name, display_id, email, phone, organization_name, supporter_type, postal_code, prefecture, city, address_structured, must_change_password, bio, social_links, sos_region_code, is_suspended')
        .eq('auth_user_id', user.id)
        .single()

    // 停止済みユーザーは即時拒否
    if (userData?.is_suspended) {
        return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
    }

    // サポーターの活動地域を取得
    let serviceAreas: ServiceArea[] = []
    let serviceAreaNationwide = false
    let organizationContext: ActiveOrganizationContext | null = null
    if (userData?.role === 'SUPPORTER') {
        organizationContext = await getActiveOrganizationForUser(userData.id)

        // Step1: 活動地域レコード取得
        const areasQuery = supabaseAdmin
            .from('supporter_service_areas')
            .select('region_code, is_nationwide, country')
            .eq('organization_id', organizationContext?.organizationId ?? '')
        const { data: areas, error: areasError } = await areasQuery

        if (areasError) {
            console.error('[get-role] supporter_service_areas fetch error:', areasError)
        }

        const areaRows = (areas || []) as ServiceAreaRow[]
        if (areaRows.length > 0) {
            // Step2: region_codeからregionsテーブルを明示的に引く（FK依存を回避）
            const codes = areaRows.filter((a) => a.region_code).map((a) => a.region_code as string)
            let regionMap: Record<string, { name_local: string; name_en: string }> = {}

            if (codes.length > 0) {
                const { data: regionRows } = await supabaseAdmin
                    .from('regions')
                    .select('code, name_local, name_en')
                    .in('code', codes)
                regionMap = Object.fromEntries(
                    ((regionRows || []) as RegionRow[]).map((r) => [r.code, { name_local: r.name_local, name_en: r.name_en }])
                )
            }

            serviceAreas = areaRows.map((a) => {
                const code = a.region_code
                return {
                    region_code: code,
                    is_nationwide: a.is_nationwide,
                    country: a.country || 'JP',
                    name_local: code ? regionMap[code]?.name_local ?? code : '',
                    name_en: code ? regionMap[code]?.name_en ?? code : '',
                }
            })
        }

        serviceAreaNationwide = areaRows.some((a) => a.is_nationwide)
    }

    return NextResponse.json({
        role: userData?.role ?? null,
        user: userData ? {
            ...userData,
            organization_id: organizationContext?.organizationId ?? null,
            organization_role: organizationContext?.organizationRole ?? null,
            membership_department: organizationContext?.department ?? null,
            membership_external_phone: organizationContext?.externalPhone ?? null,
            membership_phone_extension: organizationContext?.phoneExtension ?? null,
            organization: organizationContext?.organization ?? null,
            organization_name: organizationContext?.organization.name ?? userData.organization_name,
            organization_phone: organizationContext?.organization.phone ?? null,
            postal_code: organizationContext?.organization.postal_code ?? userData.postal_code,
            prefecture: organizationContext?.organization.prefecture ?? userData.prefecture,
            city: organizationContext?.organization.city ?? userData.city,
            address_structured: organizationContext?.organization.address_structured ?? userData.address_structured,
            supporter_type: organizationContext?.organization.supporter_type ?? userData.supporter_type,
            bio: organizationContext?.organization.bio ?? userData.bio,
            social_links: organizationContext?.organization.social_links ?? userData.social_links,
            service_areas: serviceAreas,
            service_area_nationwide: serviceAreaNationwide,
        } : null,
    })
}
