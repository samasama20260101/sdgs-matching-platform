'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type Supporter = {
    id: string; real_name: string; display_name: string; email: string
    organization_name: string | null; supporter_type: string | null
    phone: string | null; created_at: string
}
type FeaturedSupporter = {
    id: string; display_name: string; organization_name: string | null
    supporter_type: string | null; is_featured: boolean; featured_order: number
}
type SosUser = {
    id: string; display_name: string; real_name: string
    email: string; created_at: string; sos_region_code: string | null
}
type Case = {
    id: string; title: string; status: string; created_at: string
    region_code: string | null; users?: { display_name: string } | null
}
type TabKey = 'supporters' | 'sos' | 'open_cases' | 'active_cases'
type FormData = {
    email: string; password: string; real_name: string
    display_name: string; organization_name: string
    supporter_type: 'NPO' | 'CORPORATE'; phone: string
}

const initialForm: FormData = {
    email: '', password: '', real_name: '', display_name: '',
    organization_name: '', supporter_type: 'NPO', phone: '',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    OPEN:        { label: 'サポーター待ち', color: 'bg-blue-100 text-blue-700' },
    MATCHED:     { label: 'マッチ済み',     color: 'bg-amber-100 text-amber-700' },
    IN_PROGRESS: { label: '対応中',         color: 'bg-purple-100 text-purple-700' },
    RESOLVED:    { label: '解決済み',       color: 'bg-green-100 text-green-700' },
    CANCELLED:   { label: '取消済み',       color: 'bg-gray-100 text-gray-500' },
    CLOSED:      { label: '終了',           color: 'bg-gray-100 text-gray-500' },
}

