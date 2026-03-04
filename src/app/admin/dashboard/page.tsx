'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
    created_at: string
}

type SosUser = {
    id: string
    display_name: string
    real_name: string
    email: string
    created_at: string
    sos_region_code: string | null
}

type Case = {
    id: string
    title: string
    status: string
    created_at: string
    region_code: string | null
    users?: { display_name: string } | null
}

type ActiveView = 'supporters' | 'sos' | 'open_cases' | 'active_cases' | null

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    OPEN:        { label: 'サポーター待ち', color: 'bg-blue-100 text-blue-700' },
    MATCHED:     { label: 'マッチ済み',     color: 'bg-amber-100 text-amber-700' },
    IN_PROGRESS: { label: '対応中',         color: 'bg-purple-100 text-purple-700' },
    RESOLVED:    { label: '解決済み',       color: 'bg-green-100 text-green-700' },
    CANCELLED:   { label: '取消済み',       color: 'bg-gray-100 text-gray-500' },
    CLOSED:      { label: '終了',           color: 'bg-gray-100 text-gray-500' },
}

type FormData = {
    email: string
    password: string
    real_name: string
    display_name: string
    organization_name: string
    supporter_type: 'NPO' | 'CORPORATE'
    phone: string
}

const initialForm: FormData = {
    email: '',
    password: '',
    real_name: '',
    display_name: '',
    organization_name: '',
    supporter_type: 'NPO',
    phone: '',
}

