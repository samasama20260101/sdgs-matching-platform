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
    NEWS_CATEGORIES, NEWS_CATEGORY_META, NEWS_TITLE_MAX, NEWS_BODY_MAX, NEWS_MATERIAL_MAX, NEWS_PAGE_TEXT_MAX, NEWS_SOURCE_URLS_MAX, NEWS_TOP_LIMIT, NOTE_ARTICLE_WORKFLOW_ENABLED,
    type NewsAngle, type NewsCategory, type NewsPostAdmin, type NewsPostListItem, type NewsStatus,
} from '@/lib/constants/news'
import { NoteArticlePanel, type NoteArticleFields } from '@/components/admin/NoteArticlePanel'
import { NewsBodyView } from '@/components/news/NewsBodyView'
import { LinkCardView } from '@/components/news/LinkCardView'
import type { LinkPreview } from '@/lib/news/linkPreview'
import { SupporterTileView } from '@/components/news/SupporterTileView'
import { supporterIdFromUrl, supporterPageUrl, type SupporterTileData } from '@/lib/news/supporterTile'
import { NewsCategoryChip } from '@/components/news/NewsCategoryChip'
import { formatNewsDate } from '@/lib/news/format'
import { hasUnresolvedPlaceholder, parseNewsBody } from '@/lib/news/bodyBlocks'

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
// notes = 手で書く材料 / urls = 読み取るページ(参加団体・インタビュー)/ pageText = ページから読み取った内容(確認・修正できる)
type Materials = { notes: string; urls: string[]; pageText: string }
type ListFilter = 'ALL' | NewsStatus

// 日本時間の YYYY-MM-DD(sv-SE ロケールは ISO 形式で日付を出す)
const JST_DATE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' })
const toDateInput = (iso: string | null) => (iso ? JST_DATE.format(new Date(iso)) : '')
const todayInput = () => JST_DATE.format(new Date())
const JST_TIME = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })
const emptyForm = (): FormState => ({
    category: 'NOTICE', title: '', body: '', external_url: '', published_at: '',
    interview_source: '', note_angle: null, note_article: '', note_checklist: '',
})
const emptyMaterials = (): Materials => ({ notes: '', urls: [''], pageText: '' })
// URL から下書きを作れる種別(材料がよそのページにあるもの)
const URL_SOURCE_CATEGORIES: NewsCategory[] = ['SUPPORTER_JOINED', 'INTERVIEW']
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

// 管理画面のプレビュー用のリンクカード。リンク先の情報が取れたら公開ページと同じカード、取得中・失敗は仮の枠
type PreviewMap = Record<string, LinkPreview | { tile: SupporterTileData } | 'loading' | 'error'>
function PreviewLinkCard({ url, previews }: { url: string; previews: PreviewMap }) {
    const state = previews[url]
    if (state && state !== 'loading' && state !== 'error') {
        return 'tile' in state ? <SupporterTileView data={state.tile} /> : <LinkCardView preview={state} />
    }
    return (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500">{state === 'error' ? (supporterIdFromUrl(url) ? 'サイト内の団体が見つかりませんでした(公開ページでは何も出ません)' : 'リンク先のカードを取得できませんでした(公開ページではドメインだけのカードになります)') : 'リンク先のカードを読み込んでいます…'}</p>
            <p className="mt-1 text-sm font-medium text-gray-700 break-all">{hostnameOf(url)}</p>
        </div>
    )
}

