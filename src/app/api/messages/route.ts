// src/app/api/messages/route.ts
// メッセージ取得・送信（SOS・サポーター共通、RLSバイパス）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getAuthUser(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    const { data: userData } = await supabaseAdmin
        .from('users').select('id, role').eq('auth_user_id', user.id).single()
    if (!userData) return null
    return userData
}

// GET: メッセージ一覧取得（case_id クエリパラメータ必須）
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const caseId = searchParams.get('case_id')
    if (!caseId) return NextResponse.json({ error: 'case_id required' }, { status: 400 })

    const userData = await getAuthUser(request)
    if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // この案件に関与しているか確認
    const { data: caseData } = await supabaseAdmin
        .from('cases').select('id, owner_user_id').eq('id', caseId).single()
    if (!caseData) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

    // SOS所有者またはACCEPTEDサポーターのみアクセス許可
    let canAccess = caseData.owner_user_id === userData.id
    if (!canAccess) {
        const { data: offer } = await supabaseAdmin
            .from('offers')
            .select('id')
            .eq('case_id', caseId)
            .eq('supporter_user_id', userData.id)
            .eq('status', 'ACCEPTED')
            .maybeSingle()
        canAccess = !!offer
    }

    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // メッセージ取得
    const { data: messagesData, error: msgError } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true })

    if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 })

    if (!messagesData || messagesData.length === 0) {
        return NextResponse.json({ messages: [] })
    }

    // 送信者情報を付加
    const senderIds = [...new Set(messagesData.map(m => m.sender_user_id))]
    const { data: senders } = await supabaseAdmin
        .from('users')
        .select('id, display_name, role, organization_name')
        .in('id', senderIds)

    const senderMap = new Map((senders || []).map(s => [s.id, s]))
    const enriched = messagesData.map(m => ({
        ...m,
        sender: senderMap.get(m.sender_user_id) || {
            display_name: '不明',
            role: 'UNKNOWN',
            organization_name: null,
        },
    }))

    return NextResponse.json({ messages: enriched })
}

// POST: メッセージ送信
export async function POST(request: Request) {
    const userData = await getAuthUser(request)
    if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { case_id, content } = await request.json()
    if (!case_id || !content?.trim()) {
        return NextResponse.json({ error: 'case_id and content are required' }, { status: 400 })
    }

    // この案件に関与しているか確認（SOS所有者またはACCEPTEDサポーター）
    const { data: caseData } = await supabaseAdmin
        .from('cases').select('id, owner_user_id').eq('id', case_id).single()
    if (!caseData) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

    let canAccess = caseData.owner_user_id === userData.id
    if (!canAccess) {
        const { data: offer } = await supabaseAdmin
            .from('offers')
            .select('id')
            .eq('case_id', case_id)
            .eq('supporter_user_id', userData.id)
            .eq('status', 'ACCEPTED')
            .maybeSingle()
        canAccess = !!offer
    }

    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await supabaseAdmin
        .from('messages')
        .insert([{ case_id, sender_user_id: userData.id, content }])
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ message: data })
}