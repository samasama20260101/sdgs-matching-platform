// src/app/api/admin/create-supporter/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    // 1. Authorizationヘッダーからトークンを取得してADMIN確認
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // service_role keyでトークンを検証
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminUser } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('auth_user_id', user.id)
        .single()

    if (!adminUser || adminUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. リクエストボディを取得
    const body = await request.json()
    const {
        email,
        password,
        real_name,
        display_name,
        organization_name,
        supporter_type,
        phone,
        service_area_nationwide,
    } = body

    if (!email || !password || !real_name || !organization_name || !supporter_type) {
        return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    // 3. Supabase Auth にユーザーを作成
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    })

    if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 4. users テーブルにレコード作成
    const { data: newUser, error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
            auth_user_id: authData.user.id,
            role: 'SUPPORTER',
            real_name,
            display_name: display_name || real_name,
            email,
            phone: phone || null,
            organization_name,
            supporter_type,
            service_area_nationwide: service_area_nationwide ?? false,
            must_change_password: true,
        })
        .select()
        .single()

    if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ user: newUser })
}