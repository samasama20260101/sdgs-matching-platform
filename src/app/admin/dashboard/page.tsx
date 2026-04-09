'use client'
import { isMinor } from '@/lib/utils/age'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type Supporter = {
    id: string; real_name: string; display_name: string; email: string
    organization_name: string | null; supporter_type: string | null
    phone: string | null; created_at: string; is_suspended: boolean | null
}
type FeaturedSupporter = {
    id: string; display_name: string; organization_name: string | null
    supporter_type: string | null; is_featured: boolean; featured_order: number
}
type SosUser = {
    id: string; display_name: string; real_name: string
    email: string; created_at: string; sos_region_code: string | null
    birth_date: string | null
    is_suspended: boolean | null
}
type Case = {
    id: string; title: string; status: string; created_at: string
    region_code: string | null; users?: { display_name: string } | null
}
type TabKey = 'supporters' | 'sos' | 'open_cases' | 'active_cases' | 'inquiries'
type FormData = {
    email: string; password: string; real_name: string
    display_name: string; organization_name: string
    supporter_type: 'NPO' | 'CORPORATE' | 'GOVERNMENT'; phone: string
}
type AdminFormData = {
    email: string; password: string; real_name: string; display_name: string
}

const initialForm: FormData = {
    email: '', password: '', real_name: '', display_name: '',
    organization_name: '', supporter_type: 'NPO', phone: '',
}
const initialAdminForm: AdminFormData = {
    email: '', password: '', real_name: '', display_name: '',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    OPEN:        { label: 'サポーター待ち', color: 'bg-blue-100 text-blue-700' },
    MATCHED:     { label: 'マッチ済み・支援中', color: 'bg-amber-100 text-amber-700' },
    RESOLVED:    { label: '解決済み',       color: 'bg-teal-50 text-teal-700' },
    CANCELLED:   { label: '取消済み',       color: 'bg-gray-100 text-gray-500' },
    CLOSED:      { label: '終了',           color: 'bg-gray-100 text-gray-500' },
}

