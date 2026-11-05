// 支える｜共同支援の招待を受ける・断る(招かれた団体のメンバー)。受けると相談した人に「提案」として届く
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireFace } from '@/lib/server/supportAuth'

const schema = z.object({ face: z.string(), action: z.enum(['accept', 'decline']) })

export async function POST(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params
  if (!isUuid(offerId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = schema.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const auth = await requireFace(request, body.data.face)
  if ('response' in auth) return auth.response
  if (auth.rf.face.kind !== 'ORGANIZATION' || !auth.rf.face.organizationApproved) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: offer } = await supabaseAdmin.from('offers').select('id, status, supporter_organization_id').eq('id', offerId).maybeSingle()
  if (!offer || offer.status !== 'INVITED' || offer.supporter_organization_id !== auth.rf.face.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const now = new Date().toISOString()
  const update = body.data.action === 'accept'
    ? { status: 'PENDING', supporter_user_id: auth.userId, created_by_user_id: auth.userId, updated_at: now }
    : { status: 'DECLINED', declined_at: now, declined_by_user_id: auth.userId, updated_at: now }
  const { error } = await supabaseAdmin.from('offers').update(update).eq('id', offerId).eq('status', 'INVITED')
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
