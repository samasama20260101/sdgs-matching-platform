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
        .select('id, role, real_name, display_name, display_id, email, phone, organization_name, supporter_type, postal_code, prefecture, city, address_structured, must_change_password, bio, social_links, sos_region_code, is_suspended, parent_supporter_id, auth_user_id')
        .eq('auth_user_id', user.id)
        .single()

    // 停止済みユーザーは即時拒否
    if (userData?.is_suspended) {
        return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
    }

    // サブアカウントの場合は親団体として完全に振る舞う
    // id を親のIDに差し替えることで、dashboard/offers/chat等すべてのAPIが親名義で動作する
    let effectiveUserData = userData
    if (userData?.parent_supporter_id) {
        const { data: parentData } = await supabaseAdmin
            .from('users')
            .select('id, role, real_name, display_name, display_id, organization_name, supporter_type, bio, social_links, postal_code, prefecture, city, address_structured, phone, email, sos_region_code, is_suspended, must_change_password')
            .eq('id', userData.parent_supporter_id)
            .single()
        if (parentData) {
            effectiveUserData = {
                ...parentData,
                auth_user_id: userData.auth_user_id,
                parent_supporter_id: userData.parent_supporter_id,
                is_sub_account: true,
                sub_real_name: userData.real_name,
                // must_change_password は子自身の値を使う（初回ログイン時の変更強制）
                must_change_password: userData.must_change_password,
            } as any
        }
    }

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
        role: effectiveUserData?.role ?? null,
        user: effectiveUserData ? { ...effectiveUserData, service_areas: serviceAreas, service_area_nationwide: serviceAreaNationwide } : null,
    })
}