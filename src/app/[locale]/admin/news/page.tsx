'use client'

// 管理者: お知らせ管理(一覧・作成・編集・公開切替・削除・AI下書き)。
// 設計: docs/news_section_design.md §3.2 / §4。管理ダッシュボードには足さず独立ページにする。
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
    NEWS_CATEGORIES, NEWS_CATEGORY_META, NEWS_TITLE_MAX, NEWS_BODY_MAX, NEWS_MATERIAL_MAX,
    type NewsCategory, type NewsPost, type NewsStatus,
} from '@/lib/constants/news'

type FormState = {
    category: NewsCategory
    title: string
    body: string
    external_url: string
    published_at: string   // "YYYY-MM-DD" または空
    status: NewsStatus
}
type Materials = { site: string; memo: string; notes: string }

// 日本時間の YYYY-MM-DD(sv-SE ロケールは ISO 形式で日付を出す)
const JST_DATE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' })
const toDateInput = (iso: string | null) => (iso ? JST_DATE.format(new Date(iso)) : '')
const emptyForm = (): FormState => ({ category: 'NOTICE', title: '', body: '', external_url: '', published_at: JST_DATE.format(new Date()), status: 'DRAFT' })
const emptyMaterials = (): Materials => ({ site: '', memo: '', notes: '' })

const STATUS_LABEL: Record<NewsStatus, string> = { DRAFT: '下書き', PUBLISHED: '公開中' }