// 見え方の確認でカードにする URL(本文で 1 行だけの URL と、外部リンク)
const URL_ONLY = /^https?:\/\/\S+$/
function previewUrlsOf(form: FormState) {
    const urls = parseNewsBody(form.body)
        .filter((b) => b.kind === 'paragraph' && b.lines.length === 1 && URL_ONLY.test(b.lines[0]))
        .map((b) => (b.kind === 'paragraph' ? b.lines[0].replace(/[.,;:!?)\]'"]+$/, '') : ''))
    if (form.external_url.trim()) urls.push(form.external_url.trim())
    return [...new Set(urls)]
}

// 記事ページと同じ見た目(タイトル・日付・種別・本文・外部リンク)
function ArticlePreview({ form, previews }: { form: FormState; previews: PreviewMap }) {
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
                ? <NewsBodyView body={form.body} renderLinkCard={(url, key) => <PreviewLinkCard key={key} url={url} previews={previews} />} />
                : <p className="text-sm text-gray-400">(本文なし)</p>}
            {form.external_url.trim() && (
                <div className="mt-10 space-y-4">
                    <PreviewLinkCard url={form.external_url.trim()} previews={previews} />
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
    const [posts, setPosts] = useState<NewsPostListItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    // 操作の結果(操作欄のボタンのすぐ上に出す。成功は次に編集を始めるまで残す)
    const [notice, setNotice] = useState<string | null>(null)
    const [noticeLink, setNoticeLink] = useState<string | null>(null)
    // AI 下書きの結果(AI の欄の中に出す)
    const [aiMessage, setAiMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
    // 削除の知らせ(編集欄ごと消えることがあるので、画面の下にしばらく出す)
    const [toast, setToast] = useState<string | null>(null)
    // 保存した記事の行を一覧でしばらく光らせる
    const [flashId, setFlashId] = useState<string | null>(null)
    const [listFilter, setListFilter] = useState<ListFilter>('ALL')
    // 一覧の検索(タイトル)と種別の絞り込み
    const [listQuery, setListQuery] = useState('')
    const [listCategory, setListCategory] = useState<NewsCategory | 'ALL'>('ALL')
    // 編集を開くときに本文を読み込んでいる記事
    const [openingId, setOpeningId] = useState<string | null>(null)

    const [selectedId, setSelectedId] = useState<string | null>(null)
    // 編集欄の状態: none = 何も開いていない / new = 新しいお知らせ / edit = 既存の記事
    const [mode, setMode] = useState<'none' | 'new' | 'edit'>('none')
    const [form, setForm] = useState<FormState>(emptyForm)
    const [savedForm, setSavedForm] = useState<FormState>(emptyForm)
    const [materials, setMaterials] = useState<Materials>(emptyMaterials)
    const [tab, setTab] = useState<'write' | 'preview'>('write')
    const [aiOpen, setAiOpen] = useState(true)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [generating, setGenerating] = useState(false)
    // AI 下書きの進み具合(URL からのときは「読み取り中」→「下書き中」)
    const [genPhase, setGenPhase] = useState<'reading' | 'writing' | null>(null)
    const [formError, setFormError] = useState<string | null>(null)
    // 押したボタン(「…しています」をそのボタンにだけ出す)
    const [savingAction, setSavingAction] = useState<'draft' | 'publish' | 'apply' | 'unpublish' | null>(null)
    const editorRef = useRef<HTMLElement>(null)
    // 見え方の確認で出すリンクカードの情報(URL ごとに 1 回だけ取る)
    const [previews, setPreviews] = useState<PreviewMap>({})
    // 「サイト内の団体」の選択肢(登録済みで公開中の団体)
    const [supporterOptions, setSupporterOptions] = useState<{ id: string; name: string }[] | null>(null)

    const selected = posts.find((p) => p.id === selectedId) ?? null
    const savedStatus: NewsStatus | null = selected?.status ?? null // null = まだ保存していない新しいお知らせ
    const busy = saving || deleting || generating || openingId !== null
    // 未保存の変更: 新しいお知らせは「何か書いたか」で判断する(種別を選んだだけでは変更扱いにしない)
    const hasMaterials = Boolean(materials.notes.trim() || materials.pageText.trim() || materials.urls.some((u) => u.trim()))
    const isDirty = mode === 'new'
        ? Boolean(form.title.trim() || form.body.trim() || form.external_url.trim() || form.published_at || hasMaterials)
        : !sameForm(form, savedForm) || hasMaterials

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
            const list = (result.posts ?? []) as NewsPostListItem[]
            setPosts(list)
            return list
        } catch (err) {
            setError(err instanceof Error ? err.message : 'お知らせの取得に失敗しました')
        } finally {
            setLoading(false)
        }
        return null
    }, [authHeader, router])

    useEffect(() => { loadPosts() }, [loadPosts])

    useEffect(() => {
        if (tab !== 'preview') return
        const missing = previewUrlsOf(form).filter((url) => !(url in previews))
        if (missing.length === 0) return
        setPreviews((prev) => ({ ...prev, ...Object.fromEntries(missing.map((url) => [url, 'loading' as const])) }))
        ;(async () => {
            const headers = await authHeader()
            if (!headers) return
            await Promise.all(missing.map(async (url) => {
                try {
                    const supporterId = supporterIdFromUrl(url)
                    if (supporterId) {
                        const res = await fetch(`/api/public/supporters/${supporterId}`, { cache: 'no-store' })
                        const result = await res.json()
                        if (!res.ok) { setPreviews((prev) => ({ ...prev, [url]: 'error' })); return }
                        const sp = result.supporter
                        const tile: SupporterTileData = {
                            id: sp.id, name: sp.organization_name ?? sp.display_name, supporterType: sp.supporter_type, createdAt: sp.created_at, bio: sp.bio,
                            resolvedCount: sp.resolved_count ?? 0,
                            badgeCount: Object.values((result.badges ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0),
                            nationwide: Boolean(sp.service_area_nationwide),
                            areaNames: ((sp.service_areas ?? []) as { name_local: string }[]).map((a) => a.name_local),
                        }
                        setPreviews((prev) => ({ ...prev, [url]: { tile } }))
                        return
                    }
                    const res = await fetch('/api/admin/news/link-preview', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
                    const result = await res.json()
                    setPreviews((prev) => ({ ...prev, [url]: res.ok ? result.preview as LinkPreview : 'error' }))
                } catch {
                    setPreviews((prev) => ({ ...prev, [url]: 'error' }))
                }
            }))
        })()
    }, [tab, form, previews, authHeader])

    useEffect(() => {
        if (form.category !== 'SUPPORTER_JOINED' || supporterOptions !== null) return
        fetch('/api/public/supporters', { cache: 'no-store' })
            .then((res) => res.json())
            .then((d) => setSupporterOptions(((d.supporters ?? []) as { id: string; organization_name?: string; display_name?: string }[])
                .map((sp) => ({ id: sp.id, name: sp.organization_name ?? sp.display_name ?? '' }))
                .sort((a, b) => a.name.localeCompare(b.name, 'ja'))))
            .catch(() => setSupporterOptions([]))
    }, [form.category, supporterOptions])

    // 保存のあとに編集を始めたら、前の結果(「公開しました」など)は消す
    useEffect(() => {
        if (isDirty) { setNotice(null); setNoticeLink(null) }
    }, [isDirty])

    useEffect(() => {
        if (!toast) return
        const timer = setTimeout(() => setToast(null), 6000)
        return () => clearTimeout(timer)
    }, [toast])

    useEffect(() => {
        if (!flashId) return
        const timer = setTimeout(() => setFlashId(null), 2000)
        return () => clearTimeout(timer)
    }, [flashId])

    // 未保存の変更があるまま、タブを閉じる・再読み込みするときに止める
    useEffect(() => {
        if (!isDirty) return
        const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }
        window.addEventListener('beforeunload', onBeforeUnload)
        return () => window.removeEventListener('beforeunload', onBeforeUnload)
    }, [isDirty])

    const scrollToEditor = () => {
        // 編集欄は開いたあとに描画されるので、描画を待ってから移動する
        if (typeof window !== 'undefined' && window.innerWidth < 1024) setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }

    const resetEditor = (nextMode: 'none' | 'new') => {
        setMode(nextMode)
        setSelectedId(null)
        setForm(emptyForm())
        setSavedForm(emptyForm())
        setMaterials(emptyMaterials())
        setTab('write')
        setAiOpen(true)
        setFormError(null)
    }

    // 編集をやめて、何も開いていない状態に戻る
    const closeEditor = () => {
        if (busy) return
        if (isDirty && !window.confirm('保存していない変更があります。破棄して閉じますか?')) return
        resetEditor('none')
        setNotice(null)
        setNoticeLink(null)
        setAiMessage(null)
    }

    // 保存した時点の内容に戻す(編集は続ける)
    const revertChanges = () => {
        if (!window.confirm('保存していない変更を取り消して、保存した時点の内容に戻します。よろしいですか?')) return
        setForm(savedForm)
        setMaterials(emptyMaterials())
        setFormError(null)
        setNotice('変更を取り消しました')
    }

    const startNew = () => {
        if (busy) return
        if (isDirty && !window.confirm(DISCARD_MESSAGE)) return
        setMode('new')
        setSelectedId(null)
        setForm(emptyForm())
        setSavedForm(emptyForm())
        setMaterials(emptyMaterials())
        setTab('write')
        setAiOpen(true)
        setFormError(null)
        setNotice(null)
        setNoticeLink(null)
        setAiMessage(null)
        scrollToEditor()
    }

    // 編集を開く。一覧には本文が入っていないので、ここで 1 件だけ読む
    const selectPost = async (post: NewsPostListItem) => {
        if (busy || post.id === selectedId) { scrollToEditor(); return }
        if (isDirty && !window.confirm(DISCARD_MESSAGE)) return
        setOpeningId(post.id)
        try {
            const headers = await authHeader()
            if (!headers) return
            const res = await fetch(`/api/admin/news/${post.id}`, { headers, cache: 'no-store' })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'お知らせを開けませんでした')
            const next = formFromPost(result.post as NewsPostAdmin)
            setMode('edit')
            setSelectedId(post.id)
            setForm(next)
            setSavedForm(next)
            setMaterials(emptyMaterials())
            setTab('write')
            setAiOpen(false)
            setFormError(null)
            setNotice(null)
            setNoticeLink(null)
            setAiMessage(null)
            scrollToEditor()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'お知らせを開けませんでした')
            await loadPosts()
        } finally {
            setOpeningId(null)
        }
    }

    const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }))

    // 本文の最後に置く「サイト内の団体ページ」の行(表示のときに団体タイルになる)
    const linkedSupporterId = form.body.split('\n').map((line) => supporterIdFromUrl(line.trim())).find(Boolean) ?? ''
    const setLinkedSupporter = (id: string) => setForm((prev) => {
        const kept = prev.body.split('\n').filter((line) => !supporterIdFromUrl(line.trim())).join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
        return { ...prev, body: id ? `${kept}${kept ? '\n\n' : ''}${supporterPageUrl(id)}` : kept }
    })

    // AI に下書きを書かせる(材料: 手で書いたメモ + ページから読み取った内容)
    const requestDraft = async (headers: Record<string, string>, notes: string, pageText: string) => {
        setGenPhase('writing')
        const res = await fetch('/api/admin/news/draft', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: form.category, materials: { notes, pageText } }),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || '下書きを作れませんでした')
        setForm((prev) => ({ ...prev, title: result.draft.title, body: result.draft.body }))
    }

    const confirmOverwrite = () => !(form.title.trim() || form.body.trim()) || window.confirm('タイトルか本文が入力済みです。AIの下書きで上書きしますか?')

    // 材料(メモと、読み取り済みの内容)から下書きを作る
    const handleGenerate = async () => {
        setFormError(null)
        setAiMessage(null)
        if (!materials.notes.trim() && !materials.pageText.trim()) {
            setAiMessage({ kind: 'error', text: '材料を入力してください' })
            return
        }
        if (!confirmOverwrite()) return
        setGenerating(true)
        try {
            const headers = await authHeader()
            if (!headers) return
            await requestDraft(headers, materials.notes, materials.pageText)
            setAiMessage({ kind: 'ok', text: 'AIの下書きを入れました。内容を確かめて直してください([要確認]の所は必ず書き換える)。まだ保存していません' })
        } catch (err) {
            setAiMessage({ kind: 'error', text: err instanceof Error ? err.message : '下書きを作れませんでした' })
        } finally {
            setGenerating(false)
            setGenPhase(null)
        }
    }

    // URL のページを読み取ってから、そのまま下書きまで作る(参加団体・インタビュー)
    const handleGenerateFromUrls = async () => {
        setFormError(null)
        setAiMessage(null)
        const urls = materials.urls.map((u) => u.trim()).filter(Boolean)
        if (urls.length === 0) {
            setAiMessage({ kind: 'error', text: 'URL を入力してください' })
            return
        }
        if (!confirmOverwrite()) return
        setGenerating(true)
        setGenPhase('reading')
        try {
            const headers = await authHeader()
            if (!headers) return
            const res = await fetch('/api/admin/news/fetch-page', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls }),
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'ページを読み取れませんでした')
            const pages = result.pages as ({ ok: true; url: string; title: string; text: string } | { ok: false; url: string; reason: string })[]
            const okPages = pages.filter((p): p is { ok: true; url: string; title: string; text: string } => p.ok)
            const failed = pages.filter((p): p is { ok: false; url: string; reason: string } => !p.ok)
            if (okPages.length === 0) {
                setAiMessage({ kind: 'error', text: `ページを読み取れませんでした(${failed.map((f) => f.reason).join(' / ')})。ページの本文をコピーして、下の「材料」の欄に貼ってください` })
                return
            }
            const pageText = okPages.map((p) => `【ページ: ${p.title || p.url}】${p.url}\n${p.text}`).join('\n\n').slice(0, NEWS_PAGE_TEXT_MAX)
            setMaterials((m) => ({ ...m, pageText }))
            await requestDraft(headers, materials.notes, pageText)
            // 読み取ったページ(1 つ目)を記事の外部リンクにする(空のときだけ。記事の下にカードとボタンが出る)
            const firstUrl = urls[pages.findIndex((p) => p.ok)]
            const linked = !form.external_url.trim() && Boolean(firstUrl)
            if (linked) setForm((prev) => ({ ...prev, external_url: firstUrl }))
            const note = failed.length > 0 ? `(読み取れなかったページ: ${failed.map((f) => f.url).join('、')})` : ''
            setAiMessage({ kind: 'ok', text: `ページを読み取って下書きを入れました${note}。${linked ? '読み取ったページを外部リンクに入れました。' : ''}AIが読んだ内容は「AI が読んだ内容を確かめる」を開くと見られます。内容を確かめて直してください([要確認]の所は必ず書き換える)。まだ保存していません` })
        } catch (err) {
            setAiMessage({ kind: 'error', text: err instanceof Error ? err.message : '下書きを作れませんでした' })
        } finally {
            setGenerating(false)
            setGenPhase(null)
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
        setAiMessage({ kind: 'ok', text: 'note 記事の本文を入れました。投稿のタイトルと導入文が空だった場合はあわせて入れています。最後に保存してください' })
    }

    // 保存の本体。押したボタン(action)で、送る状態と結果の文言が決まる
    type SaveAction = 'draft' | 'publish' | 'apply' | 'unpublish'
    const save = async (action: SaveAction, publishedAtOverride?: string) => {
        setFormError(null)
        setNotice(null)
        setNoticeLink(null)
        if (!form.title.trim()) { setFormError('タイトルを入力してください'); return }
        if (!form.body.trim() && !form.external_url.trim()) { setFormError('本文か外部リンクのどちらかは必要です'); return }
        const status: NewsStatus = action === 'publish' || action === 'apply' ? 'PUBLISHED' : 'DRAFT'
        const requestId = selectedId
        const sentForm = publishedAtOverride !== undefined ? { ...form, published_at: publishedAtOverride } : form
        setSaving(true)
        setSavingAction(action)
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
            if (!res.ok) throw new Error(result.error || '保存できませんでした')
            const saved = result.post as NewsPostAdmin
            const next = { ...sentForm, published_at: toDateInput(saved.published_at) }
            setMode('edit')
            setSelectedId(saved.id)
            setForm(next)
            setSavedForm(next)
            setMaterials(emptyMaterials())
            const list = await loadPosts()
            const onTop = (list ?? []).filter((p) => p.status === 'PUBLISHED').slice(0, NEWS_TOP_LIMIT).some((p) => p.id === saved.id)
            const where = onTop ? 'トップページとお知らせ一覧ページに出ています' : 'お知らせ一覧ページに出ています(トップには、より新しい記事が出ています)'
            const time = JST_TIME.format(new Date())
            const message: Record<SaveAction, string> = {
                draft: `✓ ${time} 下書き保存しました。サイトにはまだ出ていません`,
                publish: `✓ ${time} 公開しました。いま${where}`,
                apply: `✓ ${time} サイトの記事を更新しました。${where}`,
                unpublish: `✓ ${time} サイトから下げました。記事は下書きとして残っています`,
            }
            setNotice(message[action])
            setNoticeLink(status === 'PUBLISHED' ? `/news/${saved.id}` : null)
            setFlashId(saved.id)
        } catch (err) {
            const message = err instanceof Error ? err.message : '保存できませんでした'
            // 新規作成で通信が途中で切れた場合、サーバー側では作られていることがある。一覧を読み直して二重登録を防ぐ
            if (!requestId) {
                await loadPosts()
                setFormError(`保存できませんでした(${message})。一覧に同じ記事ができていないか確かめてから、もう一度押してください`)
            } else {
                setFormError(`保存できませんでした。サイトの状態は変わっていません(${message})`)
            }
        } finally {
            setSaving(false)
            setSavingAction(null)
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
            return window.confirm(`公開日が未来(${date})です。予約公開ではなく、今すぐサイトに出ます。いいですか?`) ? undefined : null
        }
        return undefined
    }

    const handleSaveDraft = () => save('draft')

    const handlePublish = () => {
        if (!window.confirm('この記事をサイトに公開します。トップページとお知らせ一覧ページにすぐ出ます。いいですか?')) return
        const date = confirmPublishDate()
        if (date === null) return
        save('publish', date)
    }

    const handleApplyChanges = () => {
        if (!window.confirm('サイトの記事を、この内容に変えます。いいですか?')) return
        save('apply')
    }

    const handleUnpublish = () => {
        if (!window.confirm('この記事をサイトから下げます。記事は下書きとして残ります。いいですか?')) return
        save('unpublish')
    }

    // 削除(一覧の「削除」と編集欄の「この記事を削除…」の両方から使う)
    const deletePost = async (post: NewsPostListItem) => {
        if (busy) return
        const message = post.status === 'PUBLISHED'
            ? `「${post.title}」を削除します。元に戻せません。\nサイトから下げるだけなら、削除せずに「サイトから下げる」を使ってください。\n削除していいですか?`
            : `「${post.title}」を削除します。元に戻せません。いいですか?`
        if (!window.confirm(message)) return
        setDeleting(true)
        setFormError(null)
        try {
            const headers = await authHeader()
            if (!headers) return
            const res = await fetch(`/api/admin/news/${post.id}`, { method: 'DELETE', headers })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || '削除に失敗しました')
            // 開いていた記事を消したときだけ編集欄を閉じる(別の記事を編集中なら、その内容はそのまま)
            if (post.id === selectedId) resetEditor('none')
            setToast(`「${post.title}」を削除しました`)
            await loadPosts()
        } catch (err) {
            const message = err instanceof Error ? err.message : '削除に失敗しました'
            if (post.id === selectedId) setFormError(message)
            else setError(message)
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
    const query = listQuery.trim().toLowerCase()
    const visiblePosts = posts.filter((p) =>
        (listFilter === 'ALL' || p.status === listFilter)
        && (listCategory === 'ALL' || p.category === listCategory)
        && (!query || p.title.toLowerCase().includes(query)))
    // 下書きを先頭にまとめ、公開中は公開日の年ごとに区切る(一覧 API は公開日の新しい順)
    const listGroups: { label: string; items: NewsPostListItem[] }[] = []
    for (const p of visiblePosts) {
        const label = p.status === 'DRAFT' ? '下書き' : `${toDateInput(p.published_at).slice(0, 4) || '日付なし'}年`
        const group = listGroups.find((g) => g.label === label)
        if (group) group.items.push(p)
        else listGroups.push({ label, items: [p] })
    }
    listGroups.sort((a, b) => (a.label === '下書き' ? -1 : b.label === '下書き' ? 1 : b.label.localeCompare(a.label)))
    const counts = { ALL: posts.length, PUBLISHED: posts.filter((p) => p.status === 'PUBLISHED').length, DRAFT: posts.filter((p) => p.status === 'DRAFT').length }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs text-gray-500">管理者メニュー</p>
                        <h1 className="text-2xl font-bold text-gray-900">お知らせ管理</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            トップページの「お知らせ」欄に出す記事を作成・公開します。公開中の新しい{NEWS_TOP_LIMIT}件がトップに、全件がお知らせ一覧ページに並びます。
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
                            <div className="flex gap-2">
                                <input
                                    type="search"
                                    value={listQuery}
                                    onChange={(e) => setListQuery(e.target.value)}
                                    placeholder="タイトルで探す"
                                    aria-label="タイトルで探す"
                                    className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                />
                                <select
                                    value={listCategory}
                                    onChange={(e) => setListCategory(e.target.value as NewsCategory | 'ALL')}
                                    aria-label="種別で絞り込む"
                                    className="shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                >
                                    <option value="ALL">すべての種別</option>
                                    {NEWS_CATEGORIES.map((c) => <option key={c} value={c}>{NEWS_CATEGORY_META[c].labelJa}</option>)}
                                </select>
                            </div>
                            {(query || listCategory !== 'ALL') && (
                                <p className="text-xs text-gray-500">{visiblePosts.length}件見つかりました <button type="button" onClick={() => { setListQuery(''); setListCategory('ALL') }} className="ml-1 text-teal-700 underline">条件を外す</button></p>
                            )}
                        </div>
                        {visiblePosts.length === 0 ? (
                            <p className="px-5 py-8 text-sm text-gray-500 text-center">
                                {posts.length === 0 ? 'まだ投稿がありません。「＋ 新しいお知らせ」から始めてください。' : 'この条件の投稿はありません。'}
                            </p>
                        ) : (
                            <div className="lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto">
                            {listGroups.map((group) => (
                            <div key={group.label}>
                            <p className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50/95 px-5 py-1.5 text-xs font-bold text-gray-500 backdrop-blur">{group.label}({group.items.length})</p>
                            <ul className="divide-y divide-gray-100">
                                {group.items.map((post) => {
                                    const isSelected = post.id === selectedId
                                    return (
                                        <li key={post.id} className={`flex items-stretch border-l-4 transition-colors duration-700 ${flashId === post.id ? 'bg-green-100' : isSelected ? 'bg-teal-50' : 'hover:bg-gray-50'} ${isSelected ? 'border-teal-500' : 'border-transparent'}`}>
                                            <button
                                                onClick={() => selectPost(post)}
                                                disabled={busy && !isSelected}
                                                className="min-w-0 flex-1 text-left pl-4 pr-2 py-3 disabled:opacity-50"
                                            >
                                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                                    <span className={`rounded-full px-2 py-0.5 font-bold ${post.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {STATUS_LABEL[post.status]}
                                                    </span>
                                                    {topIds.has(post.id) && <span className="rounded-full bg-teal-100 px-2 py-0.5 font-bold text-teal-700">トップに表示中</span>}
                                                    <span className="text-gray-500">{NEWS_CATEGORY_META[post.category]?.labelJa ?? post.category}</span>
                                                    <span className="text-gray-400 tabular-nums">{toDateInput(post.published_at) || '日付なし'}</span>
                                                </div>
                                                <p className="mt-1 text-sm font-medium text-gray-900 line-clamp-2">{post.title}</p>
                                            </button>
                                            <div className="flex shrink-0 flex-col justify-center gap-1.5 pr-3 py-2">
                                                {isSelected ? (
                                                    <span className="rounded-md px-2.5 py-1 text-center text-xs font-bold text-teal-700">編集中</span>
                                                ) : (
                                                    <button type="button" onClick={() => selectPost(post)} disabled={busy}
                                                        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                                                        {openingId === post.id ? '開いています…' : '編集'}
                                                    </button>
                                                )}
                                                <button type="button" onClick={() => deletePost(post)} disabled={busy}
                                                    className="rounded-md border border-red-100 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                                                    削除
                                                </button>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                            </div>
                            ))}
                            </div>
                        )}
                    </section>

                    {/* ── 編集欄 ── */}
                    {mode === 'none' ? (
                        <section className="rounded-xl bg-white border border-dashed border-gray-200 self-start px-6 py-10 text-center">
                            <p className="text-sm text-gray-600">一覧から記事の「編集」を押すか、「＋ 新しいお知らせ」を押してください。</p>
                            <button onClick={startNew} disabled={busy} className="mt-4 text-sm font-medium bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition">
                                ＋ 新しいお知らせ
                            </button>
                        </section>
                    ) : (
                    <section ref={editorRef} className="rounded-xl bg-white border border-gray-100 scroll-mt-4">
                        <div className="px-5 py-4 border-b border-gray-100 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <h2 className="font-semibold text-gray-900 line-clamp-2">
                                    {selectedId ? `編集中:「${savedForm.title || selected?.title || ''}」` : '新しいお知らせ'}
                                </h2>
                                <div className="flex shrink-0 items-center gap-3">
                                    {selected?.status === 'PUBLISHED' && (
                                        <a href={`/news/${selected.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-700 hover:underline">
                                            公開ページを見る ↗
                                        </a>
                                    )}
                                    <button type="button" onClick={closeEditor} disabled={busy}
                                        className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                                        ✕ 閉じる
                                    </button>
                                </div>
                            </div>
                            {/* 今の状態(サイトに出ているかどうか)を常に見せる */}
                            {savedStatus === 'PUBLISHED' ? (
                                <div className="rounded-lg bg-green-50 border border-green-300 px-3 py-2 text-sm text-green-900">
                                    <span className="font-bold">● サイトに公開中</span> — {selected && topIds.has(selected.id) ? 'トップページとお知らせ一覧ページに出ています' : 'お知らせ一覧ページに出ています(トップには出ていません)'}
                                </div>
                            ) : savedStatus === 'DRAFT' ? (
                                <div className="rounded-lg bg-gray-100 border border-gray-300 px-3 py-2 text-sm text-gray-800">
                                    <span className="font-bold">○ 下書き</span> — まだサイトに出ていません
                                </div>
                            ) : (
                                <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-700">
                                    まだ保存していません。保存するまでサイトには出ません
                                </div>
                            )}
                            {isDirty && <p className="text-xs font-semibold text-amber-700">● 保存していない変更があります</p>}
                        </div>

                        <div className="p-5 space-y-5">

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
                                    <p className="text-xs text-gray-500">公開したときの記事ページの見え方です。</p>
                                    <ArticlePreview form={form} previews={previews} />
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
                                            {URL_SOURCE_CATEGORIES.includes(form.category) && (
                                                <div className="space-y-2 rounded-lg border border-teal-200 bg-white p-3">
                                                    <p className="text-sm font-semibold text-teal-900">
                                                        {form.category === 'INTERVIEW' ? 'note の記事の URL' : '団体のサイトの URL'}
                                                        <span className="ml-1 text-xs font-normal text-teal-700/80">(最大{NEWS_SOURCE_URLS_MAX}つ。ページを読み取って要約します)</span>
                                                    </p>
                                                    {materials.urls.map((url, index) => (
                                                        <div key={index} className="flex items-center gap-2">
                                                            <input
                                                                type="url"
                                                                value={url}
                                                                onChange={(e) => setMaterials((m) => ({ ...m, urls: m.urls.map((u, k) => (k === index ? e.target.value : u)) }))}
                                                                placeholder={form.category === 'INTERVIEW' ? 'https://note.com/...' : 'https://(団体の「私たちについて」「活動内容」などのページ)'}
                                                                aria-label={`URL ${index + 1}`}
                                                                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                                            />
                                                            {/* 欄が 1 つなら中身を消す、2 つ以上なら欄ごと消す */}
                                                            {(materials.urls.length > 1 || url) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setMaterials((m) => ({ ...m, urls: m.urls.length > 1 ? m.urls.filter((_, k) => k !== index) : [''] }))}
                                                                    disabled={busy}
                                                                    aria-label={`URL ${index + 1} を消す`}
                                                                    className="shrink-0 rounded-md border border-gray-200 px-2.5 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50"
                                                                >
                                                                    ✕
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={handleGenerateFromUrls}
                                                            disabled={busy}
                                                            className="rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-bold px-4 py-2 transition"
                                                        >
                                                            {genPhase === 'reading' ? 'ページを読み取っています…' : genPhase === 'writing' && materials.urls.some((u) => u.trim()) ? '下書きを作っています…(20秒ほど)' : 'URL から下書きを作る'}
                                                        </button>
                                                        {materials.urls.length < NEWS_SOURCE_URLS_MAX && (
                                                            <button type="button" onClick={() => setMaterials((m) => ({ ...m, urls: [...m.urls, ''] }))} disabled={busy}
                                                                className="text-xs font-semibold text-teal-700 hover:underline disabled:opacity-50">
                                                                ＋ URL を追加
                                                            </button>
                                                        )}
                                                    </div>
                                                    {materials.pageText && (
                                                        <details className="rounded-lg bg-gray-50 px-3 py-2">
                                                            <summary className="cursor-pointer text-xs font-semibold text-gray-600">AI が読んだ内容を確かめる({materials.pageText.length}文字。直してから「材料から下書きを作る」で作り直せます)</summary>
                                                            <textarea
                                                                value={materials.pageText}
                                                                onChange={(e) => setMaterials((m) => ({ ...m, pageText: e.target.value }))}
                                                                maxLength={NEWS_PAGE_TEXT_MAX}
                                                                rows={8}
                                                                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-300"
                                                            />
                                                        </details>
                                                    )}
                                                </div>
                                            )}
                                            {URL_SOURCE_CATEGORIES.includes(form.category) && (
                                                <p className="text-xs font-semibold text-teal-900">材料(追加のメモ。電話で聞いたことなど。URL がないときはここにページの文章を貼る)</p>
                                            )}
                                            <textarea
                                                value={materials.notes}
                                                onChange={(e) => setMaterials((m) => ({ ...m, notes: e.target.value }))}
                                                maxLength={NEWS_MATERIAL_MAX}
                                                rows={isSupporterJoined ? 6 : 5}
                                                placeholder={
                                                    form.category === 'MAINTENANCE'
                                                        ? '例: 10月5日(日) 午前2時〜4時 サーバーメンテナンス。ログインと相談の投稿ができない'
                                                        : form.category === 'INTERVIEW'
                                                            ? '例: 誰に何を聞いたか、印象に残った一言(URL を入れたなら空でもよい)'
                                                            : isSupporterJoined
                                                                ? '例:\n【電話で聞いたこと】・担当は○○さん(掲載可) ・活動地域は熊本市\n書かないでと言われた話には「非公開」と付ける'
                                                                : '伝えたいことの箇条書き(何が・いつから・変わらないこと・変わること)'
                                                }
                                                className="w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleGenerate}
                                                disabled={busy}
                                                className="rounded-lg border border-teal-300 bg-white hover:bg-teal-50 disabled:opacity-60 text-teal-800 text-sm font-medium px-4 py-2 transition"
                                            >
                                                {genPhase === 'writing' && !materials.urls.some((u) => u.trim()) ? '下書きを作っています…(20秒ほど)' : '材料から下書きを作る'}
                                            </button>
                                            {aiMessage && (
                                                <p role={aiMessage.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${aiMessage.kind === 'error' ? 'text-red-700' : 'text-teal-800'}`}>
                                                    {aiMessage.kind === 'error' ? '✕ ' : '✓ '}{aiMessage.text}
                                                </p>
                                            )}
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

                                    {/* サイト内の団体(参加団体のみ) */}
                                    {isSupporterJoined && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">サイト内の団体 <span className="text-xs font-normal text-gray-400">(選ぶと、本文の下に団体のタイルと「この団体のページを見る」ボタンが出ます)</span></label>
                                            <select
                                                value={linkedSupporterId}
                                                onChange={(e) => setLinkedSupporter(e.target.value)}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                            >
                                                <option value="">{supporterOptions === null ? '読み込んでいます…' : '選ばない'}</option>
                                                {(supporterOptions ?? []).map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                                                {linkedSupporterId && supporterOptions && !supporterOptions.some((sp) => sp.id === linkedSupporterId) && (
                                                    <option value={linkedSupporterId}>(公開されていない団体)</option>
                                                )}
                                            </select>
                                            <p className="mt-1 text-xs text-gray-400">本文の最後に団体ページのアドレスが 1 行入ります(消すと外れます)。団体サイトのカードは、下の外部リンクで出ます</p>
                                        </div>
                                    )}

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
                                        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">参加団体の記事は、下書き保存して、本文を団体に送って OK をもらってから公開してください</p>
                                    )}
                                </>
                            )}

                            {hasPlaceholder && (
                                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                    「[要確認]」が残っています。AI が材料から分からなかった所なので、正しい内容に書き換えてください。残っている間は公開できません(下書きとしては保存できます)。
                                </div>
                            )}
                        </div>

                        {/* 操作欄(状態ごとに押すものを決める。スマホでは画面下に固定)。結果はボタンのすぐ上に出す */}
                        <div className="sticky bottom-0 lg:static rounded-b-xl border-t border-gray-100 bg-white/95 backdrop-blur px-5 py-3 lg:py-4 space-y-2.5">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                <span className={`font-bold ${savedStatus === 'PUBLISHED' ? 'text-green-800' : 'text-gray-700'}`}>
                                    状態：{savedStatus === 'PUBLISHED' ? '● サイトに公開中' : savedStatus === 'DRAFT' ? '○ 下書き(サイトに出ていません)' : 'まだ保存していません'}
                                </span>
                                {isDirty && <span className="font-semibold text-amber-700">● 保存していない変更があります</span>}
                            </div>
                            {/* 結果の行(読み上げにも伝わるよう、要素は常に置いて中身だけ変える) */}
                            <div role="status" aria-live="polite" className="empty:hidden">
                                {notice && (
                                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm font-semibold text-green-800">
                                        <span>{notice}</span>
                                        {noticeLink && (
                                            <a href={noticeLink} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-teal-700 underline underline-offset-2 hover:text-teal-900">
                                                サイトで見る ↗
                                            </a>
                                        )}
                                    </p>
                                )}
                            </div>
                            {formError && (
                                <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">✕ {formError}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                                {savedStatus === 'PUBLISHED' ? (
                                    <>
                                        <button type="button" onClick={handleApplyChanges} disabled={busy || hasPlaceholder || !isDirty} aria-busy={savingAction === 'apply'}
                                            className={`rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold px-5 py-2.5 transition disabled:cursor-not-allowed ${savingAction === 'apply' ? '' : 'disabled:opacity-40'}`}>
                                            {savingAction === 'apply' ? 'サイトを更新しています…' : isDirty ? '直した内容でサイトを更新' : '変更はありません'}
                                        </button>
                                        <button type="button" onClick={handleUnpublish} disabled={busy} aria-busy={savingAction === 'unpublish'}
                                            className={`rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2.5 transition ${savingAction === 'unpublish' ? '' : 'disabled:opacity-40'}`}>
                                            {savingAction === 'unpublish' ? 'サイトから下げています…' : 'サイトから下げる(記事は残ります)'}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button type="button" onClick={handlePublish} disabled={busy || hasPlaceholder} aria-busy={savingAction === 'publish'}
                                            className={`rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold px-5 py-2.5 transition disabled:cursor-not-allowed ${savingAction === 'publish' ? '' : 'disabled:opacity-40'}`}>
                                            {savingAction === 'publish' ? '公開しています…' : 'サイトに公開する'}
                                        </button>
                                        <button type="button" onClick={handleSaveDraft} disabled={busy} aria-busy={savingAction === 'draft'}
                                            className={`rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2.5 transition ${savingAction === 'draft' ? '' : 'disabled:opacity-40'}`}>
                                            {savingAction === 'draft' ? '下書きを保存しています…' : '下書き保存(サイトには出ません)'}
                                        </button>
                                    </>
                                )}
                                {isDirty && savedStatus !== null && (
                                    <button type="button" onClick={revertChanges} disabled={busy}
                                        className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 hover:underline disabled:opacity-40">
                                        変更を取り消す
                                    </button>
                                )}
                                {selected && (
                                    <button type="button" onClick={() => deletePost(selected)} disabled={busy}
                                        className="ml-auto rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 text-sm font-medium px-4 py-2.5 transition">
                                        {deleting ? '削除しています…' : 'この記事を削除…'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>
                    )}
                </div>
            </main>

            {/* 削除の知らせ(編集欄ごと消えることがあるので、画面の下に 6 秒出す) */}
            <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end">
                {toast && (
                    <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg sm:w-96">
                        <span className="flex-1">✓ {toast}</span>
                        <button type="button" onClick={() => setToast(null)} aria-label="閉じる" className="text-gray-300 hover:text-white">✕</button>
                    </div>
                )}
            </div>
        </div>
    )
}
