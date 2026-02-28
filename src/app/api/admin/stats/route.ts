// src/app/api/admin/stats/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    // ADMIN確認
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminUser } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('auth_user_id', user.id)
        .single()

    if (!adminUser || adminUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // サポーター一覧
    const { data: supporters } = await supabaseAdmin
        .from('users')
        .select('id, real_name, display_name, email, organization_name, supporter_type, phone, service_area_nationwide, created_at')
        .eq('role', 'SUPPORTER')
        .order('created_at', { ascending: false })

    // SOS件数
    const { count: sosCount } = await supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'SOS')

    // 案件統計
    const { data: cases } = await supabaseAdmin
        .from('cases')
        .select('status')

    const caseStats = {
        open: cases?.filter(c => c.status === 'OPEN').length ?? 0,
        in_progress: cases?.filter(c => ['MATCHED', 'IN_PROGRESS'].includes(c.status)).length ?? 0,
        resolved: cases?.filter(c => c.status === 'RESOLVED').length ?? 0,
    }

    return NextResponse.json({
        supporters: supporters ?? [],
        sosCount: sosCount ?? 0,
        caseStats,
    })
}