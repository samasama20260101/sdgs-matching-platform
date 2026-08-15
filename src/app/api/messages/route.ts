// src/app/api/messages/route.ts
// メッセージ取得・送信（SOS・サポーター共通、RLSバイパス）
import { supabaseAdmin } from '@/lib/supabase/server'
import { getActiveOrganizationForUser } from '@/lib/organizations'
import { isUuid } from '@/lib/api/validation'
import { NextResponse } from 'next/server'

const MAX_MESSAGE_LENGTH = 5000

async function getAuthUser(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    const { data: userData } = await supabaseAdmin
        .from('users').select('id, role, display_name, organization_name, is_suspended').eq('auth_user_id', user.id).single()
    if (!userData) return null
    if (userData.is_suspended) return null
    const organizationContext = userData.role === 'SUPPORTER'
        ? await getActiveOrganizationForUser(userData.id)
        : null
    return {
        ...userData,
        organization_id: organizationContext?.organizationId ?? null,
        organization_name: organizationContext?.organization.name ?? userData.organization_name ?? null,
    }
}

// GET: メッセージ一覧取得（case_id クエリパラメータ必須）
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const caseId = searchParams.get('case_id')
    if (!caseId) return NextResponse.json({ error: 'case_id required' }, { status: 400 })
    if (!isUuid(caseId)) return NextResponse.json({ error: 'invalid case_id' }, { status: 400 })

    const userData = await getAuthUser(request)
    if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (userData.role === 'SUPPORTER' && !userData.organization_id) {
        return NextResponse.json({ error: 'No active organization membership' }, { status: 403 })
    }

    // この案件に関与しているか確認
    const { data: caseData } = await supabaseAdmin
        .from('cases').select('id, owner_user_id').eq('id', caseId).single()
    if (!caseData) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

    // SOS所有者またはACCEPTEDサポーターのみアクセス許可
    let canAccess = caseData.owner_user_id === userData.id
    if (!canAccess && userData.role === 'SUPPORTER') {
        let offerQuery = supabaseAdmin
            .from('offers')
            .select('id')
            .eq('case_id', caseId)
            .eq('status', 'ACCEPTED')
        offerQuery = offerQuery.eq('supporter_organization_id', userData.organization_id)
        const { data: offer } = await offerQuery
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

    if (msgError) {
        console.error('[messages] fetch error:', msgError)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }

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
    const enriched = messagesData.map(m => {
        const sender = senderMap.get(m.sender_user_id)
        return {
            ...m,
            sender: {
                ...(sender || {}),
                display_name: m.sender_role_snapshot === 'SUPPORTER'
                    && m.sender_display_name_snapshot === m.sender_organization_name_snapshot
                    ? sender?.display_name || m.sender_display_name_snapshot || '不明'
                    : m.sender_display_name_snapshot || sender?.display_name || '不明',
                role: m.sender_role_snapshot || sender?.role || 'UNKNOWN',
                organization_name: m.sender_organization_name_snapshot || sender?.organization_name || null,
            },
        }
    })

    return NextResponse.json({ messages: enriched })
}

// POST: メッセージ送信
export async function POST(request: Request) {
    const userData = await getAuthUser(request)
    if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (userData.role === 'SUPPORTER' && !userData.organization_id) {
        return NextResponse.json({ error: 'No active organization membership' }, { status: 403 })
    }

    const { case_id, content } = await request.json()
    const normalizedContent = typeof content === 'string' ? content.trim() : ''
    if (!case_id || !normalizedContent) {
        return NextResponse.json({ error: 'case_id and content are required' }, { status: 400 })
    }
    if (!isUuid(case_id)) return NextResponse.json({ error: 'invalid case_id' }, { status: 400 })
    if (normalizedContent.length > MAX_MESSAGE_LENGTH) {
        return NextResponse.json({ error: `メッセージは${MAX_MESSAGE_LENGTH}文字以内で入力してください` }, { status: 400 })
    }
    if (normalizedContent.startsWith('__SYSTEM__')) {
        return NextResponse.json({ error: 'Reserved message prefix' }, { status: 400 })
    }

    // この案件に関与しているか確認（SOS所有者またはACCEPTEDサポーター）
    const { data: caseData } = await supabaseAdmin
        .from('cases').select('id, owner_user_id, status').eq('id', case_id).single()
    if (!caseData) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

    let canAccess = caseData.owner_user_id === userData.id
    if (!canAccess && userData.role === 'SUPPORTER') {
        let offerQuery = supabaseAdmin
            .from('offers')
            .select('id')
            .eq('case_id', case_id)
            .eq('status', 'ACCEPTED')
        offerQuery = offerQuery.eq('supporter_organization_id', userData.organization_id)
        const { data: offer } = await offerQuery
            .maybeSingle()
        canAccess = !!offer
    }

    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // 終了済み案件はUI上読み取り専用。API直叩きでも送信させない
    if (['RESOLVED', 'CLOSED', 'CANCELLED'].includes(caseData.status)) {
        return NextResponse.json(
            { error: 'CASE_CLOSED', message: 'この案件は終了しているため、メッセージを送信できません' },
            { status: 409 }
        )
    }

    const { data, error } = await supabaseAdmin
        .from('messages')
        .insert([{
            case_id,
            sender_user_id: userData.id,
            sender_organization_id: userData.organization_id,
            sender_display_name_snapshot: userData.display_name,
            sender_role_snapshot: userData.role,
            sender_organization_name_snapshot: userData.organization_name,
            content: normalizedContent,
        }])
        .select()
        .single()

    if (error) {
        console.error('[messages] insert error:', error)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }

    return NextResponse.json({ message: data })
}
