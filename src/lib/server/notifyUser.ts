import 'server-only'

// 利用者への知らせ(メール)。本人が「メール」をオンにしているときだけ送る(既定はオフ)。
// 件名にも本文にも相談の中身・相手の名前を書かない(盤 17: DV などで端末やメールを見られる人を守る)。
// Cloudflare Email Sending の send_email バインディング(EMAIL、#166)で送る。鍵は要らない。
// バインディングか差出人(NOTIFY_FROM_EMAIL)がない環境(手元の next dev など)では何もしない
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { supabaseAdmin } from '@/lib/supabase/server'
import { senderForBinding, type Mailbox } from '@/lib/domain/mailbox'
import { buildNoticeEmail } from './noticeEmail'
import { mapInBatches } from '@/lib/concurrency'
import { offerMemberUserId } from '@/lib/domain/caseMember'

const NOTIFY_CONCURRENCY = 5

export type NoticeKind = 'NEW_OFFER' | 'NEW_MESSAGE' | 'RESOLVE_REPORTED' | 'CHOSEN' | 'INVITED'

// wrangler.jsonc の send_email。@cloudflare/workers-types を足さずに使う分だけ書く
interface SendEmailBinding {
  send(message: { from: string | Mailbox; to: string; subject: string; text: string }): Promise<{ messageId: string }>
}

async function emailBinding(): Promise<SendEmailBinding | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return ((env as { EMAIL?: SendEmailBinding }).EMAIL) ?? null
  } catch {
    return null
  }
}

export async function notifyUsers(userIds: string[], kind: NoticeKind): Promise<void> {
  const from = senderForBinding(process.env.NOTIFY_FROM_EMAIL)
  const origin = process.env.APP_ORIGIN ?? 'https://app.samasama.site'
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!from || ids.length === 0) return
  const binding = await emailBinding()
  if (!binding) return
  // 受け取る設定と、宛先の人を並べて読む
  const [{ data: prefs }, { data: users }] = await Promise.all([
    supabaseAdmin.from('notification_prefs').select('user_id').in('user_id', ids).eq('email_enabled', true),
    supabaseAdmin.from('users').select('id, auth_user_id, locale, withdrawn_at').in('id', ids),
  ])
  const enabled = new Set((prefs ?? []).map((p) => p.user_id as string))
  const targets = (users ?? []).filter((u) => enabled.has(u.id as string) && !u.withdrawn_at)
  // 1 人ずつ待つと、after() の 30 秒(Workers)に収まらないことがある。数人ずつ並べて送る
  await mapInBatches(targets, NOTIFY_CONCURRENCY, async (u) => {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(u.auth_user_id as string)
    const to = authUser.user?.email
    if (!to) return
    const mail = buildNoticeEmail(u.locale as string, kind, origin)
    await binding.send({ from, to, subject: mail.subject, text: mail.text }).catch((e: unknown) => {
      const code = (e as { code?: unknown })?.code
      console.error('[notify] send failed', code ?? '', e instanceof Error ? e.message : e)
    })
  })
}

// 相談する側(本人の相談の持ち主・会社と地域の相談の担当者)
export async function consulteeUserIds(caseId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from('cases').select('owner_user_id, assignee_user_id').eq('id', caseId).maybeSingle()
  return [data?.owner_user_id, data?.assignee_user_id].filter((v): v is string => Boolean(v))
}

// 選ばれた支え手(団体は、その相談を受け持つメンバー。#118)
export async function chosenSupporterUserIds(caseId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from('offers').select('created_by_user_id, supporter_user_id').eq('case_id', caseId).eq('status', 'ACCEPTED')
  return (data ?? []).map((o) => offerMemberUserId({ supporter_user_id: o.supporter_user_id as string | null, created_by_user_id: o.created_by_user_id as string | null })).filter((v): v is string => Boolean(v))
}
