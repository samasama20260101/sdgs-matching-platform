// src/app/change-password/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function ChangePasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [agreed, setAgreed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password !== confirmPassword) {
            setError('パスワードが一致しません')
            return
        }
        if (password.length < 8) {
            setError('パスワードは8文字以上で入力してください')
            return
        }
        if (!agreed) {
            setError('利用規約・プライバシーポリシーへの同意が必要です')
            return
        }

        setLoading(true)
        try {
            // 1. パスワードを更新
            const { error: updateError } = await supabase.auth.updateUser({ password })
            if (updateError) throw updateError

            // 2. must_change_password フラグを解除
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                await fetch('/api/auth/clear-must-change-password', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${session.access_token}` },
                })
            }

            // 3. ロールに応じてリダイレクト
            const roleRes = await fetch('/api/auth/get-role', {
                headers: { 'Authorization': `Bearer ${session?.access_token}` },
            })
            const roleData = await roleRes.json()

            if (roleData.role === 'SUPPORTER') {
                window.location.href = '/supporter/dashboard'
            } else if (roleData.role === 'SOS') {
                window.location.href = '/sos/dashboard'
            } else {
                window.location.href = '/'
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'エラーが発生しました')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h1 className="text-center text-3xl font-bold text-gray-900">SDGsマッチング</h1>
                <h2 className="mt-2 text-center text-xl text-gray-600">パスワードの変更</h2>
                <p className="mt-2 text-center text-sm text-gray-500">
                    初回ログインのため、新しいパスワードを設定してください
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
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                新しいパスワード（8文字以上）
                            </label>
                            <input
                                type="password"
                                required
                                minLength={8}
                                maxLength={64}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                新しいパスワード（確認）
                            </label>
                            <input
                                type="password"
                                required
                                maxLength={64}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        {/* 利用規約同意チェックボックス */}
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
                                    <a href="/terms" target="_blank" rel="noopener noreferrer"
                                        className="text-teal-600 font-medium underline underline-offset-2 hover:text-teal-700">
                                        利用規約
                                    </a>
                                    および
                                    <a href="/privacy" target="_blank" rel="noopener noreferrer"
                                        className="text-teal-600 font-medium underline underline-offset-2 hover:text-teal-700">
                                        プライバシーポリシー
                                    </a>
                                    を読み、内容に同意します
                                </span>
                            </label>
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !agreed}
                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {loading ? '変更中...' : 'パスワードを変更する'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}