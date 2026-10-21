'use client'

// 管理者: お知らせ管理(一覧・作成・編集・公開/取り下げ・削除・AI下書き・見え方の確認)。
// 設計: docs/news_section_design.md §3.2 / §4。管理ダッシュボードには足さず独立ページにする。
// 2026-10-21 レビュー(運営者・操作設計・安全の 3 観点)を反映: 状態ごとの操作ボタン、毎回の確認、
// 未保存の変更の保護、保存中・AI 作成中の切り替え禁止、本物と同じ見え方の確認。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
    NEWS_CATEGORIES, NEWS_CATEGORY_META, NEWS_TITLE_MAX, NEWS_BODY_MAX, NEWS_MATERIAL_MAX, NEWS_TOP_LIMIT, NOTE_ARTICLE_WORKFLOW_ENABLED,
    type NewsAngle, type NewsCategory, type NewsPostAdmin, type NewsStatus,
} from '@/lib/constants/news'
import { NoteArticlePanel, type NoteArticleFields } from '@/components/admin/NoteArticlePanel'
import { NewsBodyView } from '@/components/news/NewsBodyView'
import { NewsCategoryChip } from '@/components/news/NewsCategoryChip'
import { formatNewsDate } from '@/lib/news/format'
import { hasUnresolvedPlaceholder } from '@/lib/news/bodyBlocks'

type FormState = {
    category: NewsCategory
    title: string
    body: string
    external_url: string
    published_at: string   // "YYYY-MM-DD" または空(空なら公開した日が入る)
    // note 記事ワークフロー(INTERVIEW 用)
    interview_source: string
    note_angle: NewsAngle | null
    note_article: string
    note_checklist: string
}
type Materials = { site: string; memo: string; notes: string }
type ListFilter = 'ALL' | NewsStatus

// 日本時間の YYYY-MM-DD(sv-SE ロケールは ISO 形式で日付を出す)
const JST_DATE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' })
const toDateInput = (iso: string | null) => (iso ? JST_DATE.format(new Date(iso)) : '')
const todayInput = () => JST_DATE.format(new Date())
const emptyForm = (): FormState => ({
    category: 'NOTICE', title: '', body: '', external_url: '', published_at: '',
    interview_source: '', note_angle: null, note_article: '', note_checklist: '',
})
const emptyMaterials = (): Materials => ({ site: '', memo: '', notes: '' })
const formFromPost = (post: NewsPostAdmin): FormState => ({
    category: post.category,
    title: post.title,
    body: post.body,
    external_url: post.external_url ?? '',
    published_at: toDateInput(post.published_at),
    interview_source: post.interview_source ?? '',
    note_angle: post.note_angle ?? null,
    note_article: post.note_article ?? '',
    note_checklist: post.note_checklist ?? '',
})
const sameForm = (a: FormState, b: FormState) => JSON.stringify(a) === JSON.stringify(b)

const STATUS_LABEL: Record<NewsStatus, string> = { DRAFT: '下書き', PUBLISHED: '公開中' }
const DISCARD_MESSAGE = '保存していない変更があります。破棄して移動しますか?'

function hostnameOf(url: string) {
    try { return new URL(url).hostname } catch { return url }
}

// 管理画面のプレビュー用の仮のリンクカード(公開ページではサーバーが OGP を取ってカードにする)
function PreviewLinkCard({ url }: { url: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500">公開ページでは、ここにリンク先のカード(画像・タイトル)が出ます</p>
            <p className="mt-1 text-sm font-medium text-gray-700 break-all">{hostnameOf(url)}</p>
        </div>
    )
}

