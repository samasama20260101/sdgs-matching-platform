// src/app/api/auth/email-change-check/route.ts
// 本人によるメールアドレス変更の事前確認。
//
// 実際の差し替えはクライアントの supabase.auth.updateUser({ email }) が行う。
// アプリ自身がメールを送る仕組みを持っておらず、新アドレスへの確認メールを飛ばせるのが
// この経路だけのため（サーバーの Admin API で変えると確認なしで即時に切り替わってしまう）。
//
// したがって、ここでの現在パスワード確認は「操作者が本人であることのUI上の確認」であり、
// 乗っ取りに対する実質的な防御は GoTrue が送る確認メールの側にある。
// Supabase の Secure email change（新旧両方のアドレスで確認を要求）を必ず有効にしておくこと。
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { verifyCurrentPassword } from '@/lib/api/password'
import { normalizeEmail } from '@/lib/api/validation'
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

    const newEmail = normalizeEmail(body.new_email)
    if (!newEmail) {
        return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 })
    }

    const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .eq('id', auth.appUser.id)
        .single()

    if (userError || !userData) {
        console.error('[auth/email-change-check] user fetch error:', userError)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }

    if (newEmail === (userData.email ?? '').trim().toLowerCase()) {
        return NextResponse.json({ error: 'SAME_AS_CURRENT' }, { status: 400 })
    }

    if (typeof body.current_password !== 'string' || !body.current_password) {
        return NextResponse.json({ error: 'CURRENT_PASSWORD_REQUIRED' }, { status: 400 })
    }
    const verified = await verifyCurrentPassword(userData.email, body.current_password)
    if (!verified) {
        return NextResponse.json({ error: 'CURRENT_PASSWORD_MISMATCH' }, { status: 403 })
    }

    // users.email には lower(btrim(email)) の UNIQUE インデックスがあるため、
    // 使用済みアドレスは自己修復同期の時点で必ず衝突する。先にここで弾く。
    const { data: taken, error: takenError } = await supabaseAdmin
        .from('users')
        .select('id')
        .ilike('email', newEmail)
        .maybeSingle()
    if (takenError) {
        console.error('[auth/email-change-check] duplicate check error:', takenError)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }
    if (taken) {
        return NextResponse.json({ error: 'EMAIL_ALREADY_USED' }, { status: 409 })
    }

    return NextResponse.json({ ok: true, new_email: newEmail })
}