export default function AdminDashboardPage() {
    const router = useRouter()
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean; type: 'suspend' | 'unsuspend' | 'delete' | null
        userId: string; userName: string
    }>({ isOpen: false, type: null, userId: '', userName: '' })
    const [actionLoading, setActionLoading] = useState(false)
    const [supporters, setSupporters] = useState<Supporter[]>([])
    const [sosUsers, setSosUsers] = useState<SosUser[]>([])
    const [allCases, setAllCases] = useState<Case[]>([])
    const [sosCount, setSosCount] = useState(0)
    const [caseStats, setCaseStats] = useState({ open: 0, in_progress: 0, resolved: 0 })
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<TabKey>('supporters')
    const [inquiries, setInquiries] = useState<any[]>([])
    const [inquiryOpenCount, setInquiryOpenCount] = useState(0)
    const [inquiryStatusFilter, setInquiryStatusFilter] = useState<string>('OPEN')
    const [savingInquiryId, setSavingInquiryId] = useState<string | null>(null)
    const [featuredSupporters, setFeaturedSupporters] = useState<FeaturedSupporter[]>([])
    const [showFeaturedModal, setShowFeaturedModal] = useState(false)
    const [featuredSaving, setFeaturedSaving] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [form, setForm] = useState<FormData>(initialForm)
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)
    const [createSuccess, setCreateSuccess] = useState(false)
    const [showCreateAdminModal, setShowCreateAdminModal] = useState(false)
    const [adminForm, setAdminForm] = useState<AdminFormData>(initialAdminForm)
    const [creatingAdmin, setCreatingAdmin] = useState(false)
    const [createAdminError, setCreateAdminError] = useState<string | null>(null)
    const [createAdminSuccess, setCreateAdminSuccess] = useState(false)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const [statsRes, featuredRes, inquiryRes] = await Promise.all([
                fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${session.access_token}` } }),
                fetch('/api/admin/featured-supporters', { headers: { 'Authorization': `Bearer ${session.access_token}` } }),
                fetch('/api/admin/inquiries', { headers: { 'Authorization': `Bearer ${session.access_token}` } }),
            ])
            const data = await statsRes.json()
            if (!statsRes.ok) return
            const featuredData = await featuredRes.json()
            const inquiryData = await inquiryRes.json()
            setSupporters(data.supporters ?? [])
            setSosUsers(data.sosUsers ?? [])
            setAllCases(data.cases ?? [])
            setSosCount(data.sosCount)
            setCaseStats(data.caseStats)
            setFeaturedSupporters(featuredData.supporters ?? [])
            setInquiries(inquiryData.inquiries ?? [])
            setInquiryOpenCount(inquiryData.open_count ?? 0)
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

    const handleUserAction = async () => {
        if (actionLoading || !confirmModal.type) return
        setActionLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }
            const url = `/api/admin/users/${confirmModal.userId}`

            if (confirmModal.type === 'delete') {
                await fetch(url, { method: 'DELETE', headers })
            } else {
                await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ action: confirmModal.type }) })
            }
            setConfirmModal({ isOpen: false, type: null, userId: '', userName: '' })
            loadData()
        } catch {
            alert('操作に失敗しました')
        } finally {
            setActionLoading(false)
        }
    }

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

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreateAdminError(null)
        setCreatingAdmin(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('セッションが切れました。再ログインしてください。')
            const res = await fetch('/api/admin/create-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify(adminForm),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setCreateAdminSuccess(true)
            setAdminForm(initialAdminForm)
            setTimeout(() => { setCreateAdminSuccess(false); setShowCreateAdminModal(false) }, 2000)
        } catch (err: unknown) {
            setCreateAdminError(err instanceof Error ? err.message : 'エラーが発生しました')
        } finally {
            setCreatingAdmin(false)
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
        const res = await fetch('/api/admin/featured-supporters', {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ supporter_id: supporterId, is_featured: !currentValue, featured_order: !currentValue ? maxOrder + 1 : 0 }),
        })
        const result = await res.json()
        if (!res.ok || result.error) {
            alert('保存エラー: ' + (result.error || res.status))
            return
        }
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
        { key: 'supporters', label: 'サポーター',     icon: '🤝', count: supporters.length,                      numColor: 'text-teal-600',  borderColor: 'border-teal-500',  bgColor: 'bg-teal-50' },
        { key: 'sos',        label: '相談者（SOS）',  icon: '👥', count: sosCount,                               numColor: 'text-blue-600',   borderColor: 'border-blue-500',   bgColor: 'bg-blue-50' },
        { key: 'open_cases', label: '未対応の案件',   icon: '⏳', count: caseStats.open,                         numColor: 'text-yellow-600', borderColor: 'border-yellow-500', bgColor: 'bg-yellow-50' },
        { key: 'active_cases',label:'対応中・解決済み',icon:'🔄', count: caseStats.in_progress + caseStats.resolved, numColor: 'text-purple-600', borderColor: 'border-purple-500', bgColor: 'bg-purple-50' },
        { key: 'inquiries',  label: 'お問い合わせ',   icon: '📩', count: inquiryOpenCount, numColor: 'text-rose-600', borderColor: 'border-rose-500', bgColor: 'bg-rose-50' },
    ]

    const openCases = allCases.filter(c => c.status === 'OPEN')
    const activeCases = allCases.filter(c => ['MATCHED', 'RESOLVED'].includes(c.status))

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
                <h1 className="text-xl font-bold">SDGsマッチング 管理画面</h1>
                <button onClick={handleLogout} className="text-sm text-gray-300 hover:text-white transition">ログアウト</button>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                <div className="bg-white rounded-xl shadow overflow-hidden">

                    {/* ── タブヘッダー（数字カード兼） ── */}
                    <div className="grid grid-cols-2 md:grid-cols-5">
                        {TABS.map((tab, i) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={[
                                    'px-5 py-5 text-left transition-all border-b-[3px]',
                                    i < 4 ? 'border-r border-r-gray-100' : '',
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
                            <div className="px-6 py-3 flex items-center justify-between bg-teal-50 border-y border-teal-100">
                                <p className="text-sm text-teal-800 font-medium">{supporters.length}件登録</p>
                                <div className="flex gap-2">
                                    <button onClick={() => { loadFeaturedSupporters(); setShowFeaturedModal(true) }}
                                        className="bg-amber-500 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-amber-600 transition">
                                        ⭐ トップページ掲載設定
                                    </button>
                                    <button onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateSuccess(false) }}
                                        className="bg-teal-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-teal-700 transition">
                                        ＋ 新規サポーター追加
                                    </button>
                                    <button onClick={() => { setShowCreateAdminModal(true); setCreateAdminError(null); setCreateAdminSuccess(false) }}
                                        className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-indigo-700 transition">
                                        ＋ 管理者追加
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
                                                <th className="px-6 py-3 text-center">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {supporters.map(s => {
                                                const featured = featuredSupporters.find(f => f.id === s.id)
                                                const isFeatured = featured?.is_featured ?? false
                                                return (
                                                    <tr key={s.id} className={`hover:bg-gray-50 ${s.is_suspended ? 'bg-red-50' : ''}`}>
                                                        <td className="px-6 py-4 font-medium text-gray-900">{s.organization_name || '—'}{s.is_suspended && <span className="ml-2 text-xs text-red-600 font-bold">停止中</span>}</td>
                                                        <td className="px-6 py-4 text-gray-700">{s.real_name}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.supporter_type === 'NPO' ? 'bg-blue-100 text-blue-700' : s.supporter_type === 'GOVERNMENT' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
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
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {s.is_suspended ? (
                                                                    <button onClick={() => setConfirmModal({ isOpen: true, type: 'unsuspend', userId: s.id, userName: s.organization_name || s.real_name })}
                                                                        className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 whitespace-nowrap">停止解除</button>
                                                                ) : (
                                                                    <button onClick={() => setConfirmModal({ isOpen: true, type: 'suspend', userId: s.id, userName: s.organization_name || s.real_name })}
                                                                        className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200">停止</button>
                                                                )}
                                                                <button onClick={() => setConfirmModal({ isOpen: true, type: 'delete', userId: s.id, userName: s.organization_name || s.real_name })}
                                                                    className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">削除</button>
                                                            </div>
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
                                                <th className="px-6 py-3 text-center">未成年</th>
                                                <th className="px-6 py-3 text-left">登録日</th>
                                                <th className="px-6 py-3 text-center">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {sosUsers.map(u => (
                                                <tr key={u.id} className={`hover:bg-gray-50 ${u.is_suspended ? 'bg-red-50' : ''}`}>
                                                    <td className="px-6 py-4 font-medium text-gray-900">{u.display_name || '—'}{u.is_suspended && <span className="ml-2 text-xs text-red-600 font-bold">停止中</span>}</td>
                                                    <td className="px-6 py-4 text-gray-700">{u.real_name || '—'}</td>
                                                    <td className="px-6 py-4 text-gray-500">{u.email}</td>
                                                    <td className="px-6 py-4 text-gray-500">{u.sos_region_code || '—'}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        {isMinor(u.birth_date) && (
                                                            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                                🔰 未成年
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-400">{new Date(u.created_at).toLocaleDateString('ja-JP')}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {u.is_suspended ? (
                                                                <button onClick={() => setConfirmModal({ isOpen: true, type: 'unsuspend', userId: u.id, userName: u.display_name || u.real_name })}
                                                                    className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 whitespace-nowrap">停止解除</button>
                                                            ) : (
                                                                <button onClick={() => setConfirmModal({ isOpen: true, type: 'suspend', userId: u.id, userName: u.display_name || u.real_name })}
                                                                    className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200">停止</button>
                                                            )}
                                                            <button onClick={() => setConfirmModal({ isOpen: true, type: 'delete', userId: u.id, userName: u.display_name || u.real_name })}
                                                                className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">削除</button>
                                                        </div>
                                                    </td>
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

                    {/* ── 📩 お問い合わせタブ ── */}
                    {activeTab === 'inquiries' && (
                        <div className="p-6">
                            {/* ステータスフィルター */}
                            <div className="flex gap-2 mb-5">
                                {[
                                    { key: 'OPEN', label: '未対応', color: 'text-rose-600 border-rose-400 bg-rose-50' },
                                    { key: 'IN_PROGRESS', label: '対応中', color: 'text-yellow-600 border-yellow-400 bg-yellow-50' },
                                    { key: 'CLOSED', label: '解決済み', color: 'text-green-600 border-green-400 bg-green-50' },
                                    { key: '', label: 'すべて', color: 'text-gray-600 border-gray-400 bg-gray-50' },
                                ].map(s => (
                                    <button key={s.key}
                                        onClick={() => setInquiryStatusFilter(s.key)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${inquiryStatusFilter === s.key ? s.color : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                                        {s.label}
                                        {s.key === 'OPEN' && inquiryOpenCount > 0 && (
                                            <span className="ml-1.5 bg-rose-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{inquiryOpenCount}</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* 問い合わせ一覧 */}
                            <div className="space-y-4">
                                {inquiries
                                    .filter(iq => inquiryStatusFilter === '' || iq.status === inquiryStatusFilter)
                                    .map(iq => (
                                    <div key={iq.id} className="border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors">
                                        <div className="flex items-start justify-between gap-4 mb-3">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{iq.display_id}</span>
                                                    {iq.role && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">{iq.role}</span>}
                                                    {iq.users?.organization_name && <span className="text-xs text-gray-400">{iq.users.organization_name}</span>}
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                                        iq.status === 'OPEN' ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                                                        iq.status === 'IN_PROGRESS' ? 'bg-yellow-50 text-yellow-600 border border-yellow-200' :
                                                        'bg-green-50 text-green-600 border border-green-200'
                                                    }`}>{iq.status === 'OPEN' ? '未対応' : iq.status === 'IN_PROGRESS' ? '対応中' : '解決済み'}</span>
                                                </div>
                                                <p className="text-sm font-semibold text-gray-800 mt-1">{iq.category}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">{new Date(iq.created_at).toLocaleString('ja-JP')}</p>
                                            </div>
                                            {/* ステータス変更 */}
                                            <select
                                                value={iq.status}
                                                onChange={async (e) => {
                                                    const newStatus = e.target.value
                                                    setSavingInquiryId(iq.id)
                                                    const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession()
                                                    await fetch('/api/admin/inquiries', {
                                                        method: 'PATCH',
                                                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                                                        body: JSON.stringify({ id: iq.id, status: newStatus }),
                                                    })
                                                    setInquiries(prev => prev.map(i => i.id === iq.id ? { ...i, status: newStatus } : i))
                                                    setInquiryOpenCount(prev => {
                                                        if (iq.status === 'OPEN' && newStatus !== 'OPEN') return prev - 1
                                                        if (iq.status !== 'OPEN' && newStatus === 'OPEN') return prev + 1
                                                        return prev
                                                    })
                                                    setSavingInquiryId(null)
                                                }}
                                                disabled={savingInquiryId === iq.id}
                                                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-300"
                                            >
                                                <option value="OPEN">未対応</option>
                                                <option value="IN_PROGRESS">対応中</option>
                                                <option value="CLOSED">解決済み</option>
                                            </select>
                                        </div>

                                        {/* 送信者情報 */}
                                        <div className="text-xs text-gray-500 mb-3 flex flex-wrap gap-3">
                                            {iq.name && <span>👤 {iq.name}</span>}
                                            <span>✉️ <a href={`mailto:${iq.email}`} className="text-blue-500 hover:underline">{iq.email}</a></span>
                                            {iq.organization && <span>🏢 {iq.organization}</span>}
                                            {iq.phone && <span>📞 {iq.phone}</span>}
                                        </div>

                                        {/* 本文 */}
                                        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 whitespace-pre-wrap mb-3">{iq.message}</p>

                                        {/* 管理者メモ */}
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 mb-1 block">管理者メモ（対応記録）</label>
                                            <textarea
                                                defaultValue={iq.admin_memo || ''}
                                                onBlur={async (e) => {
                                                    const memo = e.target.value
                                                    const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession()
                                                    await fetch('/api/admin/inquiries', {
                                                        method: 'PATCH',
                                                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                                                        body: JSON.stringify({ id: iq.id, admin_memo: memo }),
                                                    })
                                                }}
                                                placeholder="対応内容をメモ（フォーカスが外れると自動保存）"
                                                rows={2}
                                                maxLength={2000}
                                                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-300 resize-none"
                                            />
                                        </div>
                                    </div>
                                ))}
                                {inquiries.filter(iq => inquiryStatusFilter === '' || iq.status === inquiryStatusFilter).length === 0 && (
                                    <div className="text-center py-16 text-gray-400">
                                        <div className="text-4xl mb-3">📭</div>
                                        <p className="text-sm">該当するお問い合わせはありません</p>
                                    </div>
                                )}
                            </div>
                        </div>
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
                                                    <span className={`text-xs ${s.supporter_type === 'NPO' ? 'text-blue-600' : s.supporter_type === 'GOVERNMENT' ? 'text-purple-600' : 'text-orange-600'}`}>{s.supporter_type}</span>
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
                                                    <span className={`text-xs ${s.supporter_type === 'NPO' ? 'text-blue-600' : s.supporter_type === 'GOVERNMENT' ? 'text-purple-600' : 'text-orange-600'}`}>{s.supporter_type}</span>
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
                            {createSuccess && <div className="p-3 bg-teal-50 border border-teal-200 rounded-md text-sm text-teal-700">✓ サポーターを作成しました</div>}
                            {createError && <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{createError}</div>}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">種別 <span className="text-red-500">*</span></label>
                                    <select value={form.supporter_type} onChange={e => setForm({ ...form, supporter_type: e.target.value as 'NPO' | 'CORPORATE' | 'GOVERNMENT' })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                                        <option value="NPO">NPO</option>
                                        <option value="CORPORATE">企業</option>
                                        <option value="GOVERNMENT">行政・公共機関</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">組織名 <span className="text-red-500">*</span></label>
                                    <input type="text" required maxLength={64} value={form.organization_name} onChange={e => setForm({ ...form, organization_name: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">担当者名 <span className="text-red-500">*</span></label>
                                    <input type="text" required maxLength={64} value={form.real_name} onChange={e => setForm({ ...form, real_name: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">表示名</label>
                                    <input type="text" maxLength={64} value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })}
                                        placeholder={form.organization_name || form.real_name}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">メールアドレス <span className="text-red-500">*</span></label>
                                <input type="email" required maxLength={254} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">初期パスワード <span className="text-red-500">*</span></label>
                                <input type="text" required minLength={8} maxLength={64} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                                    placeholder="8文字以上（サポーターに別途通知してください）"
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">電話番号</label>
                                <input type="tel" value={form.phone}
                                    onChange={e => {
                                        const sanitized = e.target.value.replace(/[-\s().+]/g, '');
                                        if (sanitized.length <= 15) setForm({ ...form, phone: e.target.value });
                                    }}
                                    placeholder="例：090-1234-5678（ハイフンあり可）"
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                                <p className="mt-1 text-xs text-gray-400">ハイフンは自動的に除去されDBに保存されます（最大15桁）</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)}
                                    className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-50">キャンセル</button>
                                <button type="submit" disabled={creating}
                                    className="flex-1 bg-teal-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                                    {creating ? '作成中...' : '作成する'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── 管理者作成モーダル ── */}
            {showCreateAdminModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="px-6 py-4 border-b flex items-center justify-between">
                            <h3 className="text-lg font-semibold">管理者アカウント追加</h3>
                            <button onClick={() => setShowCreateAdminModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>
                        <form onSubmit={handleCreateAdmin} className="px-6 py-4 space-y-4">
                            {createAdminSuccess && <div className="p-3 bg-teal-50 border border-teal-200 rounded-md text-sm text-teal-700">✓ 管理者アカウントを作成しました</div>}
                            {createAdminError && <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{createAdminError}</div>}
                            <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3">
                                <p className="text-xs text-indigo-700">⚠️ 管理者アカウントはすべての管理機能にアクセスできます。信頼できる担当者のみに付与してください。</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">氏名 <span className="text-red-500">*</span></label>
                                <input type="text" required maxLength={64} value={adminForm.real_name}
                                    onChange={e => setAdminForm({ ...adminForm, real_name: e.target.value })}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">表示名</label>
                                <input type="text" maxLength={64} value={adminForm.display_name}
                                    onChange={e => setAdminForm({ ...adminForm, display_name: e.target.value })}
                                    placeholder={adminForm.real_name || '省略時は氏名が使用されます'}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">メールアドレス <span className="text-red-500">*</span></label>
                                <input type="email" required maxLength={254} value={adminForm.email}
                                    onChange={e => setAdminForm({ ...adminForm, email: e.target.value })}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">初期パスワード <span className="text-red-500">*</span></label>
                                <input type="text" required minLength={8} maxLength={64} value={adminForm.password}
                                    onChange={e => setAdminForm({ ...adminForm, password: e.target.value })}
                                    placeholder="8文字以上（本人に別途通知してください）"
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                                <p className="mt-1 text-xs text-gray-400">初回ログイン時にパスワード変更が求められます</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreateAdminModal(false)}
                                    className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-50">キャンセル</button>
                                <button type="submit" disabled={creatingAdmin}
                                    className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                                    {creatingAdmin ? '作成中...' : '作成する'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── ユーザー操作確認モーダル ── */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 mx-4 max-w-sm w-full">
                        <div className="text-center mb-4">
                            <div className="text-4xl mb-3">
                                {confirmModal.type === 'delete' ? '🗑️' : confirmModal.type === 'suspend' ? '🚫' : '✅'}
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">
                                {confirmModal.type === 'delete' ? 'アカウントを削除しますか？' :
                                 confirmModal.type === 'suspend' ? 'アカウントを停止しますか？' :
                                 'アカウント停止を解除しますか？'}
                            </h3>
                            <p className="text-sm text-gray-600">
                                <span className="font-medium">{confirmModal.userName}</span>
                            </p>
                            {confirmModal.type === 'delete' && (
                                <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg p-2">
                                    ⚠️ この操作は取り消せません。関連データもすべて削除されます。
                                </p>
                            )}
                            {confirmModal.type === 'suspend' && (
                                <p className="text-xs text-orange-600 mt-2 bg-orange-50 rounded-lg p-2">
                                    停止するとこのユーザーはログインできなくなります。
                                </p>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmModal({ isOpen: false, type: null, userId: '', userName: '' })}
                                className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-50">
                                キャンセル
                            </button>
                            <button
                                onClick={handleUserAction}
                                disabled={actionLoading}
                                className={`flex-1 text-white py-2 px-4 rounded-lg text-sm font-medium disabled:opacity-50 ${
                                    confirmModal.type === 'delete' ? 'bg-red-600 hover:bg-red-700' :
                                    confirmModal.type === 'suspend' ? 'bg-orange-500 hover:bg-orange-600' :
                                    'bg-green-600 hover:bg-green-700'
                                }`}>
                                {actionLoading ? '処理中...' :
                                 confirmModal.type === 'delete' ? '削除する' :
                                 confirmModal.type === 'suspend' ? '停止する' : '停止解除する'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
