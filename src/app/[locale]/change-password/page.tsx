// src/app/change-password/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { withLocalePath } from '@/i18n/routing'
import { supabase } from '@/lib/supabase/client'

// 初回ログインの強制変更（initial）と、ログイン中の自発的な変更（voluntary）を1つの画面で兼ねる。
// 判定は get-role の must_change_password で行う。クエリパラメータにすると
// 初回ログインの人がURLを書き換えて規約同意を飛ばせてしまうため。
type Mode = 'initial' | 'voluntary'

export default function ChangePasswordPage() {
    const t = useTranslations('auth.changePassword')
    const tAuth = useTranslations('auth.common')
    const tForm = useTranslations('common.form')
    const locale = useLocale()
    const [mode, setMode] = useState<Mode | null>(null)
    const [currentPassword, setCurrentPassword] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [agreed, setAgreed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const resolveMode = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                window.location.href = withLocalePath(locale, '/login')
                return
            }
            const roleRes = await fetch('/api/auth/get-role', {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            })
            const roleData = await roleRes.json()
            setMode(roleData.user?.must_change_password ? 'initial' : 'voluntary')
        }
        resolveMode()
    }, [locale])

    const errorMessage = (code: unknown) => {
        switch (code) {
            case 'CURRENT_PASSWORD_REQUIRED': return t('errorCurrentRequired')
            case 'CURRENT_PASSWORD_MISMATCH': return t('errorCurrentMismatch')
            case 'SAME_AS_CURRENT': return t('errorSameAsCurrent')
            case 'INVALID_NEW_PASSWORD': return t('errorTooShort')
            default: return typeof code === 'string' && code ? code : t('errorGeneric')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password !== confirmPassword) {
            setError(t('errorMismatch'))
            return
        }
        if (password.length < 8) {
            setError(t('errorTooShort'))
            return
        }
        // 規約同意は初回ログイン時のみ求める
        if (mode === 'initial' && !agreed) {
            setError(t('errorAgreement'))
            return
        }

        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                window.location.href = withLocalePath(locale, '/login')
                return
            }

            // 検証と更新はサーバー側でまとめて行う。クライアントで updateUser を呼ぶ形だと
            // 現在パスワードの確認をコンソールから素通りできてしまうため。
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    current_password: mode === 'voluntary' ? currentPassword : undefined,
                    new_password: password,
                }),
            })
            const result = await res.json()
            if (!res.ok) {
                setError(errorMessage(result.error))
                return
            }

            // 自発的な変更ならプロフィールへ戻すだけ
            if (mode === 'voluntary') {
                window.location.href = withLocalePath(locale, '/profile')
                return
            }

            // 初回はロールに応じたダッシュボードへ
            const roleRes = await fetch('/api/auth/get-role', {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            })
            const roleData = await roleRes.json()

            if (roleData.role === 'SUPPORTER') {
                window.location.href = withLocalePath(locale, '/supporter/dashboard')
            } else if (roleData.role === 'SOS') {
                window.location.href = withLocalePath(locale, '/sos/dashboard')
            } else {
                window.location.href = withLocalePath(locale, '/')
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('errorGeneric'))
        } finally {
            setLoading(false)
        }
    }

    if (mode === null) {
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
                <p className="mt-2 text-center text-sm text-gray-500">
                    {mode === 'initial' ? t('description') : t('descriptionVoluntary')}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* 現在のパスワード確認は自発的な変更のときだけ。
                            初回は直前にその初期パスワードでログインしたばかりなので求めない */}
                        {mode === 'voluntary' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    {t('currentLabel')}
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
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                {t('newLabel')}
                            </label>
                            <input
                                type="password"
                                required
                                minLength={8}
                                maxLength={64}
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                {t('confirmLabel')}
                            </label>
                            <input
                                type="password"
                                required
                                maxLength={64}
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        {/* 利用規約同意チェックボックス（初回ログイン時のみ） */}
                        {mode === 'initial' && (
                            <div>
                                <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                                    agreed ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={agreed}
                                        onChange={(e) => setAgreed(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 accent-teal-500 flex-shrink-0"
                                    />
                                    <span className="text-sm text-gray-600 leading-6">
                                        {tAuth.rich('agreement', {
                                            terms: (chunks) => (
                                                <Link href="/terms" target="_blank" rel="noopener noreferrer"
                                                    className="text-teal-600 font-medium underline underline-offset-2 hover:text-teal-700">
                                                    {chunks}
                                                </Link>
                                            ),
                                            privacy: (chunks) => (
                                                <Link href="/privacy" target="_blank" rel="noopener noreferrer"
                                                    className="text-teal-600 font-medium underline underline-offset-2 hover:text-teal-700">
                                                    {chunks}
                                                </Link>
                                            ),
                                        })}
                                    </span>
                                </label>
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={loading || (mode === 'initial' && !agreed)}
                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {loading ? t('submitting') : t('submit')}
                        </button>
                    </form>

                    {/* 自発的な変更はいつでも引き返せるようにする */}
                    {mode === 'voluntary' && (
                        <div className="mt-6 text-center">
                            <Link href="/profile" className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2">
                                {t('backToProfile')}
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
