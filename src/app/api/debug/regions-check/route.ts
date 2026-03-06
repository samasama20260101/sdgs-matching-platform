// src/app/api/debug/regions-check/route.ts
// 【開発専用】regionsテーブルの実際の構造とservice_areasの整合性を確認
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabaseAdmin
        .from('users').select('id, role').eq('auth_user_id', user.id).single()
    if (!userData) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // 1. supporter_service_areas の生データ
    const { data: rawAreas, error: areaErr } = await supabaseAdmin
        .from('supporter_service_areas')
        .select('*')
        .eq('supporter_user_id', userData.id)

    // 2. regionsテーブルのサンプル（全カラム）
    const { data: regionSample, error: regionErr } = await supabaseAdmin
        .from('regions')
        .select('*')
        .limit(3)

    // 3. rawAreasのregion_codeでregionsをcode列でIN検索
    const codes = (rawAreas || []).filter((a: any) => a.region_code).map((a: any) => a.region_code)
    const { data: matchByCode } = codes.length > 0
        ? await supabaseAdmin.from('regions').select('*').in('code', codes)
        : { data: [] }

    // 4. rawAreasのregion_codeでregionsをregion_code列でIN検索（設計書通り）
    const { data: matchByRegionCode } = codes.length > 0
        ? await supabaseAdmin.from('regions').select('*').in('region_code', codes)
        : { data: [] }

    return NextResponse.json({
        user_id: userData.id,
        role: userData.role,
        raw_service_areas: rawAreas,
        area_error: areaErr?.message,
        region_sample_columns: regionSample ? Object.keys(regionSample[0] || {}) : [],
        region_sample: regionSample,
        region_error: regionErr?.message,
        match_by_code_column: matchByCode,
        match_by_region_code_column: matchByCode ? 'error: this column may not exist' : matchByRegionCode,
    })
}