// 記事ページと同じ見た目(タイトル・日付・種別・本文・外部リンク)
function ArticlePreview({ form }: { form: FormState }) {
    const dateIso = form.published_at ? `${form.published_at}T00:00:00+09:00` : new Date().toISOString()
    return (
        <article className="rounded-xl border border-gray-200 bg-white px-5 py-8 sm:px-8">
            <div className="mb-8">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                    <time>{formatNewsDate(dateIso, 'ja')}</time>
                    <NewsCategoryChip category={form.category} label={NEWS_CATEGORY_META[form.category].labelJa} />
                </div>
                <h1 className="mt-3 text-2xl sm:text-3xl font-black text-gray-900 leading-snug">{form.title || '(タイトル未入力)'}</h1>
            </div>
            {form.body.trim()
                ? <NewsBodyView body={form.body} renderLinkCard={(url, key) => <PreviewLinkCard key={key} url={url} />} />
                : <p className="text-sm text-gray-400">(本文なし)</p>}
            {form.external_url.trim() && (
                <div className="mt-10 space-y-4">
                    <PreviewLinkCard url={form.external_url.trim()} />
                    <span className="inline-flex items-center gap-2 rounded-2xl bg-teal-500 px-6 py-3 text-sm font-bold text-white">
                        続きを読む(外部サイトが開きます) <span aria-hidden="true">↗</span>
                    </span>
                    <p className="text-xs text-gray-400">リンク先: {hostnameOf(form.external_url.trim())}</p>
                </div>
            )}
        </article>
    )
}

