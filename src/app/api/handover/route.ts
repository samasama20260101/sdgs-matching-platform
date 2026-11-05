// 引き継ぎコードで、代理で登録された相談を自分の相談にする(盤 23)。総当たりを止めるため、1人1時間に5回まで
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { normalizeHandoverInput, HANDOVER_MAX_FAILED_ATTEMPTS } from '@/lib/domain/handover'
import { hashHandoverCode } from '@/lib/server/handover'

const schema = z.object({ code: z.string().max(20) })
const MAX_TRIES_PER_HOUR = 5

export async function POST(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'コードを確かめてください', code: 'INVALID' }, { status: 400 })

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await supabaseAdmin.from('audit_logs').select('id', { count: 'exact', head: true }).eq('actor_user_id', auth.appUser.id).eq('action', 'handover.fail').gte('created_at', since)
  if ((count ?? 0) >= MAX_TRIES_PER_HOUR) return NextResponse.json({ error: '少し時間をおいてから試してください', code: 'RATE_LIMIT' }, { status: 429 })

  const fail = async () => {
    await supabaseAdmin.from('audit_logs').insert({ actor_user_id: auth.appUser.id, action: 'handover.fail', metadata: {} })
    return NextResponse.json({ error: 'コードが違うか、期限が切れています', code: 'NOT_FOUND' }, { status: 404 })
  }
  const normalized = normalizeHandoverInput(parsed.data.code)
  if (!normalized) return fail()
  const { data: row } = await supabaseAdmin.from('case_handover_codes').select('id, case_id, expires_at, used_at, failed_attempts').eq('code_hash', hashHandoverCode(normalized)).maybeSingle()
  if (!row || row.used_at || new Date(row.expires_at as string) < new Date() || (row.failed_attempts as number) >= HANDOVER_MAX_FAILED_ATTEMPTS) return fail()

  const now = new Date().toISOString()
  const { data: updated, error } = await supabaseAdmin
    .from('cases')
    .update({ owner_user_id: auth.appUser.id, assignee_user_id: auth.appUser.id, updated_at: now })
    .eq('id', row.case_id)
    .is('owner_user_id', null)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  if (!updated) return fail()
  await supabaseAdmin.from('case_handover_codes').update({ used_at: now, used_by_user_id: auth.appUser.id }).eq('id', row.id)
  await supabaseAdmin.from('audit_logs').insert({ actor_user_id: auth.appUser.id, action: 'case.handover', target_table: 'cases', target_id: row.case_id, metadata: {} })
  return NextResponse.json({ caseId: row.case_id })
}
