// src/app/api/auth/get-role/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
        .select('id, role, real_name, display_name, display_id, email, phone, organization_name, supporter_type, postal_code, prefecture, city, address_structured, must_change_password, bio, social_links, sos_region_code')
        .eq('auth_user_id', user.id)
        .single()

    // サポーターの活動地域を取得
    let serviceAreas: any[] = []
    let serviceAreaNationwide = false
    if (userData?.role === 'SUPPORTER') {
        // Step1: 活動地域レコード取得
        const { data: areas, error: areasError } = await supabaseAdmin
            .from('supporter_service_areas')
            .select('region_code, is_nationwide, country')
            .eq('supporter_user_id', userData.id)

        if (areasError) {
            console.error('[get-role] supporter_service_areas fetch error:', areasError)
        }

        if (areas && areas.length > 0) {
            // Step2: region_codeからregionsテーブルを明示的に引く（FK依存を回避）
            const codes = areas.filter((a: any) => a.region_code).map((a: any) => a.region_code)
            let regionMap: Record<string, { name_local: string; name_en: string }> = {}

            if (codes.length > 0) {
                const { data: regionRows } = await supabaseAdmin
                    .from('regions')
                    .select('code, name_local, name_en')
                    .in('code', codes)
                regionMap = Object.fromEntries(
                    (regionRows || []).map((r: any) => [r.code, { name_local: r.name_local, name_en: r.name_en }])
                )
            }

            serviceAreas = areas.map((a: any) => ({
                region_code: a.region_code,
                is_nationwide: a.is_nationwide,
                country: a.country || 'JP',
                name_local: regionMap[a.region_code]?.name_local ?? a.region_code ?? '',
                name_en:    regionMap[a.region_code]?.name_en    ?? a.region_code ?? '',
            }))
        }

        serviceAreaNationwide = (areas || []).some((a: any) => a.is_nationwide)
    }

    return NextResponse.json({
        role: userData?.role ?? null,
        user: userData ? { ...userData, service_areas: serviceAreas, service_area_nationwide: serviceAreaNationwide } : null,
    })
}