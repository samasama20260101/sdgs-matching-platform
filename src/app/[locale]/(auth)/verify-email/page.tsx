// src/app/(auth)/verify-email/page.tsx
// メール確認待ち画面（本番環境でEmail Confirm ONの場合に表示）
'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function VerifyEmailContent() {
  const t = useTranslations('auth.verify')
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
          <h1 className="text-xl font-bold text-gray-800">{t('brand')}</h1>
          <p className="text-sm text-gray-400">{t('tagline')}</p>
        </div>

        {/* メインカード */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-5xl mb-5">📧</div>

          <h2 className="text-xl font-bold text-gray-800 mb-3">
            {t('title')}
          </h2>

          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            {email && (
              <span>
                {t.rich('sentTo', {
                  email,
                  em: (chunks) => <span className="font-medium text-teal-600">{chunks}</span>,
                })}
                <br /><br />
              </span>
            )}
            {t.rich('instruction', {
              em: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left mb-6">
            <p className="text-xs text-amber-700 font-medium mb-1">{t('notFoundTitle')}</p>
            <ul className="text-xs text-amber-600 space-y-1 list-disc list-inside">
              <li>{t('notFound1')}</li>
              <li>{t('notFound2')}</li>
              <li>{t('notFound3')}</li>
            </ul>
          </div>

          <p className="text-xs text-gray-400 mb-6">
            {t('expiry')}
          </p>

          <Link
            href="/login"
            className="block w-full py-3 px-4 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-xl font-medium text-sm hover:from-teal-700 hover:to-blue-700 transition-all"
          >
            {t('toLogin')}
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          {t('copyright')}
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
