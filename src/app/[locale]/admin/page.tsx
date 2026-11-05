'use client'

// 運営の入口。運営はメールのコードで入ったあと、認証アプリのコード(2つ目の確認)を必ず通す。
// 初めてのときはここで認証アプリを登録する(HANDOFF の申し送り 1: 管理者に MFA がない)。運営の画面は日本語だけ
import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { apiFetch } from '@/lib/client/api'
import { RequireMe } from '@/components/app/RequireMe'
import { useSession } from '@/components/app/SessionProvider'
import { Button, Card, Heading, Screen } from '@/components/app/ui'
import { MfaGate } from '@/components/app/MfaGate'
import { ADMIN_TOOLS as TOOLS } from '@/components/admin/AdminShell'

type Counts = { vetting: number; indicators: number; inquiries: number }

// 道具の札に、いま待っている件数を出す(画面の見直し 所見 14)
function ToolCards() {
  const [counts, setCounts] = useState<Counts | null>(null)
  useEffect(() => { apiFetch<Counts>('/api/admin/counts').then(setCounts).catch(() => setCounts(null)) }, [])
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {TOOLS.map((tool) => {
        const n = tool.countKey && counts ? counts[tool.countKey] : 0
        return (
          <Link key={tool.href} href={tool.href} className="no-underline">
            <Card tone="support" className="flex flex-col gap-1 p-4 text-ink">
              <span className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-bold">{tool.title}</span>
                {n > 0 && <span className="rounded-full bg-coral px-2.5 py-0.5 text-[12px] font-bold text-white">待ち {n}件</span>}
              </span>
              <span className="text-[12.5px] text-mist">{tool.note}</span>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

export default function AdminHomePage() {
  const { refresh, signOut } = useSession()
  return (
    <RequireMe admin>
      {(me) => (
        <Screen tone="support">
          <div className="flex flex-col gap-4 py-6">
            <div className="flex items-center justify-between">
              <Heading level={2}>明日もsamasama ／ 運営</Heading>
              <Button tone="support" variant="outline" className="min-h-[40px] text-[13px]" onClick={() => void signOut()}>ログアウト</Button>
            </div>
            {!me.mfa.verified ? (
              <MfaGate onVerified={refresh} purpose="admin" />
            ) : (
              <ToolCards />
            )}
          </div>
        </Screen>
      )}
    </RequireMe>
  )
}
