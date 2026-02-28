'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type Supporter = {
    id: string
    real_name: string
    display_name: string
    email: string
    organization_name: string | null
    supporter_type: string | null
    phone: string | null
    service_area_nationwide: boolean
    created_at: string
}

type FormData = {
    email: string
    password: string
    real_name: string
    display_name: string
    organization_name: string
    supporter_type: 'NPO' | 'CORPORATE'
    phone: string
    service_area_nationwide: boolean
}

const initialForm: FormData = {
    email: '',
    password: '',
    real_name: '',
    display_name: '',
    organization_name: '',
    supporter_type: 'NPO',
    phone: '',
    service_area_nationwide: false,
}

export default function AdminDashboardPage() {
    const router = useRouter()

    const [supporters, setSupporters] = useState<Supporter[]>([])
    const [sosCount, setSosCount] = useState(0)
    const [caseStats, setCaseStats] = useState({ open: 0, in_progress: 0, resolved: 0 })
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [form, setForm] = useState<FormData>(initialForm)
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)
    const [createSuccess, setCreateSuccess] = useState(false)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const res = await fetch('/api/admin/stats', {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            })
            const data = await res.json()
            if (!res.ok) return

            setSupporters(data.supporters)
            setSosCount(data.sosCount)
            setCaseStats(data.caseStats)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/admin/login')
                return
            }

            // API経由でロール確認（RLSをバイパス）
            const res = await fetch('/api/admin/check-role', {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            })
            const result = await res.json()

            if (result.role !== 'ADMIN') {
                router.push('/admin/login')
                return
            }

            loadData()
        }
        checkAdmin()
    }, [router, loadData])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreateError(null)
        setCreating(true)

        try {
            // セッションからアクセストークンを取得
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('セッションが切れました。再ログインしてください。')

            const res = await fetch('/api/admin/create-supporter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(form),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setCreateSuccess(true)
            setForm(initialForm)
            loadData()
            setTimeout(() => {
                setCreateSuccess(false)
                setShowCreateModal(false)
            }, 2000)
        } catch (err: unknown) {
            setCreateError(err instanceof Error ? err.message : 'エラーが発生しました')
        } finally {
            setCreating(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/admin/login')
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <p className="text-gray-500">読み込み中...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* ヘッダー */}
            <header className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">SDGsマッチング 管理画面</h1>
                </div>
                <button
                    onClick={handleLogout}
                    className="text-sm text-gray-300 hover:text-white transition"
                >
                    ログアウト
                </button>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {/* サマリーカード */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: '相談者（SOS）', value: sosCount, color: 'text-blue-600' },
                        { label: 'サポーター', value: supporters.length, color: 'text-green-600' },
                        { label: '未対応の案件', value: caseStats.open, color: 'text-yellow-600' },
                        { label: '対応中・解決済み', value: caseStats.in_progress + caseStats.resolved, color: 'text-purple-600' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="bg-white rounded-lg shadow p-5">
                            <p className="text-sm text-gray-500">{label}</p>
                            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
                        </div>
                    ))}
                </div>

                {/* サポーター一覧 */}
                <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-800">サポーター一覧</h2>
                        <button
                            onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateSuccess(false) }}
                            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition"
                        >
                            ＋ 新規サポーター追加
                        </button>
                    </div>

                    {supporters.length === 0 ? (
                        <div className="px-6 py-12 text-center text-gray-400">
                            サポーターがまだ登録されていません
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                    <tr>
                                        <th className="px-6 py-3 text-left">組織名</th>
                                        <th className="px-6 py-3 text-left">担当者</th>
                                        <th className="px-6 py-3 text-left">種別</th>
                                        <th className="px-6 py-3 text-left">メール</th>
                                        <th className="px-6 py-3 text-left">全国対応</th>
                                        <th className="px-6 py-3 text-left">登録日</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {supporters.map((s) => (
                                        <tr key={s.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {s.organization_name || '—'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">{s.real_name}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.supporter_type === 'NPO'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-orange-100 text-orange-700'
                                                    }`}>
                                                    {s.supporter_type || '—'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">{s.email}</td>
                                            <td className="px-6 py-4">
                                                {s.service_area_nationwide ? (
                                                    <span className="text-green-600 font-medium">✓ 全国</span>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-gray-400">
                                                {new Date(s.created_at).toLocaleDateString('ja-JP')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* サポーター作成モーダル */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b flex items-center justify-between">
                            <h3 className="text-lg font-semibold">新規サポーター追加</h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-xl"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="px-6 py-4 space-y-4">
                            {createSuccess && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                                    ✓ サポーターを作成しました
                                </div>
                            )}
                            {createError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                                    {createError}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        種別 <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={form.supporter_type}
                                        onChange={(e) => setForm({ ...form, supporter_type: e.target.value as 'NPO' | 'CORPORATE' })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                    >
                                        <option value="NPO">NPO</option>
                                        <option value="CORPORATE">企業</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        組織名 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={form.organization_name}
                                        onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        担当者名 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={form.real_name}
                                        onChange={(e) => setForm({ ...form, real_name: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        表示名
                                    </label>
                                    <input
                                        type="text"
                                        value={form.display_name}
                                        onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                                        placeholder={form.organization_name || form.real_name}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    メールアドレス <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    初期パスワード <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    minLength={8}
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    placeholder="8文字以上（サポーターに別途通知してください）"
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    電話番号
                                </label>
                                <input
                                    type="tel"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="nationwide"
                                    checked={form.service_area_nationwide}
                                    onChange={(e) => setForm({ ...form, service_area_nationwide: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="nationwide" className="text-sm text-gray-700">
                                    全国対応
                                </label>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-50"
                                >
                                    キャンセル
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                                >
                                    {creating ? '作成中...' : '作成する'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}