export default function AdminNewsPage() {
    const router = useRouter()
    const [posts, setPosts] = useState<NewsPostAdmin[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [listFilter, setListFilter] = useState<ListFilter>('ALL')

    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [form, setForm] = useState<FormState>(emptyForm)
    const [savedForm, setSavedForm] = useState<FormState>(emptyForm)
    const [materials, setMaterials] = useState<Materials>(emptyMaterials)
    const [tab, setTab] = useState<'write' | 'preview'>('write')
    const [aiOpen, setAiOpen] = useState(true)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const editorRef = useRef<HTMLElement>(null)

    const selected = posts.find((p) => p.id === selectedId) ?? null
    const savedStatus: NewsStatus | null = selected?.status ?? null // null = まだ保存していない新しいお知らせ
    const busy = saving || deleting || generating
    const isDirty = !sameForm(form, savedForm) || Object.values(materials).some((v) => v.trim())

    // トップに出ている記事(公開中の新しい順に NEWS_TOP_LIMIT 件。一覧 API と同じ並び)
    const topIds = useMemo(() => new Set(
        posts.filter((p) => p.status === 'PUBLISHED').slice(0, NEWS_TOP_LIMIT).map((p) => p.id)
    ), [posts])

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

    // 未保存の変更があるまま、タブを閉じる・再読み込みするときに止める
    useEffect(() => {
        if (!isDirty) return
        const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }
        window.addEventListener('beforeunload', onBeforeUnload)
        return () => window.removeEventListener('beforeunload', onBeforeUnload)
    }, [isDirty])

    const scrollToEditor = () => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const startNew = () => {
        if (busy) return
        if (isDirty && !window.confirm(DISCARD_MESSAGE)) return
        setSelectedId(null)
        setForm(emptyForm())
        setSavedForm(emptyForm())
        setMaterials(emptyMaterials())
        setTab('write')
        setAiOpen(true)
        setFormError(null)
        setNotice(null)
        scrollToEditor()
    }

    const selectPost = (post: NewsPostAdmin) => {
        if (busy || post.id === selectedId) { scrollToEditor(); return }
        if (isDirty && !window.confirm(DISCARD_MESSAGE)) return
        const next = formFromPost(post)
        setSelectedId(post.id)
        setForm(next)
        setSavedForm(next)
        setMaterials(emptyMaterials())
        setTab('write')
        setAiOpen(false)
        setFormError(null)
        setNotice(null)
        scrollToEditor()
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
        if ((form.title.trim() || form.body.trim()) && !window.confirm('タイトルか本文が入力済みです。AIの下書きで上書きしますか?')) return
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
            setNotice('AIの下書きを入れました。内容を確認して直してください([要確認]の箇所は必ず埋める)。まだ保存していません')
        } catch (err) {
            setFormError(err instanceof Error ? err.message : '下書きを作れませんでした')
        } finally {
            setGenerating(false)
        }
    }

    const handleNoteFields = (patch: Partial<NoteArticleFields>) => setForm((prev) => ({ ...prev, ...patch }))

    // note 記事の本文ができたら、投稿のタイトルと導入文が空のときだけ埋める(入力済みなら触らない)
    const handleDraftWritten = ({ title, lead }: { title: string; lead: string }) => {
        setForm((prev) => ({
            ...prev,
            title: prev.title.trim() ? prev.title : title.slice(0, NEWS_TITLE_MAX),
            body: prev.body.trim() ? prev.body : lead,
        }))
        setNotice('note 記事の本文を入れました。投稿のタイトルと導入文が空だった場合はあわせて入れています。最後に保存してください')
    }

    // 保存の本体。status は押したボタンで決まる(下書き保存・公開する・変更を反映・公開をやめる)
    const save = async (status: NewsStatus, successMessage: string, publishedAtOverride?: string) => {
        setFormError(null)
        setNotice(null)
        if (!form.title.trim()) { setFormError('タイトルを入力してください'); return }
        if (!form.body.trim() && !form.external_url.trim()) { setFormError('本文か外部リンクのどちらかは必要です'); return }
        const requestId = selectedId
        const sentForm = publishedAtOverride !== undefined ? { ...form, published_at: publishedAtOverride } : form
        setSaving(true)
        try {
            const headers = await authHeader()
            if (!headers) return
            const res = await fetch(requestId ? `/api/admin/news/${requestId}` : '/api/admin/news', {
                method: requestId ? 'PATCH' : 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: sentForm.category,
                    title: sentForm.title,
                    body: sentForm.body,
                    external_url: sentForm.external_url.trim() || null,
                    published_at: sentForm.published_at || null,
                    status,
                    ...(NOTE_ARTICLE_WORKFLOW_ENABLED ? {
                        interview_source: sentForm.interview_source,
                        note_angle: sentForm.note_angle,
                        note_article: sentForm.note_article,
                        note_checklist: sentForm.note_checklist,
                    } : {}),
                }),
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || '保存に失敗しました')
            const saved = result.post as NewsPostAdmin
            const next = { ...sentForm, published_at: toDateInput(saved.published_at) }
            setSelectedId(saved.id)
            setForm(next)
            setSavedForm(next)
            setMaterials(emptyMaterials())
            setNotice(successMessage)
            await loadPosts()
        } catch (err) {
            const message = err instanceof Error ? err.message : '保存に失敗しました'
            // 新規作成で通信が途中で切れた場合、サーバー側では作られていることがある。一覧を読み直して二重登録を防ぐ
            if (!requestId) {
                await loadPosts()
                setFormError(`${message}。一覧に同じ記事ができていないか確かめてから、保存し直してください`)
            } else {
                setFormError(message)
            }
        } finally {
            setSaving(false)
        }
    }

    // 公開するときの公開日: 空なら公開した日(サーバーが入れる)。古い日付なら今日にするか聞く。未来の日付は予約公開ではないことを伝える
    const confirmPublishDate = (): string | undefined | null => {
        const date = form.published_at
        const today = todayInput()
        if (date && date < today) {
            return window.confirm(`公開日が ${date} のままです。今日(${today})の日付にしますか?\n「キャンセル」なら ${date} のまま公開します。`) ? today : undefined
        }
        if (date && date > today) {
            return window.confirm(`公開日が未来(${date})になっています。予約公開ではなく、今すぐサイトに出ます(日付だけ ${date} と表示されます)。よろしいですか?`) ? undefined : null
        }
        return undefined
    }

    const handleSaveDraft = () => save('DRAFT', savedStatus === null ? '下書きとして保存しました(サイトには出ていません)' : '下書きを保存しました(サイトには出ていません)')

    const handlePublish = () => {
        if (!window.confirm('この記事をサイトに公開します。トップページと「お知らせ」一覧にすぐ表示されます。よろしいですか?')) return
        const date = confirmPublishDate()
        if (date === null) return
        save('PUBLISHED', '公開しました。いまサイトに出ています', date)
    }

    const handleApplyChanges = () => {
        if (!window.confirm('公開中の記事を書き換えます。保存するとすぐにサイトに反映されます。よろしいですか?')) return
        save('PUBLISHED', '変更をサイトに反映しました')
    }

    const handleUnpublish = () => {
        if (!window.confirm('この記事をサイトから取り下げます。削除はしないので、あとで公開し直せます。\n入力中の変更も一緒に保存されます。よろしいですか?')) return
        save('DRAFT', '公開をやめました。サイトには出ていません(下書きとして残っています)')
    }

    const handleDelete = async () => {
        if (!selectedId || busy) return
        const title = selected?.title ?? ''
        const message = selected?.status === 'PUBLISHED'
            ? `「${title}」を削除します。元に戻せません。\n公開をやめるだけなら、削除せずに「公開をやめる」を使ってください。\n削除してよろしいですか?`
            : `「${title}」を削除します。元に戻せません。よろしいですか?`
        if (!window.confirm(message)) return
        setDeleting(true)
        setFormError(null)
        try {
            const headers = await authHeader()
            if (!headers) return
            const res = await fetch(`/api/admin/news/${selectedId}`, { method: 'DELETE', headers })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || '削除に失敗しました')
            setSelectedId(null)
            setForm(emptyForm())
            setSavedForm(emptyForm())
            setMaterials(emptyMaterials())
            setTab('write')
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
    // AI の下書きが残す「[要確認]」(公開はサーバーでも止める)
    const hasPlaceholder = hasUnresolvedPlaceholder(form.title, form.body)
    const visiblePosts = listFilter === 'ALL' ? posts : posts.filter((p) => p.status === listFilter)
    const counts = { ALL: posts.length, PUBLISHED: posts.filter((p) => p.status === 'PUBLISHED').length, DRAFT: posts.filter((p) => p.status === 'DRAFT').length }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs text-gray-500">管理者メニュー</p>
                        <h1 className="text-2xl font-bold text-gray-900">お知らせ管理</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            トップページの「お知らせ」欄に出す記事を作成・公開します。公開中の新しい{NEWS_TOP_LIMIT}件がトップに、全件が /news に並びます。
                        </p>
                    </div>
                    <Link
                        href="/admin/dashboard"
                        onClick={(e) => { if (isDirty && !window.confirm(DISCARD_MESSAGE)) e.preventDefault() }}
                        className="text-sm font-medium text-teal-700 hover:text-teal-900 hover:underline"
                    >
                        管理ダッシュボードへ戻る
                    </Link>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                {error && (
                    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}

                <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    {/* ── 一覧 ── */}
                    <section className="rounded-xl bg-white border border-gray-100 overflow-hidden self-start">
                        <div className="px-5 py-4 border-b border-gray-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="font-semibold text-gray-900">投稿一覧</h2>
                                <button onClick={startNew} disabled={busy} className="text-sm font-medium bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition">
                                    ＋ 新しいお知らせ
                                </button>
                            </div>
                            <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 text-xs">
                                {(['ALL', 'PUBLISHED', 'DRAFT'] as ListFilter[]).map((f) => (
                                    <button key={f} type="button" onClick={() => setListFilter(f)}
                                        className={`flex-1 rounded-md px-2 py-1.5 font-semibold transition ${listFilter === f ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                        {f === 'ALL' ? 'すべて' : STATUS_LABEL[f]} ({counts[f]})
                                    </button>
                                ))}
                            </div>
                        </div>
                        {visiblePosts.length === 0 ? (
                            <p className="px-5 py-8 text-sm text-gray-500 text-center">
                                {posts.length === 0 ? 'まだ投稿がありません。「＋ 新しいお知らせ」から始めてください。' : 'この条件の投稿はありません。'}
                            </p>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {visiblePosts.map((post) => {
                                    const isSelected = post.id === selectedId
                                    return (
                                        <li key={post.id}>
                                            <button
                                                onClick={() => selectPost(post)}
                                                disabled={busy && !isSelected}
                                                className={`w-full text-left px-5 py-3 transition border-l-4 disabled:opacity-50 ${isSelected ? 'border-teal-500 bg-teal-50' : 'border-transparent hover:bg-gray-50'}`}
                                            >
                                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                                    <span className={`rounded-full px-2 py-0.5 font-bold ${post.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {STATUS_LABEL[post.status]}
                                                    </span>
                                                    {topIds.has(post.id) && <span className="rounded-full bg-teal-100 px-2 py-0.5 font-bold text-teal-700">トップに表示中</span>}
                                                    <span className="text-gray-500">{NEWS_CATEGORY_META[post.category]?.labelJa ?? post.category}</span>
                                                    <span className="text-gray-400 ml-auto tabular-nums">{toDateInput(post.published_at) || '日付なし'}</span>
                                                </div>
                                                <div className="mt-1 flex items-start gap-2">
                                                    <p className="flex-1 text-sm font-medium text-gray-900 line-clamp-2">{post.title}</p>
                                                    <span className={`shrink-0 text-xs font-semibold ${isSelected ? 'text-teal-700' : 'text-gray-400'}`}>{isSelected ? '編集中' : '編集 ›'}</span>
                                                </div>
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </section>

                    {/* ── 編集欄 ── */}
                    <section ref={editorRef} className="rounded-xl bg-white border border-gray-100 scroll-mt-4">
                        <div className="px-5 py-4 border-b border-gray-100 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <h2 className="font-semibold text-gray-900 line-clamp-2">
                                    {selectedId ? `編集中:「${savedForm.title || selected?.title || ''}」` : '新しいお知らせ'}
                                </h2>
                                {selected?.status === 'PUBLISHED' && (
                                    <a href={`/news/${selected.id}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-teal-700 hover:underline">
                                        公開ページを見る ↗
                                    </a>
                                )}
                            </div>
                            {/* 今の状態(サイトに出ているかどうか)を常に見せる */}
                            {savedStatus === 'PUBLISHED' ? (
                                <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                                    <span className="font-bold">● 公開中</span> — いまサイトに出ています({selected && topIds.has(selected.id) ? 'トップページと一覧に表示中' : '一覧(/news)に表示中。トップには出ていません'})
                                </div>
                            ) : savedStatus === 'DRAFT' ? (
                                <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-700">
                                    <span className="font-bold">○ 下書き</span> — この記事はサイトに出ていません
                                </div>
                            ) : (
                                <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-700">
                                    まだ保存していません。保存するまでサイトには出ません
                                </div>
                            )}
                            {isDirty && <p className="text-xs font-semibold text-amber-700">● 保存していない変更があります</p>}
                        </div>

                        <div className="p-5 space-y-5">
                            {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}

                            {/* 書く / 見え方 の切り替え */}
                            <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 text-sm">
                                {([['write', '書く'], ['preview', '見え方を確認']] as const).map(([key, label]) => (
                                    <button key={key} type="button" onClick={() => setTab(key)}
                                        className={`flex-1 rounded-md px-3 py-2 font-semibold transition ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {tab === 'preview' ? (
                                <div className="space-y-2">
                                    <p className="text-xs text-gray-500">公開したときの記事ページの見え方です(リンク先のカードだけは公開後に出ます)。</p>
                                    <ArticlePreview form={form} />
                                </div>
                            ) : (
                                <>
                                    {/* 種別 */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">種別</label>
                                        <div className="flex flex-wrap gap-2">
                                            {NEWS_CATEGORIES.map((category) => (
                                                <button
                                                    key={category}
                                                    type="button"
                                                    onClick={() => update('category', category)}
                                                    className={`rounded-full border px-3 py-1.5 text-sm transition ${form.category === category ? 'border-teal-500 bg-teal-50 text-teal-700 font-bold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                                >
                                                    {NEWS_CATEGORY_META[category].labelJa}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* AI 下書き(新しいお知らせでは開いた状態、編集中は閉じた状態から) */}
                                    <details open={aiOpen} onToggle={(e) => setAiOpen((e.currentTarget as HTMLDetailsElement).open)} className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
                                        <summary className="cursor-pointer text-sm font-bold text-teal-800">AIで下書きを作る(材料から)</summary>
                                        <div className="mt-3 space-y-3">
                                            <p className="text-xs text-teal-700/80">
                                                材料を貼って押すと、タイトルと本文の下書きが入ります。材料にない事実は書かれず、足りない所は [要確認] として残ります。
                                                個人名・連絡先は「掲載可」と書いた場合だけ使われます。
                                            </p>
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
                                                disabled={busy}
                                                className="rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 transition"
                                            >
                                                {generating ? '下書きを作成中…(20秒ほどかかります)' : '下書きを作る'}
                                            </button>
                                        </div>
                                    </details>

                                    {/* note 記事ワークフロー(インタビューのみ) */}
                                    {NOTE_ARTICLE_WORKFLOW_ENABLED && form.category === 'INTERVIEW' && (
                                        <NoteArticlePanel
                                            title={form.title}
                                            fields={{
                                                interview_source: form.interview_source,
                                                note_angle: form.note_angle,
                                                note_article: form.note_article,
                                                note_checklist: form.note_checklist,
                                            }}
                                            onChange={handleNoteFields}
                                            onDraftWritten={handleDraftWritten}
                                            authHeader={authHeader}
                                        />
                                    )}

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
                                            rows={14}
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-300"
                                        />
                                        <p className="mt-1 text-xs text-gray-400">書式は3つだけ: 空行で段落を分ける / 行頭「## 」で小見出し / https:// から始まるURLは自動でリンクになる。見た目は上の「見え方を確認」で確かめられます</p>
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
                                        <p className="mt-1 text-xs text-gray-400">入れると、記事ページの本文の下に「続きを読む(外部サイトが開きます)」ボタンが出ます。トップと一覧からは必ずサイト内の記事ページに入るので、本文に2〜3行の導入文を書いてください</p>
                                    </div>

                                    {/* 公開日 */}
                                    <div className="sm:max-w-xs">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">公開日 <span className="text-xs font-normal text-gray-400">(表示日・並び順)</span></label>
                                        <input
                                            type="date"
                                            value={form.published_at}
                                            onChange={(e) => update('published_at', e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                        />
                                        <p className="mt-1 text-xs text-gray-400">空のままなら、公開した日が入ります。未来の日付にしても予約公開にはなりません</p>
                                    </div>

                                    {isSupporterJoined && (
                                        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">参加団体の記事は、下書きとして保存し、本文を団体に送って OK をもらってから公開してください</p>
                                    )}
                                </>
                            )}

                            {hasPlaceholder && (
                                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                    「[要確認]」が残っています。AI が材料から分からなかった所なので、正しい内容に書き換えてください。残っている間は公開できません(下書きとしては保存できます)。
                                </div>
                            )}
                            {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
                        </div>

                        {/* 操作ボタン(状態ごとに押すものを決める。スマホでは画面下に固定) */}
                        <div className="sticky bottom-0 lg:static rounded-b-xl border-t border-gray-100 bg-white/95 backdrop-blur px-5 py-3 lg:py-4 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                {savedStatus === 'PUBLISHED' ? (
                                    <>
                                        <button type="button" onClick={handleApplyChanges} disabled={busy || hasPlaceholder}
                                            className="rounded-lg bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 transition">
                                            {saving ? '保存中…' : '変更をサイトに反映'}
                                        </button>
                                        <button type="button" onClick={handleUnpublish} disabled={busy}
                                            className="rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium px-4 py-2.5 transition">
                                            公開をやめる
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button type="button" onClick={handlePublish} disabled={busy || hasPlaceholder}
                                            className="rounded-lg bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 transition">
                                            {saving ? '保存中…' : '公開する'}
                                        </button>
                                        <button type="button" onClick={handleSaveDraft} disabled={busy}
                                            className="rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium px-4 py-2.5 transition">
                                            下書きとして保存
                                        </button>
                                    </>
                                )}
                                {selectedId && (
                                    <button type="button" onClick={handleDelete} disabled={busy}
                                        className="ml-auto rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm font-medium px-4 py-2.5 transition">
                                        {deleting ? '削除中…' : 'この記事を削除…'}
                                    </button>
                                )}
                            </div>
                            {/* 説明はスマホでは隠す(画面下に固定した操作欄が高くなりすぎないように) */}
                            <p className="hidden lg:block text-xs text-gray-400">
                                {savedStatus === 'PUBLISHED'
                                    ? '「変更をサイトに反映」はすぐに公開ページが書き換わります。サイトから下ろすだけなら「公開をやめる」(削除はしません)'
                                    : '「下書きとして保存」はサイトに出ません。「公開する」でトップページと一覧に出ます'}
                            </p>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    )
}
