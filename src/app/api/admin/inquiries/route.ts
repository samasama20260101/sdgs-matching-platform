// src/app/api/admin/inquiries/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function verifyAdmin(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) return null
    const { data } = await supabaseAdmin
        .from('users').select('role').eq('auth_user_id', user.id).single()
    return data?.role === 'ADMIN' ? user : null
}

// GET: 一覧取得
export async function GET(request: Request) {
    const admin = await verifyAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // OPEN / IN_PROGRESS / CLOSED / null(全件)

    let query = supabaseAdmin
        .from('inquiries')
        .select('*, users(display_id, display_name, organization_name)')
        .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 未対応件数
    const { count: openCount } = await supabaseAdmin
        .from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'OPEN')

    return NextResponse.json({ inquiries: data, open_count: openCount ?? 0 })
}

// PATCH: ステータス・メモ更新
export async function PATCH(request: Request) {
    const admin = await verifyAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, status, admin_memo } = await request.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const updateData: any = {}
    if (status) updateData.status = status
    if (admin_memo !== undefined) updateData.admin_memo = admin_memo

    const { error } = await supabaseAdmin
        .from('inquiries').update(updateData).eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
