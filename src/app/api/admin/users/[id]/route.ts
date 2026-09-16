// src/app/api/admin/users/[id]/route.ts
// 管理者によるユーザー操作（停止・停止解除・メールアドレス変更）

import { supabaseAdmin } from '@/lib/supabase/server'
import { isUuid, normalizeEmail } from '@/lib/api/validation'
import { NextResponse } from 'next/server'

// 管理者確認。監査ログの actor に使うため users.id も返す
async function checkAdmin(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    const { data } = await supabaseAdmin.from('users').select('id, role').eq('auth_user_id', user.id).single()
    return data?.role === 'ADMIN' ? { authUser: user, appUserId: data.id as string } : null
}

// PATCH: アカウント停止 / 停止解除 / メールアドレス変更
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const admin = await checkAdmin(request)
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const body = await request.json() // action: 'suspend' | 'unsuspend' | 'change_email'
    const { action } = body
    const { id: userId } = await params
    if (!isUuid(userId)) return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })

    // public.users から auth_user_id を取得
    const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('auth_user_id, role, email')
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

    } else if (action === 'change_email') {
        // 旧アドレスが受信できなくなった等、本人が自分で変更できない場合の救済経路。
        // 本人経路（確認メール方式）と違い、ここは新アドレスの所有確認をしない。
        // 運営が本人性を確認したうえで実行すること。
        const newEmail = normalizeEmail(body.new_email)
        if (!newEmail) {
            return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 })
        }
        if (newEmail === (userData.email ?? '').trim().toLowerCase()) {
            return NextResponse.json({ error: '現在のアドレスと同じです' }, { status: 400 })
        }

        const { data: taken, error: takenError } = await supabaseAdmin
            .from('users')
            .select('id')
            .ilike('email', newEmail)
            .maybeSingle()
        if (takenError) {
            console.error('[admin/users] duplicate check error:', takenError)
            return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
        }
        if (taken) {
            return NextResponse.json({ error: 'このメールアドレスは既に使われています' }, { status: 409 })
        }

        // auth.users と auth.identities は Admin API が整合を保って更新する。
        // email_confirm を付けないと未確認扱いになり、本番（メール確認ON）でログインできなくなる。
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
            userData.auth_user_id,
            { email: newEmail, email_confirm: true }
        )
        if (authUpdateError) {
            return NextResponse.json({ error: authUpdateError.message }, { status: 400 })
        }

        // アプリ側のコピーも即座に揃える（get-role の自己修復を待たない）
        const { error: appUpdateError } = await supabaseAdmin
            .from('users')
            .update({ email: newEmail, updated_at: new Date().toISOString() })
            .eq('id', userId)
        if (appUpdateError) {
            console.error('[admin/users] app email update error:', appUpdateError)
            return NextResponse.json(
                { error: '認証側は変更されましたが、アプリ側の反映に失敗しました。再実行してください' },
                { status: 500 }
            )
        }

        await supabaseAdmin.from('audit_logs').insert({
            actor_user_id: admin.appUserId,
            action: 'user_email_changed_by_admin',
            target_table: 'users',
            target_id: userId,
            metadata: { previous_email: userData.email, new_email: newEmail },
        })

        return NextResponse.json({ success: true, new_email: newEmail })
    }

    return NextResponse.json({ success: true })
}

// DELETE: アカウント削除
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const admin = await checkAdmin(request)
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const { id: userId } = await params
    if (!isUuid(userId)) return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
    return NextResponse.json({ error: 'アカウントの物理削除は無効化されています' }, { status: 405 })
}
