// Workers の入口。OpenNext が作った Next.js のハンドラを包み、Cron Triggers(scheduled)を足す。
// 自動処理の中身はアプリの /api/cron/* が持ち、ここは CRON_SECRET を付けて内部で呼ぶだけ。
// ネットワークを通らず同じ Worker の fetch を直接呼ぶので、公開 URL や DNS に依存しない。
// @ts-expect-error -- `.open-next/worker.js` は `opennextjs-cloudflare build` が作る(型はない)
import handler from '../.open-next/worker.js'

interface Env {
  CRON_SECRET?: string
  [key: string]: unknown
}

// cron の式 → 呼ぶ API。wrangler.jsonc の triggers.crons と合わせる
export const CRON_ROUTES: Record<string, string[]> = {
  '0 17 * * *': ['/api/cron/auto-close-cases'],
}

export default {
  fetch: handler.fetch,

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const paths = CRON_ROUTES[controller.cron] ?? []
    if (paths.length === 0) {
      console.warn(`[cron] 知らない式です: ${controller.cron}`)
      return
    }
    if (!env.CRON_SECRET) {
      console.warn('[cron] CRON_SECRET がないので動かしません')
      return
    }
    for (const path of paths) {
      try {
        const request = new Request(`https://cron.internal${path}`, {
          headers: { authorization: `Bearer ${env.CRON_SECRET}` },
        })
        const response: Response = await handler.fetch(request, env, ctx)
        console.log(`[cron] ${controller.cron} -> ${path} status=${response.status}`)
        if (!response.ok) {
          console.warn(`[cron] 失敗: ${path} ${(await response.text()).slice(0, 500)}`)
        }
      } catch (error) {
        console.warn(`[cron] 失敗: ${path}`, error)
      }
    }
  },
} satisfies ExportedHandler<Env>