export default function AdminDashboardPage() {
    const router = useRouter()
    const [supporters, setSupporters] = useState<Supporter[]>([])
    const [sosUsers, setSosUsers] = useState<SosUser[]>([])
    const [allCases, setAllCases] = useState<Case[]>([])
    const [sosCount, setSosCount] = useState(0)
    const [caseStats, setCaseStats] = useState({ open: 0, in_progress: 0, resolved: 0 })
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<TabKey>('supporters')
    const [featuredSupporters, setFeaturedSupporters] = useState<FeaturedSupporter[]>([])
    const [showFeaturedModal, setShowFeaturedModal] = useState(false)
    const [featuredSaving, setFeaturedSaving] = useState(false)
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
            const [statsRes, featuredRes] = await Promise.all([
                fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${session.access_token}` } }),
                fetch('/api/admin/featured-supporters', { headers: { 'Authorization': `Bearer ${session.access_token}` } }),
            ])
            const data = await statsRes.json()
            if (!statsRes.ok) return
            const featuredData = await featuredRes.json()
            setSupporters(data.supporters ?? [])
            setSosUsers(data.sosUsers ?? [])
            setAllCases(data.cases ?? [])
            setSosCount(data.sosCount)
            setCaseStats(data.caseStats)
            setFeaturedSupporters(featuredData.supporters ?? [])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/admin/login'); return }
            const res = await fetch('/api/admin/check-role', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
            const result = await res.json()
            if (result.role !== 'ADMIN') { router.push('/admin/login'); return }
            loadData()
        }
        checkAdmin()
    }, [router, loadData])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreateError(null)
        setCreating(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('セッションが切れました。再ログインしてください。')
            const res = await fetch('/api/admin/create-supporter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setCreateSuccess(true)
            setForm(initialForm)
            loadData()
            setTimeout(() => { setCreateSuccess(false); setShowCreateModal(false) }, 2000)
        } catch (err: unknown) {
            setCreateError(err instanceof Error ? err.message : 'エラーが発生しました')
        } finally {
            setCreating(false)
        }
    }

    const loadFeaturedSupporters = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch('/api/admin/featured-supporters', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
        const data = await res.json()
        setFeaturedSupporters(data.supporters ?? [])
    }

    const toggleFeatured = async (supporterId: string, currentValue: boolean) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const maxOrder = featuredSupporters.filter(s => s.is_featured).reduce((max, s) => Math.max(max, s.featured_order), 0)
        await fetch('/api/admin/featured-supporters', {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ supporter_id: supporterId, is_featured: !currentValue, featured_order: !currentValue ? maxOrder + 1 : 0 }),
        })
        await loadFeaturedSupporters()
    }

    const moveFeaturedOrder = async (id: string, direction: 'up' | 'down') => {
        const featured = featuredSupporters.filter(s => s.is_featured).sort((a, b) => a.featured_order - b.featured_order)
        const idx = featured.findIndex(s => s.id === id)
        if (direction === 'up' && idx === 0) return
        if (direction === 'down' && idx === featured.length - 1) return
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1
        const newOrders = featured.map((s, i) => ({ id: s.id, featured_order: i + 1 }))
        const tmp = newOrders[idx].featured_order
        newOrders[idx].featured_order = newOrders[swapIdx].featured_order
        newOrders[swapIdx].featured_order = tmp
        setFeaturedSaving(true)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setFeaturedSaving(false); return }
        await fetch('/api/admin/featured-supporters', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ orders: newOrders }),
        })
        setFeaturedSaving(false)
        await loadFeaturedSupporters()
    }

    const handleLogout = async () => { await supabase.auth.signOut(); router.push('/admin/login') }

    if (loading) {
        return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-gray-500">読み込み中...</p></div>
    }

    const TABS: { key: TabKey; label: string; icon: string; count: number; numColor: string; borderColor: string; bgColor: string }[] = [
        { key: 'supporters', label: 'サポーター',     icon: '🤝', count: supporters.length,                      numColor: 'text-green-600',  borderColor: 'border-green-500',  bgColor: 'bg-green-50' },
        { key: 'sos',        label: '相談者（SOS）',  icon: '👥', count: sosCount,                               numColor: 'text-blue-600',   borderColor: 'border-blue-500',   bgColor: 'bg-blue-50' },
        { key: 'open_cases', label: '未対応の案件',   icon: '⏳', count: caseStats.open,                         numColor: 'text-yellow-600', borderColor: 'border-yellow-500', bgColor: 'bg-yellow-50' },
        { key: 'active_cases',label:'対応中・解決済み',icon:'🔄', count: caseStats.in_progress + caseStats.resolved, numColor: 'text-purple-600', borderColor: 'border-purple-500', bgColor: 'bg-purple-50' },
    ]

    const openCases = allCases.filter(c => c.status === 'OPEN')
    const activeCases = allCases.filter(c => ['MATCHED', 'IN_PROGRESS', 'RESOLVED'].includes(c.status))

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
                <h1 className="text-xl font-bold">SDGsマッチング 管理画面</h1>
                <button onClick={handleLogout} className="text-sm text-gray-300 hover:text-white transition">ログアウト</button>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                <div className="bg-white rounded-xl shadow overflow-hidden">

                    {/* ── タブヘッダー（数字カード兼） ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4">
                        {TABS.map((tab, i) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={[
                                    'px-5 py-5 text-left transition-all border-b-[3px]',
                                    i < 3 ? 'border-r border-r-gray-100' : '',
                                    activeTab === tab.key
                                        ? `${tab.borderColor} ${tab.bgColor}`
                                        : 'border-b-transparent hover:bg-gray-50',
                                ].join(' ')}
                            >
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <span>{tab.icon}</span>
                                    <span className="text-xs text-gray-500 font-medium">{tab.label}</span>
                                </div>
                                <p className={`text-3xl font-black tracking-tight ${activeTab === tab.key ? tab.numColor : 'text-gray-700'}`}>
                                    {tab.count}
                                </p>
                            </button>
                        ))}
                    </div>

                    {/* ── タブコンテンツ ── */}

                    {/* サポーター */}
                    {activeTab === 'supporters' && (
                        <>
                            <div className="px-6 py-3 flex items-center justify-between bg-green-50 border-y border-green-100">
                                <p className="text-sm text-green-800 font-medium">{supporters.length}件登録</p>
                                <div className="flex gap-2">
                                    <button onClick={() => { loadFeaturedSupporters(); setShowFeaturedModal(true) }}
                                        className="bg-amber-500 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-amber-600 transition">
                                        ⭐ トップページ掲載設定
                                    </button>
                                    <button onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateSuccess(false) }}
                                        className="bg-green-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-green-700 transition">
                                        ＋ 新規サポーター追加
                                    </button>
                                </div>
                            </div>
                            {supporters.length === 0 ? (
                                <div className="px-6 py-12 text-center text-gray-400">サポーターがまだ登録されていません</div>
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
                                                <th className="px-6 py-3 text-center">トップ掲載</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {supporters.map(s => {
                                                const featured = featuredSupporters.find(f => f.id === s.id)
                                                const isFeatured = featured?.is_featured ?? false
                                                return (
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
                                                        <td className="px-6 py-4 text-center">
                                                            <button onClick={() => toggleFeatured(s.id, isFeatured)}
                                                                title={isFeatured ? 'トップ掲載中（クリックで解除）' : 'クリックでトップ掲載'}
                                                                className={`text-xl transition-all hover:scale-125 ${isFeatured ? 'opacity-100' : 'opacity-20 hover:opacity-50'}`}>
                                                                ⭐
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}

                    {/* SOS */}
                    {activeTab === 'sos' && (
                        <>
                            <div className="px-6 py-3 bg-blue-50 border-y border-blue-100">
                                <p className="text-sm text-blue-800 font-medium">{sosUsers.length}件登録</p>
                            </div>
                            {sosUsers.length === 0 ? (
                                <div className="px-6 py-12 text-center text-gray-400">相談者がいません</div>
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
                                            {sosUsers.map(u => (
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

                    {/* 未対応案件 */}
                    {activeTab === 'open_cases' && (
                        <>
                            <div className="px-6 py-3 bg-yellow-50 border-y border-yellow-100">
                                <p className="text-sm text-yellow-800 font-medium">{openCases.length}件がサポーターを待っています</p>
                            </div>
                            {openCases.length === 0 ? (
                                <div className="px-6 py-12 text-center text-gray-400">未対応の案件はありません</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                            <tr>
                                                <th className="px-6 py-3 text-left">タイトル</th>
                                                <th className="px-6 py-3 text-left">相談者</th>
                                                <th className="px-6 py-3 text-left">地域</th>
                                                <th className="px-6 py-3 text-left">投稿日</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {openCases.map(c => (
                                                <tr key={c.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 font-medium text-gray-900 max-w-xs truncate">{c.title}</td>
                                                    <td className="px-6 py-4 text-gray-700">{(c.users as { display_name: string } | null)?.display_name || '—'}</td>
                                                    <td className="px-6 py-4 text-gray-500">{c.region_code || '—'}</td>
                                                    <td className="px-6 py-4 text-gray-400">{new Date(c.created_at).toLocaleDateString('ja-JP')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}

                    {/* 対応中・解決済み */}
                    {activeTab === 'active_cases' && (
                        <>
                            <div className="px-6 py-3 bg-purple-50 border-y border-purple-100">
                                <p className="text-sm text-purple-800 font-medium">{activeCases.length}件が対応中または解決済みです</p>
                            </div>
                            {activeCases.length === 0 ? (
                                <div className="px-6 py-12 text-center text-gray-400">該当する案件はありません</div>
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
                                            {activeCases.map(c => {
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
                    )}

                </div>
            </main>

            {/* ── ⭐ 掲載設定モーダル ── */}
            {showFeaturedModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col">
                        <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-semibold">⭐ トップページ掲載設定</h3>
                                <p className="text-xs text-gray-400 mt-0.5">ONにしたサポーターがトップページに表示されます。↑↓で順番を変更できます。</p>
                            </div>
                            <button onClick={() => setShowFeaturedModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-6 space-y-4">
                            {featuredSupporters.filter(s => s.is_featured).length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-amber-600 mb-2">📌 掲載中（表示順）</p>
                                    <div className="space-y-2">
                                        {featuredSupporters.filter(s => s.is_featured).sort((a, b) => a.featured_order - b.featured_order).map((s, idx, arr) => (
                                            <div key={s.id} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                                                <span className="text-amber-500 font-bold w-5 text-center text-sm">{idx + 1}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-800 truncate">{s.organization_name || s.display_name}</p>
                                                    <span className={`text-xs ${s.supporter_type === 'NPO' ? 'text-blue-600' : 'text-orange-600'}`}>{s.supporter_type}</span>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button onClick={() => moveFeaturedOrder(s.id, 'up')} disabled={idx === 0 || featuredSaving}
                                                        className="w-7 h-7 flex items-center justify-center rounded border bg-white text-gray-500 hover:bg-gray-100 disabled:opacity-30 text-xs">↑</button>
                                                    <button onClick={() => moveFeaturedOrder(s.id, 'down')} disabled={idx === arr.length - 1 || featuredSaving}
                                                        className="w-7 h-7 flex items-center justify-center rounded border bg-white text-gray-500 hover:bg-gray-100 disabled:opacity-30 text-xs">↓</button>
                                                    <button onClick={() => toggleFeatured(s.id, true)}
                                                        className="w-7 h-7 flex items-center justify-center rounded border bg-white text-red-400 hover:bg-red-50 text-xs">✕</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <p className="text-xs font-semibold text-gray-400 mb-2">未掲載のサポーター</p>
                                {featuredSupporters.filter(s => !s.is_featured).length === 0 ? (
                                    <p className="text-sm text-gray-400 text-center py-4">すべて掲載中です</p>
                                ) : (
                                    <div className="space-y-2">
                                        {featuredSupporters.filter(s => !s.is_featured).map(s => (
                                            <div key={s.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-700 truncate">{s.organization_name || s.display_name}</p>
                                                    <span className={`text-xs ${s.supporter_type === 'NPO' ? 'text-blue-600' : 'text-orange-600'}`}>{s.supporter_type}</span>
                                                </div>
                                                <button onClick={() => toggleFeatured(s.id, false)}
                                                    className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-md hover:bg-amber-600 transition flex-shrink-0">
                                                    ⭐ 掲載する
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="px-6 py-3 border-t bg-gray-50 flex-shrink-0">
                            <button onClick={() => setShowFeaturedModal(false)}
                                className="w-full bg-gray-700 text-white py-2 rounded-md text-sm font-medium hover:bg-gray-800">閉じる</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── サポーター作成モーダル ── */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b flex items-center justify-between">
                            <h3 className="text-lg font-semibold">新規サポーター追加</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>
                        <form onSubmit={handleCreate} className="px-6 py-4 space-y-4">
                            {createSuccess && <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">✓ サポーターを作成しました</div>}
                            {createError && <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{createError}</div>}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">種別 <span className="text-red-500">*</span></label>
                                    <select value={form.supporter_type} onChange={e => setForm({ ...form, supporter_type: e.target.value as 'NPO' | 'CORPORATE' })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                                        <option value="NPO">NPO</option>
                                        <option value="CORPORATE">企業</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">組織名 <span className="text-red-500">*</span></label>
                                    <input type="text" required value={form.organization_name} onChange={e => setForm({ ...form, organization_name: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">担当者名 <span className="text-red-500">*</span></label>
                                    <input type="text" required value={form.real_name} onChange={e => setForm({ ...form, real_name: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">表示名</label>
                                    <input type="text" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })}
                                        placeholder={form.organization_name || form.real_name}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">メールアドレス <span className="text-red-500">*</span></label>
                                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">初期パスワード <span className="text-red-500">*</span></label>
                                <input type="text" required minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                                    placeholder="8文字以上（サポーターに別途通知してください）"
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">電話番号</label>
                                <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)}
                                    className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-50">キャンセル</button>
                                <button type="submit" disabled={creating}
                                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50">
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
