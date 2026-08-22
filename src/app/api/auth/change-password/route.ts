// src/app/api/auth/change-password/route.ts
// パスワード変更。検証と更新をサーバー側で一体に行う。
// クライアントで supabase.auth.updateUser を呼ぶ形だと、現在パスワードの確認を
// コンソールから素通りできてしまうため、この経路に集約する。
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { verifyCurrentPassword, isAcceptablePassword } from '@/lib/api/password'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const auth = await requireActiveAppUser(request)
    if ('response' in auth) return auth.response

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    if (!isAcceptablePassword(body.new_password)) {
        return NextResponse.json({ error: 'INVALID_NEW_PASSWORD' }, { status: 400 })
    }

    const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, email, must_change_password')
        .eq('id', auth.appUser.id)
        .single()

    if (userError || !userData) {
        console.error('[auth/change-password] user fetch error:', userError)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }

    // 初回強制変更は、直前にその初期パスワードでログインしたばかりなので再入力を求めない。
    // 自発的な変更のときだけ現在パスワードを必須にする（判定はサーバー側で行う）。
    if (!userData.must_change_password) {
        if (typeof body.current_password !== 'string' || !body.current_password) {
            return NextResponse.json({ error: 'CURRENT_PASSWORD_REQUIRED' }, { status: 400 })
        }
        const verified = await verifyCurrentPassword(userData.email, body.current_password)
        if (!verified) {
            return NextResponse.json({ error: 'CURRENT_PASSWORD_MISMATCH' }, { status: 403 })
        }
        if (body.current_password === body.new_password) {
            return NextResponse.json({ error: 'SAME_AS_CURRENT' }, { status: 400 })
        }
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        auth.appUser.auth_user_id,
        { password: body.new_password }
    )
    if (updateError) {
        console.error('[auth/change-password] password update error:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    if (userData.must_change_password) {
        const { error: flagError } = await supabaseAdmin
            .from('users')
            .update({ must_change_password: false, updated_at: new Date().toISOString() })
            .eq('id', auth.appUser.id)
        if (flagError) {
            // パスワード自体は変わっているので、フラグ解除の失敗では 500 を返さない
            console.error('[auth/change-password] flag clear error:', flagError)
        }
    }

    return NextResponse.json({ ok: true, was_forced: Boolean(userData.must_change_password) })
}
