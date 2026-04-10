// src/app/admin/login/page.tsx
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function AdminLoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            // 1. ログイン
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (authError) throw authError

            // 2. APIでロール確認（service_role keyでRLSをバイパス）
            const res = await fetch('/api/admin/check-role', {
                headers: {
                    'Authorization': `Bearer ${data.session.access_token}`,
                },
            })
            const result = await res.json()

            if (result.role !== 'ADMIN') {
                await supabase.auth.signOut()
                throw new Error('管理者アカウントではありません')
            }

            // 3. ダッシュボードへ
            window.location.href = '/admin/dashboard'
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'ログインに失敗しました'
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h1 className="text-center text-3xl font-bold text-white">
                    SDGsマッチング
                </h1>
                <h2 className="mt-2 text-center text-lg text-gray-400">
                    管理者ログイン
                </h2>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                メールアドレス
                            </label>
                            <input
                                type="email"
                                required
                                maxLength={254}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                パスワード
                            </label>
                            <input
                                type="password"
                                required
                                maxLength={64}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gray-900 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
                        >
                            {loading ? 'ログイン中...' : 'ログイン'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}