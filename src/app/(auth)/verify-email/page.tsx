// src/app/(auth)/verify-email/page.tsx
// メール確認待ち画面（本番環境でEmail Confirm ONの場合に表示）
'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* ロゴ */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-blue-500 shadow-lg mb-4">
            <span className="text-3xl">💌</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">明日もsamasama</h1>
          <p className="text-sm text-gray-400">SDGs Match Platform</p>
        </div>

        {/* メインカード */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-5xl mb-5">📧</div>

          <h2 className="text-xl font-bold text-gray-800 mb-3">
            確認メールをお送りしました
          </h2>

          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            {email && (
              <span>
                <span className="font-medium text-teal-600">{email}</span><br />
                に確認メールをお送りしました。<br /><br />
              </span>
            )}
            メール内の<span className="font-medium">「ご登録を完了する」</span>ボタンをクリックして、
            登録を完了してください。
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left mb-6">
            <p className="text-xs text-amber-700 font-medium mb-1">📬 メールが届かない場合</p>
            <ul className="text-xs text-amber-600 space-y-1 list-disc list-inside">
              <li>迷惑メールフォルダをご確認ください</li>
              <li>メールアドレスをお間違えの場合は再度ご登録ください</li>
              <li>数分経っても届かない場合はしばらくお待ちください</li>
            </ul>
          </div>

          <p className="text-xs text-gray-400 mb-6">
            ※ 確認リンクの有効期限は24時間です
          </p>

          <Link
            href="/login"
            className="block w-full py-3 px-4 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-xl font-medium text-sm hover:from-teal-700 hover:to-blue-700 transition-all"
          >
            ログイン画面へ
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 合同会社samasama
        </p>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}
