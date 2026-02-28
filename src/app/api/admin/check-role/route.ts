// src/app/api/admin/check-role/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // トークンからユーザーを取得
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // service_role keyでRLSをバイパスしてロールを取得
    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('auth_user_id', user.id)
        .single()

    return NextResponse.json({ role: userData?.role ?? null })
}