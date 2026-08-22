// src/app/change-email/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { withLocalePath } from '@/i18n/routing'
import { supabase } from '@/lib/supabase/client'

// 差し替え自体は supabase.auth.updateUser({ email }) がクライアントから行う。
// アプリ自身がメールを送る仕組みを持たず、新アドレスへの確認メールを飛ばせるのが
// この経路だけのため。事前のパスワード確認はサーバー側（email-change-check）で行う。
export default function ChangeEmailPage() {
    const t = useTranslations('auth.changeEmail')
    const tForm = useTranslations('common.form')
    const locale = useLocale()
    const [currentEmail, setCurrentEmail] = useState<string | null>(null)
    const [newEmail, setNewEmail] = useState('')
    const [currentPassword, setCurrentPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [sentTo, setSentTo] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                window.location.href = withLocalePath(locale, '/login')
                return
            }
            const res = await fetch('/api/auth/get-role', {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            })
            const data = await res.json()
            setCurrentEmail(data.user?.email ?? session.user.email ?? '')
        }
        load()
    }, [locale])

    const errorMessage = (code: unknown) => {
        switch (code) {
            case 'INVALID_EMAIL': return t('errorInvalidEmail')
            case 'SAME_AS_CURRENT': return t('errorSameAsCurrent')
            case 'CURRENT_PASSWORD_REQUIRED': return t('errorCurrentRequired')
            case 'CURRENT_PASSWORD_MISMATCH': return t('errorCurrentMismatch')
            case 'EMAIL_ALREADY_USED': return t('errorAlreadyUsed')
            default: return typeof code === 'string' && code ? code : t('errorGeneric')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                window.location.href = withLocalePath(locale, '/login')
                return
            }

            // 1. サーバー側で現在パスワードと宛先アドレスを検査する
            const checkRes = await fetch('/api/auth/email-change-check', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ current_password: currentPassword, new_email: newEmail }),
            })
            const checkResult = await checkRes.json()
            if (!checkRes.ok) {
                setError(errorMessage(checkResult.error))
                return
            }

            // 2. 確認メールの送信は Supabase に任せる。
            //    リンクが踏まれるまで auth 側のアドレスは切り替わらない
            const { error: updateError } = await supabase.auth.updateUser({
                email: checkResult.new_email,
            })
            if (updateError) {
                setError(updateError.message)
                return
            }

            setSentTo(checkResult.new_email)
            setCurrentPassword('')
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('errorGeneric'))
        } finally {
            setLoading(false)
        }
    }

    if (currentEmail === null) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 flex items-center justify-center">
                <p className="text-sm text-gray-500">{tForm('loading')}</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h1 className="text-center text-3xl font-bold text-gray-900">{t('title')}</h1>
                <h2 className="mt-2 text-center text-xl text-gray-600">{t('heading')}</h2>
                <p className="mt-2 text-center text-sm text-gray-500">{t('description')}</p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    {sentTo ? (
                        <div className="space-y-5">
                            <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800 leading-6">
                                {t('sent', { email: sentTo })}
                            </div>
                            <p className="text-sm text-gray-600 leading-6">{t('sentNote')}</p>
                            <Link href="/profile"
                                className="block text-center text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2">
                                {t('backToProfile')}
                            </Link>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        {t('currentEmailLabel')}
                                    </label>
                                    <p className="mt-1 text-sm text-gray-500 break-all">{currentEmail}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        {t('newEmailLabel')}
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        maxLength={254}
                                        autoComplete="email"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        {t('currentPasswordLabel')}
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        maxLength={64}
                                        autoComplete="current-password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">{t('currentPasswordNote')}</p>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {loading ? t('submitting') : t('submit')}
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <Link href="/profile" className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2">
                                    {t('backToProfile')}
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
