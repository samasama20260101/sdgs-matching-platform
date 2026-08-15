// src/app/api/sos/cases/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { NextResponse } from 'next/server'

function isValidTimestamp(value: unknown) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function serverError() {
  return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
}

async function awardResolutionBadges(caseId: string, sosUserId: string) {
  const { data: acceptedOffers, error: acceptedOffersError } = await supabaseAdmin
    .from('offers')
    .select('supporter_user_id, supporter_organization_id, accepted_order')
    .eq('case_id', caseId)
    .eq('status', 'ACCEPTED')
    .not('accepted_order', 'is', null)
    .order('accepted_order', { ascending: true })

  if (acceptedOffersError) {
    console.error('[sos/cases] accepted offers fetch error:', acceptedOffersError)
    return false
  }

  const badges = (acceptedOffers ?? [])
    .filter((offer) => offer.supporter_user_id && offer.supporter_organization_id)
    .map((offer, index) => ({
      case_id: caseId,
      supporter_user_id: offer.supporter_user_id,
      supporter_organization_id: offer.supporter_organization_id,
      badge_key: index === 0 ? 'gold_medal' : 'silver_medal',
      given_by_user_id: sosUserId,
    }))

  if (badges.length === 0) return true

  const { error: badgeError } = await supabaseAdmin
    .from('supporter_badges')
    .upsert(badges, { onConflict: 'case_id,supporter_organization_id,badge_key' })

  if (badgeError) {
    console.error('[sos/cases] resolution badge upsert error:', badgeError)
    return false
  }

  return true
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid case id' }, { status: 400 })
  const auth = await requireActiveAppUser(request, { roles: ['SOS'] })
  if ('response' in auth) return auth.response

  const { data: caseData, error: caseError } = await supabaseAdmin
    .from('cases').select('*').eq('id', id).single()
  if (caseError || !caseData) return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  if (caseData.owner_user_id !== auth.appUser.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ case: caseData })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid case id' }, { status: 400 })
  const auth = await requireActiveAppUser(request, { roles: ['SOS'] })
  if ('response' in auth) return auth.response

  const { data: caseData } = await supabaseAdmin
    .from('cases').select('id, owner_user_id, status, supporter_resolved_at').eq('id', id).single()
  if (!caseData) return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  if (caseData.owner_user_id !== auth.appUser.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const allowedKeys = new Set(['status', 'resolved_at', 'supporter_resolved_at'])
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return NextResponse.json({ error: 'Invalid update' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (body.status === 'RESOLVED' && (caseData.status !== 'MATCHED' || !caseData.supporter_resolved_at)) {
    return NextResponse.json({ error: 'RESOLUTION_NOT_REPORTED' }, { status: 409 })
  }
  if (body.status === 'RESOLVED') {
    if (Object.keys(body).length !== 2 || !Object.prototype.hasOwnProperty.call(body, 'resolved_at')) {
      return NextResponse.json({ error: 'Invalid update' }, { status: 400 })
    }
    if (!isValidTimestamp(body.resolved_at)) {
      return NextResponse.json({ error: 'Invalid resolved_at' }, { status: 400 })
    }
    updateData.status = 'RESOLVED'
    updateData.resolved_at = body.resolved_at
  }
  if (body.supporter_resolved_at === null && !caseData.supporter_resolved_at) {
    return NextResponse.json({ error: 'STALE_STATE', message: '他の操作が先に完了しています' }, { status: 409 })
  }
  if (body.supporter_resolved_at === null) {
    if (Object.keys(body).length !== 1) {
      return NextResponse.json({ error: 'Invalid update' }, { status: 400 })
    }
    updateData.supporter_resolved_at = null
  }
  if (body.status === 'CANCELLED' && !['OPEN', 'MATCHED'].includes(caseData.status)) {
    return NextResponse.json({ error: 'INVALID_STATUS_TRANSITION' }, { status: 409 })
  }
  if (body.status === 'CANCELLED') {
    if (Object.keys(body).length !== 1) {
      return NextResponse.json({ error: 'Invalid update' }, { status: 400 })
    }
    updateData.status = 'CANCELLED'
  }
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Invalid update' }, { status: 400 })
  }

  const { data: updatedCase, error: updateError } = await supabaseAdmin
    .from('cases')
    .update(updateData)
    .eq('id', id)
    .eq('owner_user_id', auth.appUser.id)
    .eq('status', caseData.status)
    .select('id')
    .maybeSingle()
  if (updateError) {
    console.error('[sos/cases] case update error:', updateError)
    return serverError()
  }
  if (!updatedCase) {
    return NextResponse.json({ error: 'STALE_STATE', message: '他の操作が先に完了しています' }, { status: 409 })
  }

  if (body.status === 'RESOLVED') {
    const badgeOk = await awardResolutionBadges(id, auth.appUser.id)
    if (!badgeOk) return serverError()
  }

  if (body.supporter_resolved_at === null) {
    const { error: messageError } = await supabaseAdmin.from('messages').insert({
      case_id: id,
      sender_user_id: auth.appUser.id,
      sender_display_name_snapshot: 'システム',
      sender_role_snapshot: 'SYSTEM',
      message_type: 'SYSTEM',
      content: '__SYSTEM__相談者が、まだ解決していないことを伝えました。この案件は引き続き支援中です。チャットで残っている困りごとや次に必要な対応を確認してください。',
    })
    if (messageError) {
      console.error('[sos/cases] resolution rejection system message insert error:', messageError)
    }
  }

  // マッチ済み案件の取消は担当サポーターに知らせる(OPENは読み手がいないため不要)
  if (body.status === 'CANCELLED' && caseData.status === 'MATCHED') {
    const { error: messageError } = await supabaseAdmin.from('messages').insert({
      case_id: id,
      sender_user_id: auth.appUser.id,
      sender_display_name_snapshot: 'システム',
      sender_role_snapshot: 'SYSTEM',
      message_type: 'SYSTEM',
      content: '__SYSTEM__相談者がこの相談を取り消しました。この案件のチャットは終了となります。これまでのご対応ありがとうございました。',
    })
    if (messageError) {
      console.error('[sos/cases] cancellation system message insert error:', messageError)
    }
  }

  return NextResponse.json({ ok: true })
}
