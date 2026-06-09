// src/app/api/sos/cases/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { isUuid } from '@/lib/api/validation'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid case id' }, { status: 400 })
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: caseData, error: caseError } = await supabaseAdmin
    .from('cases').select('*').eq('id', id).single()
  if (caseError || !caseData) return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  const { data: userData } = await supabaseAdmin
    .from('users').select('id, role').eq('auth_user_id', user.id).single()
  if (!userData || userData.role !== 'SOS' || caseData.owner_user_id !== userData.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ case: caseData })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid case id' }, { status: 400 })
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabaseAdmin
    .from('users').select('id, role').eq('auth_user_id', user.id).single()
  if (!userData || userData.role !== 'SOS') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { data: caseData } = await supabaseAdmin
    .from('cases').select('id, owner_user_id, status, supporter_resolved_at').eq('id', id).single()
  if (!caseData) return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  if (caseData.owner_user_id !== userData.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const allowedKeys = new Set(['status', 'resolved_at', 'supporter_resolved_at', 'ai_sdg_suggestion', 'visibility', 'title'])
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return NextResponse.json({ error: 'Invalid update' }, { status: 400 })
  }
  if (body.status === 'RESOLVED' && (caseData.status !== 'MATCHED' || !caseData.supporter_resolved_at)) {
    return NextResponse.json({ error: 'RESOLUTION_NOT_REPORTED' }, { status: 409 })
  }
  if (body.supporter_resolved_at === null && !caseData.supporter_resolved_at) {
    return NextResponse.json({ error: 'STALE_STATE', message: '他の操作が先に完了しています' }, { status: 409 })
  }
  if (body.status === 'MATCHED' && !['OPEN', 'MATCHED'].includes(caseData.status)) {
    return NextResponse.json({ error: 'INVALID_STATUS_TRANSITION' }, { status: 409 })
  }
  if (body.status === 'CANCELLED' && !['OPEN', 'MATCHED'].includes(caseData.status)) {
    return NextResponse.json({ error: 'INVALID_STATUS_TRANSITION' }, { status: 409 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('cases').update(body).eq('id', id).eq('owner_user_id', userData.id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  if (body.supporter_resolved_at === null) {
    const { error: messageError } = await supabaseAdmin.from('messages').insert({
      case_id: id,
      sender_user_id: userData.id,
      sender_display_name_snapshot: 'システム',
      sender_role_snapshot: 'SYSTEM',
      message_type: 'SYSTEM',
      content: '__SYSTEM__相談者が、まだ解決していないことを伝えました。この案件は引き続き支援中です。チャットで残っている困りごとや次に必要な対応を確認してください。',
    })
    if (messageError) {
      console.error('[sos/cases] resolution rejection system message insert error:', messageError)
    }
  }

  return NextResponse.json({ ok: true })
}