export default function AdminDashboardPage() {
    const router = useRouter()

    const [supporters, setSupporters] = useState<Supporter[]>([])
    const [sosUsers, setSosUsers] = useState<SosUser[]>([])
    const [allCases, setAllCases] = useState<Case[]>([])
    const [sosCount, setSosCount] = useState(0)
    const [caseStats, setCaseStats] = useState({ open: 0, in_progress: 0, resolved: 0 })
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [form, setForm] = useState<FormData>(initialForm)
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)
    const [createSuccess, setCreateSuccess] = useState(false)
    const [activeView, setActiveView] = useState<ActiveView>(null)
    const detailRef = useRef<HTMLDivElement>(null)

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
            setSosUsers(data.sosUsers ?? [])
            setAllCases(data.cases ?? [])
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

    const handleTileClick = (view: ActiveView) => {
        if (activeView === view) {
            setActiveView(null)
            return
        }
        setActiveView(view)
        setTimeout(() => {
            detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 50)
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {([
                        { label: '相談者（SOS）', value: sosCount, color: 'text-blue-600', activeColor: 'ring-blue-400 bg-blue-50', view: 'sos' as ActiveView },
                        { label: 'サポーター', value: supporters.length, color: 'text-green-600', activeColor: 'ring-green-400 bg-green-50', view: 'supporters' as ActiveView },
                        { label: '未対応の案件', value: caseStats.open, color: 'text-yellow-600', activeColor: 'ring-yellow-400 bg-yellow-50', view: 'open_cases' as ActiveView },
                        { label: '対応中・解決済み', value: caseStats.in_progress + caseStats.resolved, color: 'text-purple-600', activeColor: 'ring-purple-400 bg-purple-50', view: 'active_cases' as ActiveView },
                    ] as const).map(({ label, value, color, activeColor, view }) => (
                        <button
                            key={label}
                            onClick={() => handleTileClick(view)}
                            className={`text-left rounded-lg shadow p-5 transition-all hover:shadow-md active:scale-95 ring-2 ${activeView === view ? `${activeColor} ring-2` : 'bg-white ring-transparent'}`}
                        >
                            <p className="text-sm text-gray-500">{label}</p>
                            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
                            <p className="text-xs text-gray-400 mt-1">{activeView === view ? '▲ 閉じる' : '▼ 一覧を見る'}</p>
                        </button>
                    ))}
                </div>

                {/* 詳細パネル（タイルクリック時） */}
                {activeView && (
                    <div ref={detailRef} className="bg-white rounded-lg shadow mb-6 overflow-hidden">
                        {/* SOS一覧 */}
                        {activeView === 'sos' && (
                            <>
                                <div className="px-6 py-4 border-b bg-blue-50 flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-blue-800">👥 相談者（SOS）一覧</h2>
                                    <span className="text-sm text-blue-600">{sosUsers.length}件</span>
                                </div>
                                {sosUsers.length === 0 ? (
                                    <div className="px-6 py-8 text-center text-gray-400">相談者がいません</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                                <tr>
                                                    <th className="px-6 py-3 text-left">表示名</th>
                                                    <th className="px-6 py-3 text-left">本名</th>
                                                    <th className="px-6 py-3 text-left">メール</th>
                                                    <th className="px-6 py-3 text-left">地域コード</th>
                                                    <th className="px-6 py-3 text-left">登録日</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {sosUsers.map((u) => (
                                                    <tr key={u.id} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 font-medium text-gray-900">{u.display_name || '—'}</td>
                                                        <td className="px-6 py-4 text-gray-700">{u.real_name || '—'}</td>
                                                        <td className="px-6 py-4 text-gray-500">{u.email}</td>
                                                        <td className="px-6 py-4 text-gray-500">{u.sos_region_code || '—'}</td>
                                                        <td className="px-6 py-4 text-gray-400">{new Date(u.created_at).toLocaleDateString('ja-JP')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}

                        {/* サポーター一覧（タイルからの展開） */}
                        {activeView === 'supporters' && (
                            <>
                                <div className="px-6 py-4 border-b bg-green-50 flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-green-800">🤝 サポーター一覧</h2>
                                    <button
                                        onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateSuccess(false) }}
                                        className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition"
                                    >
                                        ＋ 新規サポーター追加
                                    </button>
                                </div>
                                {supporters.length === 0 ? (
                                    <div className="px-6 py-8 text-center text-gray-400">サポーターがいません</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                                <tr>
                                                    <th className="px-6 py-3 text-left">組織名</th>
                                                    <th className="px-6 py-3 text-left">担当者</th>
                                                    <th className="px-6 py-3 text-left">種別</th>
                                                    <th className="px-6 py-3 text-left">メール</th>
                                                    <th className="px-6 py-3 text-left">登録日</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {supporters.map((s) => (
                                                    <tr key={s.id} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 font-medium text-gray-900">{s.organization_name || '—'}</td>
                                                        <td className="px-6 py-4 text-gray-700">{s.real_name}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.supporter_type === 'NPO' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                {s.supporter_type || '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-500">{s.email}</td>
                                                        <td className="px-6 py-4 text-gray-400">{new Date(s.created_at).toLocaleDateString('ja-JP')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}

                        {/* 未対応案件一覧 */}
                        {activeView === 'open_cases' && (() => {
                            const filtered = allCases.filter(c => c.status === 'OPEN')
                            return (
                                <>
                                    <div className="px-6 py-4 border-b bg-yellow-50 flex items-center justify-between">
                                        <h2 className="text-lg font-semibold text-yellow-800">⏳ 未対応の案件一覧</h2>
                                        <span className="text-sm text-yellow-600">{filtered.length}件</span>
                                    </div>
                                    {filtered.length === 0 ? (
                                        <div className="px-6 py-8 text-center text-gray-400">未対応の案件はありません</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left">タイトル</th>
                                                        <th className="px-6 py-3 text-left">相談者</th>
                                                        <th className="px-6 py-3 text-left">ステータス</th>
                                                        <th className="px-6 py-3 text-left">地域</th>
                                                        <th className="px-6 py-3 text-left">投稿日</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {filtered.map((c) => {
                                                        const st = STATUS_LABELS[c.status] ?? { label: c.status, color: 'bg-gray-100 text-gray-500' }
                                                        return (
                                                            <tr key={c.id} className="hover:bg-gray-50">
                                                                <td className="px-6 py-4 font-medium text-gray-900 max-w-xs truncate">{c.title}</td>
                                                                <td className="px-6 py-4 text-gray-700">{(c.users as { display_name: string } | null)?.display_name || '—'}</td>
                                                                <td className="px-6 py-4"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span></td>
                                                                <td className="px-6 py-4 text-gray-500">{c.region_code || '—'}</td>
                                                                <td className="px-6 py-4 text-gray-400">{new Date(c.created_at).toLocaleDateString('ja-JP')}</td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )
                        })()}

                        {/* 対応中・解決済み案件一覧 */}
                        {activeView === 'active_cases' && (() => {
                            const filtered = allCases.filter(c => ['MATCHED', 'IN_PROGRESS', 'RESOLVED'].includes(c.status))
                            return (
                                <>
                                    <div className="px-6 py-4 border-b bg-purple-50 flex items-center justify-between">
                                        <h2 className="text-lg font-semibold text-purple-800">🔄 対応中・解決済み案件一覧</h2>
                                        <span className="text-sm text-purple-600">{filtered.length}件</span>
                                    </div>
                                    {filtered.length === 0 ? (
                                        <div className="px-6 py-8 text-center text-gray-400">該当する案件はありません</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left">タイトル</th>
                                                        <th className="px-6 py-3 text-left">相談者</th>
                                                        <th className="px-6 py-3 text-left">ステータス</th>
                                                        <th className="px-6 py-3 text-left">地域</th>
                                                        <th className="px-6 py-3 text-left">投稿日</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {filtered.map((c) => {
                                                        const st = STATUS_LABELS[c.status] ?? { label: c.status, color: 'bg-gray-100 text-gray-500' }
                                                        return (
                                                            <tr key={c.id} className="hover:bg-gray-50">
                                                                <td className="px-6 py-4 font-medium text-gray-900 max-w-xs truncate">{c.title}</td>
                                                                <td className="px-6 py-4 text-gray-700">{(c.users as { display_name: string } | null)?.display_name || '—'}</td>
                                                                <td className="px-6 py-4"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span></td>
                                                                <td className="px-6 py-4 text-gray-500">{c.region_code || '—'}</td>
                                                                <td className="px-6 py-4 text-gray-400">{new Date(c.created_at).toLocaleDateString('ja-JP')}</td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )
                        })()}
                    </div>
                )}

                {/* サポーター一覧（常時表示） */}
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