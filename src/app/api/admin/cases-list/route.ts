// src/app/api/admin/cases-list/route.ts
// 管理画面向け全案件リスト（FK JOIN不使用・2ステップ）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: adminUser } = await supabaseAdmin.from('users').select('role').eq('auth_user_id', user.id).single()
    if (!adminUser || adminUser.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // ステップ1: 案件を全件取得（JOIN不使用）
    const { data: cases, error: casesError } = await supabaseAdmin
        .from('cases')
        .select('id, title, status, created_at, region_code, owner_user_id')
        .order('created_at', { ascending: false })

    if (casesError) {
        console.error('[admin/cases-list] cases error:', casesError)
        return NextResponse.json({ error: casesError.message }, { status: 500 })
    }

    if (!cases || cases.length === 0) {
        return NextResponse.json({ cases: [] })
    }

    // ステップ2: owner_user_id → display_name を別クエリで取得
    const ownerIds = [...new Set(cases.map(c => c.owner_user_id))]
    const { data: owners } = await supabaseAdmin
        .from('users')
        .select('id, display_name')
        .in('id', ownerIds)

    const ownerMap: Record<string, string> = {}
    ;(owners ?? []).forEach(u => { ownerMap[u.id] = u.display_name })

    const casesWithOwner = cases.map(c => ({
        ...c,
        users: { display_name: ownerMap[c.owner_user_id] ?? null },
    }))

    return NextResponse.json({ cases: casesWithOwner })
}
