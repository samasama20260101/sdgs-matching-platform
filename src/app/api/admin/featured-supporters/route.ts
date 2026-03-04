// src/app/api/admin/featured-supporters/route.ts
// 管理者：おすすめサポーターの取得・更新
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function verifyAdmin(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    const { data: adminUser } = await supabaseAdmin
        .from('users').select('role').eq('auth_user_id', user.id).single()
    if (!adminUser || adminUser.role !== 'ADMIN') return null
    return user
}

// GET: 全サポーター一覧（is_featured・featured_order付き）
export async function GET(request: Request) {
    const admin = await verifyAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: supporters } = await supabaseAdmin
        .from('users')
        .select('id, display_name, organization_name, supporter_type, is_featured, featured_order')
        .eq('role', 'SUPPORTER')
        .order('featured_order', { ascending: true })

    return NextResponse.json({ supporters: supporters ?? [] })
}

// PATCH: 特定サポーターのis_featured・featured_orderを更新
// body: { supporter_id: string, is_featured: boolean, featured_order?: number }
export async function PATCH(request: Request) {
    const admin = await verifyAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { supporter_id, is_featured, featured_order } = body

    if (!supporter_id) {
        return NextResponse.json({ error: 'supporter_id is required' }, { status: 400 })
    }

    const updateData: { is_featured: boolean; featured_order?: number } = { is_featured }
    if (featured_order !== undefined) updateData.featured_order = featured_order

    const { error } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', supporter_id)
        .eq('role', 'SUPPORTER')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
}

// POST: 並び順を一括保存
// body: { orders: Array<{ id: string, featured_order: number }> }
export async function POST(request: Request) {
    const admin = await verifyAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { orders } = await request.json()
    if (!Array.isArray(orders)) {
        return NextResponse.json({ error: 'orders must be an array' }, { status: 400 })
    }

    // 並び順を1件ずつ更新
    const updates = orders.map(({ id, featured_order }: { id: string; featured_order: number }) =>
        supabaseAdmin.from('users').update({ featured_order }).eq('id', id)
    )
    await Promise.all(updates)

    return NextResponse.json({ ok: true })
}
