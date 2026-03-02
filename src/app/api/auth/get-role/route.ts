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
        .select('id, role, real_name, display_name, email, phone, organization_name, supporter_type, postal_code, prefecture, city, address_structured, must_change_password, bio, social_links, sos_region_code')
        .eq('auth_user_id', user.id)
        .single()

    // サポーターの活動地域を取得
    let serviceAreas: any[] = []
    let serviceAreaNationwide = false
    if (userData?.role === 'SUPPORTER') {
        const { data: areas } = await supabaseAdmin
            .from('supporter_service_areas')
            .select('region_code, is_nationwide, country, regions(name_local, name_en)')
            .eq('supporter_user_id', userData.id)
        // Supabaseのネスト構造をフラット化: { regions: { name_local } } → { name_local }
        serviceAreas = (areas || []).map((a: any) => ({
            region_code: a.region_code,
            is_nationwide: a.is_nationwide,
            country: a.country,
            name_local: a.regions?.name_local ?? a.region_code,
            name_en: a.regions?.name_en ?? a.region_code,
        }))
        serviceAreaNationwide = serviceAreas.some((a: any) => a.is_nationwide)
    }

    return NextResponse.json({
        role: userData?.role ?? null,
        user: userData ? { ...userData, service_areas: serviceAreas, service_area_nationwide: serviceAreaNationwide } : null,
    })
}