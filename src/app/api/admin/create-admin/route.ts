// src/app/api/admin/create-admin/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 操作者がADMINであることを確認
    const { data: adminUser } = await supabaseAdmin
        .from('users').select('role').eq('auth_user_id', user.id).single()
    if (!adminUser || adminUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { email, password, real_name, display_name } = await request.json()
    if (!email || !password || !real_name) {
        return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    // Supabase Auth にユーザーを作成
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    })
    if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // display_id を採番
    const { data: displayIdRow, error: seqError } = await supabaseAdmin
        .rpc('generate_display_id', { p_role: 'ADMIN' })
    if (seqError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json({ error: 'ID採番に失敗しました' }, { status: 500 })
    }

    // users テーブルにレコード作成
    const { data: newUser, error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
            auth_user_id: authData.user.id,
            role: 'ADMIN',
            real_name,
            display_name: display_name || real_name,
            display_id: displayIdRow,
            email,
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
