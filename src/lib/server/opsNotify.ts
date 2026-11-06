import 'server-only'

// 運営への知らせ(Discord)。載せるもの・載せないものは opsNotifyFormat.ts。中身は運営の画面へのリンクから読む。
// Webhook がない環境(手元・未設定の Staging)では何もしない
import { getDeployEnv } from '@/lib/deployEnv'

import { formatOpsEvent, opsWebhookFor, type OpsEvent } from './opsNotifyFormat'

export type { OpsEvent }

export async function notifyOps(event: OpsEvent): Promise<void> {
  const url = opsWebhookFor(event.kind, {
    DISCORD_OPS_WEBHOOK_URL: process.env.DISCORD_OPS_WEBHOOK_URL,
    DISCORD_OPS_APPLICATION_WEBHOOK_URL: process.env.DISCORD_OPS_APPLICATION_WEBHOOK_URL,
  })
  if (!url) return
  const prefix = getDeployEnv() === 'production' ? '' : '[Staging] '
  const origin = process.env.APP_ORIGIN ?? 'https://app.samasama.site'
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // flags 4 = リンクの埋め込み(プレビュー)を出さない。運営の画面は入口で止まるので、プレビューは役に立たない
    body: JSON.stringify({ content: prefix + formatOpsEvent(event, origin), allowed_mentions: { parse: [] }, flags: 4 }),
    signal: AbortSignal.timeout(10_000),
  })
}
