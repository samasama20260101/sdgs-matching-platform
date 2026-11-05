// 相談する側の操作: 取り消す / 解決を確定する(ありがとうを贈る) / まだ解決していないと返す
import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { resolveCaseAccess } from '@/lib/server/caseAccess'
import { postSystemMessage } from '@/lib/server/systemMessages'
import { sanitizeThanks } from '@/lib/domain/offers'
import { summarizeResolvedCase } from '@/lib/server/caseKnowledge'

const schema = z.object({
  action: z.enum(['cancel', 'confirmResolved', 'notYet']),
  thanks: z.array(z.string()).optional(),
})

function fail(status: number, error: string, code?: string) {
  return NextResponse.json(code ? { error, code } : { error }, { status })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return fail(404, 'Not found')
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail(400, '入力を確かめてください', 'INVALID')

  const access = await resolveCaseAccess(auth.appUser.id, id).catch(() => null)
  if (!access || access.role !== 'CONSULTEE') return fail(404, 'Not found')
  if (!access.canDecide) return fail(403, '担当の人だけが決められます', 'NOT_ASSIGNEE')
  const c = access.caseRow
  const userId = auth.appUser.id

  if (parsed.data.action === 'cancel') {
    if (!['OPEN', 'MATCHED'].includes(c.status)) return fail(409, 'この相談はもう取り消せません', 'NOT_ACTIVE')
    const { error } = await supabaseAdmin.from('cases').update({ status: 'CANCELLED', updated_at: new Date().toISOString() }).eq('id', id).in('status', ['OPEN', 'MATCHED'])
    if (error) return fail(500, 'サーバーエラーが発生しました')
    await supabaseAdmin.from('offers').update({ status: 'DECLINED', declined_at: new Date().toISOString(), declined_by_user_id: userId }).eq('case_id', id).in('status', ['PENDING', 'INVITED'])
    await postSystemMessage(id, userId, 'cancelled')
    return NextResponse.json({ ok: true })
  }

  if (parsed.data.action === 'notYet') {
    if (c.status !== 'MATCHED' || !c.supporter_resolved_at) return fail(409, '解決の報告がありません', 'NO_REPORT')
    const { error } = await supabaseAdmin.from('cases').update({ supporter_resolved_at: null, updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'MATCHED')
    if (error) return fail(500, 'サーバーエラーが発生しました')
    await postSystemMessage(id, userId, 'resolvedNotYet')
    return NextResponse.json({ ok: true })
  }

  // 解決を確定する: 支え手が解決を報告してから(相談した人が確定したものだけを社会貢献に数える)
  if (c.status !== 'MATCHED' || !c.supporter_resolved_at) return fail(409, '解決の報告がありません', 'NO_REPORT')
  const now = new Date().toISOString()
  const { data: updated, error: resolveError } = await supabaseAdmin
    .from('cases')
    .update({ status: 'RESOLVED', resolved_at: now, updated_at: now })
    .eq('id', id)
    .eq('status', 'MATCHED')
    .select('id')
    .maybeSingle()
  if (resolveError) return fail(500, 'サーバーエラーが発生しました')
  if (!updated) return fail(409, 'もう解決になっています', 'ALREADY')

  const { error: recordError } = await supabaseAdmin.rpc('record_case_resolution', { p_case_id: id })
  if (recordError) console.error('[api/cases/actions] record:', recordError)

  const thanks = sanitizeThanks(parsed.data.thanks)
  if (thanks.length > 0) {
    const { data: accepted } = await supabaseAdmin
      .from('offers')
      .select('supporter_kind, supporter_user_id, supporter_organization_id, created_by_user_id')
      .eq('case_id', id)
      .eq('status', 'ACCEPTED')
    const rows = (accepted ?? []).flatMap((o) => thanks.map((word) => ({
      case_id: id,
      supporter_user_id: (o.created_by_user_id as string | null) ?? (o.supporter_user_id as string),
      supporter_organization_id: o.supporter_organization_id as string | null,
      given_by_user_id: userId,
      badge_key: word,
    })))
    if (rows.length > 0) await supabaseAdmin.from('supporter_badges').insert(rows)
    // ありがとうは選んだ言葉の数によらず1回(支え手ごとに1行)
    const thanksRows = (accepted ?? []).map((o) => ({
      user_id: (o.created_by_user_id as string | null) ?? (o.supporter_user_id as string),
      organization_id: o.supporter_organization_id as string | null,
      case_id: id,
      kind: 'THANKS',
      points: 0,
    }))
    if (thanksRows.length > 0) await supabaseAdmin.from('contributions').insert(thanksRows)
  }

  await postSystemMessage(id, userId, 'resolvedConfirmed')
  after(() => summarizeResolvedCase(id).catch((e) => console.error('[api/cases/actions] knowledge:', e)))
  return NextResponse.json({ ok: true })
}
