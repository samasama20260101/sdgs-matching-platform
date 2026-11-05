// src/app/api/contact/route.ts
// お問い合わせの受付。ログイン中なら Authorization の本人に結び付け、メールは Auth から取る(送られた値を信じない)
import { supabaseAdmin } from '@/lib/supabase/server'
import { getBearerToken } from '@/lib/api/auth'
import { NextResponse } from 'next/server'

const MAX_NAME_LENGTH = 100
const MAX_EMAIL_LENGTH = 254
const MAX_ORGANIZATION_LENGTH = 120
const MAX_CATEGORY_LENGTH = 50
const MAX_MESSAGE_LENGTH = 5000

function sanitizeText(value: unknown, maxLength: number) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export async function POST(request: Request) {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    const accessToken = getBearerToken(request)
    const name = sanitizeText(body.name, MAX_NAME_LENGTH)
    let email = sanitizeText(body.email, MAX_EMAIL_LENGTH).toLowerCase()
    const organization = sanitizeText(body.organization, MAX_ORGANIZATION_LENGTH)
    const category = sanitizeText(body.category, MAX_CATEGORY_LENGTH)
    const message = sanitizeText(body.message, MAX_MESSAGE_LENGTH)

    let userId: string | null = null
    let role: string | null = null

    // ログイン済みの場合はユーザー情報を取得(メールは Auth のものを使う)
    if (accessToken) {
        const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken)
        if (user) {
            const { data: userData } = await supabaseAdmin
                .from('users')
                .select('id, role')
                .eq('auth_user_id', user.id)
                .maybeSingle()
            if (userData) {
                userId = userData.id
                role = userData.role
                email = (user.email ?? '').toLowerCase()
            }
        }
    }

    if (!email || !category || !message || (!userId && !name)) {
        return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }
    if (typeof body.message === 'string' && body.message.length > MAX_MESSAGE_LENGTH) {
        return NextResponse.json({ error: `お問い合わせ内容は${MAX_MESSAGE_LENGTH}文字以内で入力してください` }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
        .from('inquiries')
        .insert([{
            display_id: '',  // トリガーで自動採番
            user_id: userId,
            role,
            name: userId ? null : name,        // ログイン済みはnull
            email,
            organization: userId ? null : organization,
            phone: null,
            category,
            message,
        }])
        .select('display_id')
        .single()

    if (error) {
        console.error('[contact] insert error:', error)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, display_id: data.display_id })
}
