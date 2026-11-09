// 団体への招待を受ける・断る。受けると団体の一員になる(1人で複数の団体に入れる)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { recordSupporterConsent } from '@/lib/server/consents'
import { canSupportNow } from '@/lib/faces'
import { underSupporterAgeResponse } from '@/lib/server/supportAuth'

const schema = z.object({ action: z.enum(['accept', 'decline']), acceptSupporterTerms: z.boolean().optional() })

export async function POST(request: Request, { params }: { params: Promise<{ invitationId: string }> }) {
  const { invitationId } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(invitationId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  // 確かめ済みのメールのときだけ受けられる
  const email = auth.authUser.email_confirmed_at ? auth.authUser.email?.toLowerCase() : undefined
  const { data: inv } = await supabaseAdmin.from('organization_invitations').select('id, organization_id, email, role, status, expires_at').eq('id', invitationId).maybeSingle()
  if (!inv || inv.status !== 'PENDING' || !email || (inv.email as string).toLowerCase() !== email || new Date(inv.expires_at as string) < new Date()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const now = new Date().toISOString()
  if (parsed.data.action === 'decline') {
    await supabaseAdmin.from('organization_invitations').update({ status: 'CANCELLED', updated_at: now }).eq('id', invitationId)
    return NextResponse.json({ ok: true })
  }
  if (parsed.data.acceptSupporterTerms !== true) return NextResponse.json({ error: '同意が必要です', code: 'CONSENT_REQUIRED' }, { status: 400 })
  if (!(await canSupportNow(auth.appUser.id))) return underSupporterAgeResponse()
  const { error } = await supabaseAdmin.from('organization_memberships').insert({
    organization_id: inv.organization_id,
    user_id: auth.appUser.id,
    role: inv.role,
    status: 'ACTIVE',
    joined_at: now,
  })
  if (error && error.code !== '23505') return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  await supabaseAdmin.from('organization_invitations').update({ status: 'ACCEPTED', accepted_by_user_id: auth.appUser.id, accepted_at: now, updated_at: now }).eq('id', invitationId)
  await recordSupporterConsent(auth.appUser.id).catch(() => undefined)
  return NextResponse.json({ ok: true })
}
