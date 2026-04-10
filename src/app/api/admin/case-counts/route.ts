// src/app/api/admin/case-counts/route.ts
// 案件件数のみ取得する軽量エンドポイント（JOIN不使用）
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

    // JOIN不使用でシンプルにカウント
    const { data: cases, error: casesError } = await supabaseAdmin
        .from('cases')
        .select('status')

    if (casesError) {
        console.error('[admin/case-counts] error:', casesError)
        return NextResponse.json({ error: casesError.message }, { status: 500 })
    }

    const counts = {
        open:        (cases ?? []).filter(c => c.status === 'OPEN').length,
        matched:     (cases ?? []).filter(c => c.status === 'MATCHED').length,
        resolved:    (cases ?? []).filter(c => c.status === 'RESOLVED').length,
        closed:      (cases ?? []).filter(c => c.status === 'CLOSED').length,
        cancelled:   (cases ?? []).filter(c => c.status === 'CANCELLED').length,
        total:       (cases ?? []).length,
    }

    return NextResponse.json(counts)
}
