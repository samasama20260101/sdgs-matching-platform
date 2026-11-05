'use client'

// 運営の入口。運営はメールのコードで入ったあと、認証アプリのコード(2つ目の確認)を必ず通す。
// 初めてのときはここで認証アプリを登録する(HANDOFF の申し送り 1: 管理者に MFA がない)。運営の画面は日本語だけ
import { Link } from '@/i18n/navigation'
import { RequireMe } from '@/components/app/RequireMe'
import { useSession } from '@/components/app/SessionProvider'
import { Button, Card, Heading, Screen } from '@/components/app/ui'
import { MfaGate } from '@/components/app/MfaGate'
import { ADMIN_TOOLS as TOOLS } from '@/components/admin/AdminShell'

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
              <div className="grid gap-3 sm:grid-cols-2">
                {TOOLS.map((tool) => (
                  <Link key={tool.href} href={tool.href} className="no-underline">
                    <Card tone="support" className="flex flex-col gap-1 p-4 text-ink">
                      <span className="text-[15px] font-bold">{tool.title}</span>
                      <span className="text-[12.5px] text-mist">{tool.note}</span>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Screen>
      )}
    </RequireMe>
  )
}
