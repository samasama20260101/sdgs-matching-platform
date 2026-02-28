// src/app/api/supporter/offers/[id]/route.ts
// サポーター用：自分のオファー操作（RLSバイパス）
// [id] = offer id
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

// PATCH: オファーのステータス更新（取り下げ・再送など）
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabaseAdmin
        .from('users').select('id, role').eq('auth_user_id', user.id).single()
    if (!userData || userData.role !== 'SUPPORTER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 自分のオファーであることを確認
    const { data: offer } = await supabaseAdmin
        .from('offers').select('id, supporter_user_id').eq('id', id).single()
    if (!offer || offer.supporter_user_id !== userData.id) {
        return NextResponse.json({ error: 'Not your offer' }, { status: 403 })
    }

    const body = await request.json()
    const { error: updateError } = await supabaseAdmin
        .from('offers').update(body).eq('id', id)
    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}