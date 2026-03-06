// src/app/api/contact/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const body = await request.json()
    const { name, email, organization, phone, category, message, access_token } = body

    if (!email || !category || !message) {
        return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    let userId: string | null = null
    let role: string | null = null
    let displayId: string | null = null

    // ログイン済みの場合はユーザー情報を取得
    if (access_token) {
        const { data: { user } } = await supabaseAdmin.auth.getUser(access_token)
        if (user) {
            const { data: userData } = await supabaseAdmin
                .from('users')
                .select('id, role, display_id')
                .eq('auth_user_id', user.id)
                .single()
            if (userData) {
                userId = userData.id
                role = userData.role
                displayId = userData.display_id
            }
        }
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
            phone: userId ? null : phone,
            category,
            message,
        }])
        .select('display_id')
        .single()

    if (error) {
        console.error('[contact] insert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, display_id: data.display_id })
}
