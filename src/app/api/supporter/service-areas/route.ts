// src/app/api/supporter/service-areas/route.ts
// サポーターの活動地域を直接取得・更新するAPI
import { supabaseAdmin } from '@/lib/supabase/server'
import { getActiveOrganizationForUser } from '@/lib/organizations'
import { NextResponse } from 'next/server'

type RegionRow = { code: string; name_local: string; name_en: string }
type ServiceAreaRow = {
    region_code: string | null
    is_nationwide: boolean
    country: string | null
}
type ServiceAreaInput = {
    region_code: string
    country?: string | null
}

async function getUser(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .eq('auth_user_id', user.id)
        .single()
    return userData
}

// GET: 現在の活動地域を取得
export async function GET(request: Request) {
    const userData = await getUser(request)
    if (!userData || userData.role !== 'SUPPORTER') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const organizationContext = await getActiveOrganizationForUser(userData.id)
    if (!organizationContext) {
        return NextResponse.json({ error: '有効な団体所属がありません', code: 'NO_ACTIVE_ORGANIZATION' }, { status: 403 })
    }
    // Step1: supporter_service_areas 取得
    const areasQuery = supabaseAdmin
        .from('supporter_service_areas')
        .select('id, region_code, is_nationwide, country')
        .eq('organization_id', organizationContext.organizationId)
    const { data: areas, error: areasError } = await areasQuery

    if (areasError) {
        console.error('[service-areas GET] error:', areasError)
        return NextResponse.json({ error: areasError.message }, { status: 500 })
    }

    const areaRows = (areas || []) as ServiceAreaRow[]
    const isNationwide = areaRows.some((a) => a.is_nationwide)

    if (areaRows.length === 0) {
        return NextResponse.json({ service_areas: [], service_area_nationwide: false })
    }

    // Step2: region_code → name を明示的に引く
    const codes = areaRows.filter((a) => a.region_code).map((a) => a.region_code as string)
    let regionMap: Record<string, { name_local: string; name_en: string }> = {}

    if (codes.length > 0) {
        const { data: regionRows, error: regionError } = await supabaseAdmin
            .from('regions')
            .select('code, name_local, name_en')
            .in('code', codes)

        if (regionError) {
            console.error('[service-areas GET] regions error:', regionError)
        }

        regionMap = Object.fromEntries(
            ((regionRows || []) as RegionRow[]).map((r) => [r.code, { name_local: r.name_local, name_en: r.name_en }])
        )
    }

    const serviceAreas = areaRows
        .filter((a) => !a.is_nationwide)
        .map((a) => {
            const code = a.region_code
            return {
                region_code: code,
                country: a.country || 'JP',
                name_local: code ? regionMap[code]?.name_local ?? code : '',
                name_en: code ? regionMap[code]?.name_en ?? code : '',
            }
        })

    return NextResponse.json({
        service_areas: serviceAreas,
        service_area_nationwide: isNationwide,
    })
}

// PUT: 活動地域を更新（全削除→再挿入）
export async function PUT(request: Request) {
    const userData = await getUser(request)
    if (!userData || userData.role !== 'SUPPORTER') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const organizationContext = await getActiveOrganizationForUser(userData.id)
    if (!organizationContext) {
        return NextResponse.json({ error: '有効な団体所属がありません', code: 'NO_ACTIVE_ORGANIZATION' }, { status: 403 })
    }
    if (organizationContext.organizationRole !== 'OWNER') {
        return NextResponse.json({ error: '活動地域を変更できるのはOWNERのみです', code: 'FORBIDDEN' }, { status: 403 })
    }

    const { service_areas, service_area_nationwide } = await request.json()

    // 既存データを全削除
    const deleteQuery = supabaseAdmin
        .from('supporter_service_areas')
        .delete()
        .eq('organization_id', organizationContext.organizationId)
    const { error: deleteError } = await deleteQuery

    if (deleteError) {
        console.error('[service-areas PUT] delete error:', deleteError)
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    if (service_area_nationwide) {
        const { error: insertError } = await supabaseAdmin
            .from('supporter_service_areas')
            .insert([{
                supporter_user_id: userData.id,
                organization_id: organizationContext.organizationId,
                region_code: null,
                country: 'JP',
                is_nationwide: true,
            }])
        if (insertError) {
            console.error('[service-areas PUT] insert nationwide error:', insertError)
            return NextResponse.json({ error: insertError.message }, { status: 500 })
        }
    } else if (Array.isArray(service_areas) && service_areas.length > 0) {
        const rows = (service_areas as ServiceAreaInput[]).map((a) => ({
            supporter_user_id: userData.id,
            organization_id: organizationContext.organizationId,
            region_code: a.region_code,
            country: a.country || 'JP',
            is_nationwide: false,
        }))
        const { error: insertError } = await supabaseAdmin
            .from('supporter_service_areas')
            .insert(rows)
        if (insertError) {
            console.error('[service-areas PUT] insert error:', insertError)
            return NextResponse.json({ error: insertError.message }, { status: 500 })
        }
    }

    return NextResponse.json({ ok: true })
}
