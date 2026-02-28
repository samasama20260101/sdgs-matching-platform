// src/app/api/supporter/cases/[id]/route.ts
// サポーター用：案件取得・ステータス更新（RLSバイパス）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getAuthUser(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    return user
}

// GET: 案件詳細取得（サポーターはどのOPEN案件も閲覧可）
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // サポーターであることを確認
    const { data: userData } = await supabaseAdmin
        .from('users').select('id, role').eq('auth_user_id', user.id).single()
    if (!userData || userData.role !== 'SUPPORTER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: caseData, error: caseError } = await supabaseAdmin
        .from('cases').select('*').eq('id', id).single()
    if (caseError || !caseData) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    return NextResponse.json({ case: caseData, supporterUserId: userData.id })
}

// PATCH: 案件ステータス更新（サポーターが担当している案件のみ）
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabaseAdmin
        .from('users').select('id, role').eq('auth_user_id', user.id).single()
    if (!userData || userData.role !== 'SUPPORTER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 自分がACCEPTED状態のオファーを持っているか確認
    const { data: offer } = await supabaseAdmin
        .from('offers')
        .select('id')
        .eq('case_id', id)
        .eq('supporter_user_id', userData.id)
        .eq('status', 'ACCEPTED')
        .maybeSingle()

    if (!offer) {
        return NextResponse.json({ error: 'Not authorized for this case' }, { status: 403 })
    }

    const body = await request.json()
    const { error: updateError } = await supabaseAdmin
        .from('cases').update(body).eq('id', id)
    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}