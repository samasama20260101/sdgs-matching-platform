import 'server-only'

// 運営への知らせ(Discord)。相談の中身・呼び名・地域は載せない。番号と種類と緊急・機微の別だけ(盤 05)。
// Webhook がない環境(手元・未設定の Staging)では何もしない
import { getDeployEnv } from '@/lib/deployEnv'

import { formatOpsEvent, type OpsEvent } from './opsNotifyFormat'

export type { OpsEvent }

export async function notifyOps(event: OpsEvent): Promise<void> {
  const url = process.env.DISCORD_OPS_WEBHOOK_URL
  if (!url) return
  const prefix = getDeployEnv() === 'production' ? '' : '[Staging] '
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: prefix + formatOpsEvent(event), allowed_mentions: { parse: [] } }),
    signal: AbortSignal.timeout(10_000),
  })
}
