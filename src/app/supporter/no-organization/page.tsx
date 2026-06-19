'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, Loader2, LogOut, Mail, RefreshCw, ShieldAlert } from 'lucide-react'
import Header from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase/client'

const MEMBERSHIP_RECHECK_INTERVAL_MS = 60_000

export default function SupporterNoOrganizationPage() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(false)
  const [checkMessage, setCheckMessage] = useState<string | null>(null)

  const checkMembership = useCallback(async (showMessage = false) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    setIsChecking(true)
    try {
      const response = await fetch('/api/auth/get-role', {
        cache: 'no-store',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })

      if (response.status === 401) {
        router.push('/login')
        return
      }
      if (response.status === 403) {
        await supabase.auth.signOut()
        router.push('/login?reason=suspended')
        return
      }
      if (!response.ok) {
        if (showMessage) setCheckMessage('所属状態の確認に失敗しました。少し時間を置いて再度お試しください。')
        return
      }

      const roleData = await response.json()
      if (roleData.role === 'SUPPORTER' && roleData.user?.organization_id) {
        router.replace('/supporter/dashboard')
        router.refresh()
        return
      }

      if (showMessage) setCheckMessage('まだ有効な所属団体がありません。団体管理者の操作完了後に再確認してください。')
    } finally {
      setIsChecking(false)
    }
  }, [router])

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState !== 'visible') return
      void checkMembership(false)
    }
    const intervalId = window.setInterval(refreshIfVisible, MEMBERSHIP_RECHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', refreshIfVisible)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', refreshIfVisible)
    }
  }, [checkMembership])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto flex max-w-2xl flex-col px-6 py-12">
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-gray-800">
              <Building2 className="size-5 text-teal-600" />
              所属団体がありません
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6 text-sm text-gray-600">
            <p>
              現在、このアカウントには有効なサポーター団体の所属がありません。
              団体管理者からメンバー追加されると、サポーター機能を利用できます。
            </p>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <p>
                  以前所属していた団体の案件・メッセージにはアクセスできません。
                  再所属する場合は、その団体の管理者に登録メールアドレスを伝えてください。
                </p>
              </div>
            </div>

            {checkMessage && (
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-600">
                {checkMessage}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => checkMembership(true)}
                disabled={isChecking}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isChecking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                所属状態を再確認
              </button>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
              >
                <Mail className="size-4" />
                運営に問い合わせる
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
              >
                <LogOut className="size-4" />
                ログアウトしてトップへ
              </button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
