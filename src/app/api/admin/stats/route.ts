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
        .select('id, real_name, display_name, email, organization_name, supporter_type, phone, created_at')
        .eq('role', 'SUPPORTER')
        .order('created_at', { ascending: false })

    // SOSユーザー一覧
    const { data: sosUsers } = await supabaseAdmin
        .from('users')
        .select('id, display_name, real_name, email, created_at, sos_region_code')
        .eq('role', 'SOS')
        .order('created_at', { ascending: false })

    // 案件一覧（全件）
    const { data: cases } = await supabaseAdmin
        .from('cases')
        .select('id, title, status, created_at, region_code, owner_user_id, users!cases_owner_user_id_fkey(display_name)')
        .order('created_at', { ascending: false })

    const caseStats = {
        open: cases?.filter((c: { status: string }) => c.status === 'OPEN').length ?? 0,
        in_progress: cases?.filter((c: { status: string }) => ['MATCHED', 'IN_PROGRESS'].includes(c.status)).length ?? 0,
        resolved: cases?.filter((c: { status: string }) => c.status === 'RESOLVED').length ?? 0,
    }

    return NextResponse.json({
        supporters: supporters ?? [],
        sosUsers: sosUsers ?? [],
        sosCount: (sosUsers ?? []).length,
        cases: cases ?? [],
        caseStats,
    })
}