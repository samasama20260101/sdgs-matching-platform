// 毎日の自動処理(JST 2:00。Cloudflare では Cron Triggers、Vercel では vercel.json)。v2.0:
// 1. 支え手の解決の報告から 14 日たった支援中の相談 → 解決。社会貢献の記録は手で確定したときと同じ関数で付ける
//    (v1 の「自動で解決になった相談にはバッジが付かない」課題の手当て)
// 2. 解決の報告がなく、最後の動きから 30 日たった支援中の相談 → 終了
// 3. 24 時間申し出のない受付中の相談 → コーディネーターの一覧に回す印(escalated_at)を付け、運営に件数を知らせる
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { isValidCronAuthorization } from '@/lib/api/cronAuth'
import { notifyOps } from '@/lib/server/opsNotify'
import { autoCloseCutoffs } from '@/lib/domain/schedule'

type CaseRef = { id: string; owner_user_id: string | null; assignee_user_id: string | null; updated_at: string; created_at: string }

async function systemMessage(c: CaseRef, key: string) {
  const sender = c.assignee_user_id ?? c.owner_user_id
  if (!sender) return
  await supabaseAdmin.from('messages').insert({ case_id: c.id, sender_user_id: sender, message_type: 'SYSTEM', content: JSON.stringify({ key, params: {} }) })
}

export async function GET(request: Request) {
  if (!isValidCronAuthorization(request.headers.get('Authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const cut = autoCloseCutoffs(new Date())

  // 1. 自動の解決
  const { data: reported, error: reportedError } = await supabaseAdmin
    .from('cases')
    .select('id, owner_user_id, assignee_user_id, updated_at, created_at')
    .eq('status', 'MATCHED')
    .not('supporter_resolved_at', 'is', null)
    .lt('supporter_resolved_at', cut.autoResolveBefore)
  if (reportedError) {
    console.error('[cron] reported fetch:', reportedError)
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
  let resolved = 0
  for (const c of (reported ?? []) as CaseRef[]) {
    const { data: updated } = await supabaseAdmin
      .from('cases')
      .update({ status: 'RESOLVED', resolved_at: new Date().toISOString() })
      .eq('id', c.id)
      .eq('status', 'MATCHED')
      .select('id')
      .maybeSingle()
    if (!updated) continue
    const { error } = await supabaseAdmin.rpc('record_case_resolution', { p_case_id: c.id })
    if (error) console.error('[cron] record:', c.id, error)
    await systemMessage(c, 'autoResolved')
    resolved += 1
  }

  // 2. 動きのない支援中の相談を終える
  const { data: matched, error: matchedError } = await supabaseAdmin
    .from('cases')
    .select('id, owner_user_id, assignee_user_id, updated_at, created_at')
    .eq('status', 'MATCHED')
    .is('supporter_resolved_at', null)
    .lt('updated_at', cut.inactiveBefore)
  if (matchedError) console.error('[cron] matched fetch:', matchedError)
  let closed = 0
  for (const c of (matched ?? []) as CaseRef[]) {
    const { data: last } = await supabaseAdmin.from('messages').select('created_at').eq('case_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (last && last.created_at >= cut.inactiveBefore) continue
    const { data: updated } = await supabaseAdmin.from('cases').update({ status: 'CLOSED' }).eq('id', c.id).eq('status', 'MATCHED').select('id').maybeSingle()
    if (!updated) continue
    await systemMessage(c, 'autoClosed')
    closed += 1
  }

  // 3. 申し出のない相談をコーディネーターの一覧に回す
  const { data: waiting, error: waitingError } = await supabaseAdmin
    .from('cases')
    .select('id')
    .eq('status', 'OPEN')
    .is('escalated_at', null)
    .lt('created_at', cut.escalateBefore)
    .limit(500)
  if (waitingError) console.error('[cron] waiting fetch:', waitingError)
  let escalated = 0
  const waitingIds = (waiting ?? []).map((c) => c.id as string)
  if (waitingIds.length > 0) {
    const { data: withOffers } = await supabaseAdmin.from('offers').select('case_id').in('case_id', waitingIds).in('status', ['PENDING', 'INVITED', 'ACCEPTED'])
    const offered = new Set((withOffers ?? []).map((o) => o.case_id as string))
    const targets = waitingIds.filter((id) => !offered.has(id))
    if (targets.length > 0) {
      const { error } = await supabaseAdmin.from('cases').update({ escalated_at: new Date().toISOString() }).in('id', targets)
      if (error) console.error('[cron] escalate:', error)
      else escalated = targets.length
    }
  }
  if (escalated > 0) await notifyOps({ kind: 'UNMATCHED', count: escalated }).catch(() => undefined)

  console.log(`[cron] resolved=${resolved} closed=${closed} escalated=${escalated}`)
  return NextResponse.json({ resolved, closed, escalated })
}