export default function AdminNewsPage() {
    const router = useRouter()
    const [posts, setPosts] = useState<NewsPost[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [form, setForm] = useState<FormState>(emptyForm)
    const [materials, setMaterials] = useState<Materials>(emptyMaterials)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)

    const authHeader = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push('/admin/login')
            return null
        }
        return { Authorization: `Bearer ${session.access_token}` }
    }, [router])

    const loadPosts = useCallback(async () => {
        setError(null)
        try {
            const headers = await authHeader()
            if (!headers) return
            const roleRes = await fetch('/api/admin/check-role', { headers })
            const roleData = await roleRes.json()
            if (roleData.role !== 'ADMIN') {
                router.push('/admin/login')
                return
            }
            const res = await fetch('/api/admin/news', { headers, cache: 'no-store' })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'お知らせの取得に失敗しました')
            setPosts(result.posts ?? [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'お知らせの取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }, [authHeader, router])

    useEffect(() => { loadPosts() }, [loadPosts])

    const startNew = () => {
        setSelectedId(null)
        setForm(emptyForm())
        setMaterials(emptyMaterials())
        setFormError(null)
        setNotice(null)
    }

    const selectPost = (post: NewsPost) => {
        setSelectedId(post.id)
        setForm({
            category: post.category,
            title: post.title,
            body: post.body,
            external_url: post.external_url ?? '',
            published_at: toDateInput(post.published_at),
            status: post.status,
        })
        setMaterials(emptyMaterials())
        setFormError(null)
        setNotice(null)
        if (typeof window !== 'undefined' && window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }))

    const handleGenerate = async () => {
        setFormError(null)
        const payload = form.category === 'SUPPORTER_JOINED'
            ? { site: materials.site, memo: materials.memo }
            : { notes: materials.notes }
        if (!Object.values(payload).some((v) => v.trim())) {
            setFormError('材料を入力してください')
            return
        }
        if (form.body.trim() && !window.confirm('本文が入力済みです。AIの下書きで上書きしますか?')) return
        setGenerating(true)
        try {
            const headers = await authHeader()
            if (!headers) return
            const res = await fetch('/api/admin/news/draft', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: form.category, materials: payload }),
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || '下書きを作れませんでした')
            setForm((prev) => ({ ...prev, title: result.draft.title, body: result.draft.body }))
            setNotice('AIの下書きを入れました。内容を確認して直してください([要確認]の箇所は必ず埋める)')
        } catch (err) {
            setFormError(err instanceof Error ? err.message : '下書きを作れませんでした')
        } finally {
            setGenerating(false)
        }
    }

    const handleSave = async () => {
        setFormError(null)
        setNotice(null)
        if (!form.title.trim()) { setFormError('タイトルを入力してください'); return }
        if (!form.body.trim() && !form.external_url.trim()) { setFormError('本文か外部リンクのどちらかは必要です'); return }
        if (form.status === 'PUBLISHED' && selectedId === null && !window.confirm('すぐに公開されます。よろしいですか?')) return
        setSaving(true)
        try {
            const headers = await authHeader()
            if (!headers) return
            const res = await fetch(selectedId ? `/api/admin/news/${selectedId}` : '/api/admin/news', {
                method: selectedId ? 'PATCH' : 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: form.category,
                    title: form.title,
                    body: form.body,
                    external_url: form.external_url.trim() || null,
                    published_at: form.published_at || null,
                    status: form.status,
                }),
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || '保存に失敗しました')
            const saved = result.post as NewsPost
            setSelectedId(saved.id)
            setForm((prev) => ({ ...prev, published_at: toDateInput(saved.published_at) }))
            setNotice(saved.status === 'PUBLISHED' ? '保存しました(公開中)' : '保存しました(下書き)')
            await loadPosts()
        } catch (err) {
            setFormError(err instanceof Error ? err.message : '保存に失敗しました')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!selectedId) return
        const target = posts.find((p) => p.id === selectedId)
        if (!window.confirm(`「${target?.title ?? ''}」を削除します。元に戻せません。よろしいですか?`)) return
        setDeleting(true)
        setFormError(null)
        try {
            const headers = await authHeader()
            if (!headers) return
            const res = await fetch(`/api/admin/news/${selectedId}`, { method: 'DELETE', headers })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || '削除に失敗しました')
            startNew()
            setNotice('削除しました')
            await loadPosts()
        } catch (err) {
            setFormError(err instanceof Error ? err.message : '削除に失敗しました')
        } finally {
            setDeleting(false)
        }
    }

    if (loading) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">読み込み中...</div>
    }

    const isSupporterJoined = form.category === 'SUPPORTER_JOINED'
    const selected = posts.find((p) => p.id === selectedId) ?? null

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs text-gray-500">管理者メニュー</p>
                        <h1 className="text-2xl font-bold text-gray-900">お知らせ管理</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            トップページの「お知らせ」欄に出す記事を作成・公開します。公開中の新しい3件がトップに、全件が /news に並びます。
                        </p>
                    </div>
                    <Link href="/admin/dashboard" className="text-sm font-medium text-teal-700 hover:text-teal-900 hover:underline">
                        管理ダッシュボードへ戻る
                    </Link>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {error && (
                    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}

                <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    {/* ── 一覧 ── */}
                    <section className="rounded-xl bg-white border border-gray-100 overflow-hidden self-start">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900">投稿一覧 <span className="text-xs font-normal text-gray-400">{posts.length}件</span></h2>
                            <button onClick={startNew} className="text-sm font-medium bg-teal-500 hover:bg-teal-600 text-white px-3 py-1.5 rounded-lg transition">
                                ＋ 新規作成
                            </button>
                        </div>
                        {posts.length === 0 ? (
                            <p className="px-5 py-8 text-sm text-gray-500 text-center">まだ投稿がありません。「新規作成」から始めてください。</p>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {posts.map((post) => (
                                    <li key={post.id}>
                                        <button
                                            onClick={() => selectPost(post)}
                                            className={`w-full text-left px-5 py-3 transition ${post.id === selectedId ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className={`rounded-full px-2 py-0.5 font-bold ${post.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {STATUS_LABEL[post.status]}
                                                </span>
                                                <span className="text-gray-500">{NEWS_CATEGORY_META[post.category]?.labelJa ?? post.category}</span>
                                                <span className="text-gray-400 ml-auto tabular-nums">{toDateInput(post.published_at) || '日付なし'}</span>
                                            </div>
                                            <p className="mt-1 text-sm font-medium text-gray-900 line-clamp-2">{post.title}</p>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* ── フォーム ── */}
                    <section className="rounded-xl bg-white border border-gray-100">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900">{selectedId ? '編集' : '新規作成'}</h2>
                            {selected?.status === 'PUBLISHED' && !selected.external_url && (
                                <a href={`/news/${selected.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-700 hover:underline">
                                    公開ページを開く ↗
                                </a>
                            )}
                        </div>

                        <div className="p-5 space-y-5">
                            {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}
                            {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}

                            {/* 種別 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">種別</label>
                                <div className="flex flex-wrap gap-2">
                                    {NEWS_CATEGORIES.map((category) => (
                                        <button
                                            key={category}
                                            type="button"
                                            onClick={() => update('category', category)}
                                            className={`rounded-full border px-3 py-1 text-sm transition ${form.category === category ? 'border-teal-500 bg-teal-50 text-teal-700 font-bold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {NEWS_CATEGORY_META[category].labelJa}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* AI 下書き */}
                            <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4 space-y-3">
                                <div>
                                    <p className="text-sm font-bold text-teal-800">AIで下書きを作る</p>
                                    <p className="text-xs text-teal-700/80 mt-0.5">
                                        材料を貼って押すと、タイトルと本文の下書きが入ります。材料にない事実は書かれず、足りない所は [要確認] として残ります。
                                        個人名・連絡先は「掲載可」と書いた場合だけ使われます。
                                    </p>
                                </div>
                                {isSupporterJoined ? (
                                    <>
                                        <textarea
                                            value={materials.site}
                                            onChange={(e) => setMaterials((m) => ({ ...m, site: e.target.value }))}
                                            maxLength={NEWS_MATERIAL_MAX}
                                            rows={4}
                                            placeholder="団体のサイトから写した文(団体の紹介・活動内容など、必要な部分をコピペ)"
                                            className="w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                        />
                                        <textarea
                                            value={materials.memo}
                                            onChange={(e) => setMaterials((m) => ({ ...m, memo: e.target.value }))}
                                            maxLength={NEWS_MATERIAL_MAX}
                                            rows={5}
                                            placeholder={'電話などで聞いたメモ(箇条書きでOK)\n例: ・担当は○○さん(掲載可) ・活動地域は熊本市 ・ここは書かないで、と言われた話は「非公開」と付ける'}
                                            className="w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                        />
                                    </>
                                ) : (
                                    <textarea
                                        value={materials.notes}
                                        onChange={(e) => setMaterials((m) => ({ ...m, notes: e.target.value }))}
                                        maxLength={NEWS_MATERIAL_MAX}
                                        rows={5}
                                        placeholder={
                                            form.category === 'MAINTENANCE'
                                                ? '例: 10月5日(日) 午前2時〜4時 サーバーメンテナンス。ログインと相談の投稿ができない'
                                                : form.category === 'INTERVIEW'
                                                    ? '例: noteの記事タイトル、誰に何を聞いたか、印象に残った一言'
                                                    : '伝えたいことの箇条書き(何が・いつから・変わらないこと・変わること)'
                                        }
                                        className="w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                    />
                                )}
                                <button
                                    type="button"
                                    onClick={handleGenerate}
                                    disabled={generating}
                                    className="rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 transition"
                                >
                                    {generating ? '下書きを作成中…(20秒ほどかかります)' : '下書きを作る'}
                                </button>
                            </div>

                            {/* タイトル */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    タイトル <span className="text-xs font-normal text-gray-400">{form.title.length}/{NEWS_TITLE_MAX}</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => update('title', e.target.value)}
                                    maxLength={NEWS_TITLE_MAX}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                />
                            </div>

                            {/* 本文 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    本文 <span className="text-xs font-normal text-gray-400">{form.body.length}/{NEWS_BODY_MAX}</span>
                                </label>
                                <textarea
                                    value={form.body}
                                    onChange={(e) => update('body', e.target.value)}
                                    maxLength={NEWS_BODY_MAX}
                                    rows={16}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-300"
                                />
                                <p className="mt-1 text-xs text-gray-400">書式は3つだけ: 空行で段落を分ける / 行頭「## 」で小見出し / https:// から始まるURLは自動でリンクになる</p>
                            </div>

                            {/* 外部リンク */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">外部リンク <span className="text-xs font-normal text-gray-400">(任意。note の記事など)</span></label>
                                <input
                                    type="url"
                                    value={form.external_url}
                                    onChange={(e) => update('external_url', e.target.value)}
                                    placeholder="https://note.com/..."
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                />
                                <p className="mt-1 text-xs text-gray-400">入れると、トップと一覧からはこのURLへ直接飛びます(本文は記事ページを開いた人だけが読む)</p>
                            </div>

                            {/* 公開日・状態 */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">公開日 <span className="text-xs font-normal text-gray-400">(表示日・並び順)</span></label>
                                    <input
                                        type="date"
                                        value={form.published_at}
                                        onChange={(e) => update('published_at', e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">状態</label>
                                    <div className="flex gap-2">
                                        {(['DRAFT', 'PUBLISHED'] as NewsStatus[]).map((status) => (
                                            <button
                                                key={status}
                                                type="button"
                                                onClick={() => update('status', status)}
                                                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${form.status === status
                                                    ? status === 'PUBLISHED' ? 'border-green-500 bg-green-50 text-green-700 font-bold' : 'border-gray-500 bg-gray-100 text-gray-800 font-bold'
                                                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                            >
                                                {STATUS_LABEL[status]}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="mt-1 text-xs text-gray-400">参加団体の記事は、下書きのまま本文を団体に送って OK をもらってから公開する</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        disabled={saving || generating}
                                        className="rounded-lg bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white text-sm font-bold px-5 py-2 transition"
                                    >
                                        {saving ? '保存中…' : form.status === 'PUBLISHED' ? '保存して公開' : '下書きを保存'}
                                    </button>
                                    {selectedId && (
                                        <button type="button" onClick={startNew} className="rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm px-4 py-2 transition">
                                            新規作成に切替
                                        </button>
                                    )}
                                </div>
                                {selectedId && (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="text-sm text-red-600 hover:text-red-800 hover:underline disabled:opacity-60"
                                    >
                                        {deleting ? '削除中…' : '削除'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    )
}
