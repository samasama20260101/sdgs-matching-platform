'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type RegionSummary = {
    code: string
    country: string
    level: string
    name_local: string
    name_en: string | null
    sos_users_count: number
    supporter_organizations_count: number
}

type AdminRegionsResponse = {
    country: string
    level: string
    regions: RegionSummary[]
    unmapped_sos_regions: Array<{ code: string; count: number }>
    nationwide_supporter_organizations_count: number
    totals: {
        regions: number
        sos_users_with_region: number
        sos_users_with_unmapped_region: number
    }
}

export default function AdminRegionsPage() {
    const router = useRouter()
    const [highlight, setHighlight] = useState<string | null>(null)
    const [data, setData] = useState<AdminRegionsResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadRegions = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/admin/login')
                return
            }

            const roleRes = await fetch('/api/admin/check-role', {
                headers: { Authorization: `Bearer ${session.access_token}` },
            })
            const roleData = await roleRes.json()
            if (roleData.role !== 'ADMIN') {
                router.push('/admin/login')
                return
            }

            const res = await fetch('/api/admin/regions', {
                headers: { Authorization: `Bearer ${session.access_token}` },
                cache: 'no-store',
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || '地域コード一覧の取得に失敗しました')
            setData(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : '地域コード一覧の取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }, [router])

    useEffect(() => {
        setHighlight(new URLSearchParams(window.location.search).get('highlight'))
        loadRegions()
    }, [loadRegions])

    const highlightedRegion = useMemo(
        () => data?.regions.find((region) => region.code === highlight) ?? null,
        [data, highlight]
    )

    if (loading) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">読み込み中...</div>
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs text-gray-500">管理者メニュー</p>
                        <h1 className="text-2xl font-bold text-gray-900">地域コード一覧</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            SOS地域コードとサポーター活動地域の対応を確認できます。
                        </p>
                    </div>
                    <Link href="/admin/dashboard" className="text-sm font-medium text-teal-700 hover:text-teal-900 hover:underline">
                        管理ダッシュボードへ戻る
                    </Link>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {data && (
                    <>
                        <section className="grid gap-4 md:grid-cols-4">
                            <div className="rounded-xl bg-white border border-gray-100 p-4">
                                <p className="text-xs text-gray-500">地域マスタ</p>
                                <p className="mt-1 text-2xl font-bold text-gray-900">{data.totals.regions}</p>
                            </div>
                            <div className="rounded-xl bg-white border border-gray-100 p-4">
                                <p className="text-xs text-gray-500">地域登録済みSOS</p>
                                <p className="mt-1 text-2xl font-bold text-gray-900">{data.totals.sos_users_with_region}</p>
                            </div>
                            <div className="rounded-xl bg-white border border-gray-100 p-4">
                                <p className="text-xs text-gray-500">未定義コードSOS</p>
                                <p className="mt-1 text-2xl font-bold text-gray-900">{data.totals.sos_users_with_unmapped_region}</p>
                            </div>
                            <div className="rounded-xl bg-white border border-gray-100 p-4">
                                <p className="text-xs text-gray-500">全国対応団体</p>
                                <p className="mt-1 text-2xl font-bold text-gray-900">{data.nationwide_supporter_organizations_count}</p>
                            </div>
                        </section>

                        <section className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                            サポーター団体は複数地域を活動地域として登録できます。その場合、各地域の「対応団体数」に同じ団体がそれぞれカウントされます。
                            全国対応団体は個別地域には加算せず、上部の「全国対応団体」に分けて表示しています。
                        </section>

                        {highlight && !highlightedRegion && (
                            <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                地域コード <span className="font-mono">{highlight}</span> は地域マスタに見つかりません。
                            </section>
                        )}

                        {data.unmapped_sos_regions.length > 0 && (
                            <section className="rounded-xl bg-white border border-red-100 p-4">
                                <h2 className="text-sm font-semibold text-red-700">マスタ未定義のSOS地域コード</h2>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {data.unmapped_sos_regions.map((region) => (
                                        <span key={region.code} className="inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs text-red-700">
                                            <span className="font-mono">{region.code}</span>
                                            <span>{region.count}件</span>
                                        </span>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="rounded-xl bg-white border border-gray-100 overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100">
                                <h2 className="font-semibold text-gray-900">地域コードマスタ</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                                        <tr>
                                            <th className="px-5 py-3 text-left">コード</th>
                                            <th className="px-5 py-3 text-left">地域名</th>
                                            <th className="px-5 py-3 text-left">英語名</th>
                                            <th className="px-5 py-3 text-right">SOS人数</th>
                                            <th className="px-5 py-3 text-right">対応団体数</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {data.regions.map((region) => {
                                            const isHighlighted = region.code === highlight
                                            return (
                                                <tr key={region.code} className={isHighlighted ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                                                    <td className="px-5 py-3 font-mono text-xs text-gray-600">{region.code}</td>
                                                    <td className="px-5 py-3 font-medium text-gray-900">{region.name_local}</td>
                                                    <td className="px-5 py-3 text-gray-500">{region.name_en || '—'}</td>
                                                    <td className="px-5 py-3 text-right text-gray-700">{region.sos_users_count}</td>
                                                    <td className="px-5 py-3 text-right text-gray-700">{region.supporter_organizations_count}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </>
                )}
            </main>
        </div>
    )
}
