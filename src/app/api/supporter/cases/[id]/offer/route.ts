// src/app/api/supporter/cases/[id]/offer/route.ts
// サポーター用：特定案件へのオファー取得・送信（RLSバイパス）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getAuthSupporterUser(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    const { data: userData } = await supabaseAdmin
        .from('users').select('id, role').eq('auth_user_id', user.id).single()
    if (!userData || userData.role !== 'SUPPORTER') return null
    return userData
}

// GET: 自分のオファーを取得
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const userData = await getAuthSupporterUser(request)
    if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: offer } = await supabaseAdmin
        .from('offers')
        .select('*')
        .eq('case_id', id)
        .eq('supporter_user_id', userData.id)
        .maybeSingle()

    return NextResponse.json({ offer: offer ?? null })
}

// POST: 新規オファー送信
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const userData = await getAuthSupporterUser(request)
    if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { message } = await request.json()
    if (!message?.trim()) {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
        .from('offers')
        .insert([{ case_id: id, supporter_user_id: userData.id, message, status: 'PENDING' }])
        .select()
        .single()

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: 'DUPLICATE' }, { status: 409 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ offer: data })
}

// PATCH: 既存オファー更新（再送・ステータス変更）
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const userData = await getAuthSupporterUser(request)
    if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { offerId, ...updateData } = body

    if (!offerId) {
        return NextResponse.json({ error: 'offerId is required' }, { status: 400 })
    }

    // 自分のオファーであること確認
    const { data: offer } = await supabaseAdmin
        .from('offers').select('id, supporter_user_id, case_id')
        .eq('id', offerId).eq('case_id', id).single()

    if (!offer || offer.supporter_user_id !== userData.id) {
        return NextResponse.json({ error: 'Not your offer' }, { status: 403 })
    }

    // PENDINGへの再申し出の場合、承認上限（3名）チェック
    if (updateData.status === 'PENDING') {
        const { data: acceptedOffers } = await supabaseAdmin
            .from('offers')
            .select('id')
            .eq('case_id', id)
            .eq('status', 'ACCEPTED')
        if ((acceptedOffers?.length ?? 0) >= 3) {
            return NextResponse.json(
                { error: 'MAX_REACHED', message: 'この案件はすでに3名のサポーターが承認されているため、申し出できません' },
                { status: 400 }
            )
        }
    }

    const { error: updateError } = await supabaseAdmin
        .from('offers').update(updateData).eq('id', offerId)

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}