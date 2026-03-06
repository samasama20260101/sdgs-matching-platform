// src/app/api/profile/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // service_areas（活動地域）を分離して別テーブルに保存
    const { service_areas, service_area_nationwide, ...updateData } = body

    // usersテーブル更新
    const { data: userData, error: updateError } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('auth_user_id', user.id)
        .select('id')
        .single()

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // サポーターの活動地域を更新
    if (service_areas !== undefined && userData) {
        // 既存データを全削除して入れ直す
        await supabaseAdmin
            .from('supporter_service_areas')
            .delete()
            .eq('supporter_user_id', userData.id)

        if (service_area_nationwide) {
            // 全国対応：1レコードのみ
            await supabaseAdmin.from('supporter_service_areas').insert([{
                supporter_user_id: userData.id,
                region_code: null,
                is_nationwide: true,
            }])
        } else if (Array.isArray(service_areas) && service_areas.length > 0) {
            const { error: insertError } = await supabaseAdmin.from('supporter_service_areas').insert(
                service_areas.map((a: any) => ({
                    supporter_user_id: userData.id,
                    region_code: a.region_code,
                    country: a.country || 'JP',
                    is_nationwide: false,
                }))
            )
            if (insertError) {
                console.error('[profile] supporter_service_areas insert error:', insertError)
                return NextResponse.json({ error: insertError.message }, { status: 500 })
            }
        }
    }

    return NextResponse.json({ ok: true })
}