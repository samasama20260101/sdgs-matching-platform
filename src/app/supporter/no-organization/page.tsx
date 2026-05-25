'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, LogOut, Mail, ShieldAlert } from 'lucide-react'
import Header from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase/client'

export default function SupporterNoOrganizationPage() {
  const router = useRouter()

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

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700"
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
