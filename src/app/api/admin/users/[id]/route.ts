// src/app/api/admin/users/[id]/route.ts
// 管理者によるユーザー操作（停止・削除）

import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 管理者確認
async function checkAdmin(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    const { data } = await supabaseAdmin.from('users').select('role').eq('auth_user_id', user.id).single()
    return data?.role === 'ADMIN' ? user : null
}

// PATCH: アカウント停止 / 停止解除
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const admin = await checkAdmin(request)
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const { action } = await request.json() // action: 'suspend' | 'unsuspend'
    const { id: userId } = await params

    // public.users から auth_user_id を取得
    const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('auth_user_id, role')
        .eq('id', userId)
        .single()

    if (userError || !userData) {
        return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    if (action === 'suspend') {
        // Supabase Auth でバン（ログイン不可）
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userData.auth_user_id, {
            ban_duration: '876600h', // 100年 = 実質永久停止
        })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // 既存セッションを即時無効化（ログイン中でも即反映）
        await supabaseAdmin.auth.admin.signOut(userData.auth_user_id, 'global')

        // public.users に停止フラグを記録
        await supabaseAdmin.from('users').update({ is_suspended: true }).eq('id', userId)

    } else if (action === 'unsuspend') {
        // バン解除
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userData.auth_user_id, {
            ban_duration: 'none',
        })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        await supabaseAdmin.from('users').update({ is_suspended: false }).eq('id', userId)
    }

    return NextResponse.json({ success: true })
}

// DELETE: アカウント削除
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const admin = await checkAdmin(request)
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const { id: userId } = await params

    // public.users から auth_user_id を取得
    const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('auth_user_id')
        .eq('id', userId)
        .single()

    if (userError || !userData) {
        return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    // 既存セッションを即時無効化（削除前に実行）
    await supabaseAdmin.auth.admin.signOut(userData.auth_user_id, 'global')

    // public.users を削除（CASCADE で関連データも削除）
    const { error: deleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    // Supabase Auth からも削除
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userData.auth_user_id)
    if (authDeleteError) return NextResponse.json({ error: authDeleteError.message }, { status: 500 })

    return NextResponse.json({ success: true })
}
