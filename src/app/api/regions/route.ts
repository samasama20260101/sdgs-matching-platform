// src/app/api/regions/route.ts（認証不要・公開）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country') || 'JP'
    const level = searchParams.get('level') || 'prefecture'

    const { data: regions, error } = await supabaseAdmin
        .from('regions')
        .select('code, country, level, name_local, name_en')
        .eq('country', country)
        .eq('level', level)
        .order('sort_order', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
        { regions: regions || [] },
        { headers: { 'Cache-Control': 'public, max-age=86400' } }  // 1日キャッシュ（マスタデータなので長めでOK）
    )
}