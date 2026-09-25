'use client'

// 管理画面: note 記事ワークフロー(INTERVIEW 投稿用)。
// 取材メモ → 切り口3案(1つ選ぶ) → 本文 → 見直し(取材相手への確認リスト) → 書式付きコピーで note に貼る。
// 生成結果はこのパネルの state ではなく親フォームに持たせ、「保存」で投稿と一緒に保存する。
import { useState } from 'react'
import {
    NEWS_ARTICLE_MAX, NEWS_CHECKLIST_MAX, NEWS_INTERVIEW_SOURCE_MAX, type NewsAngle,
} from '@/lib/constants/news'
import { articleToHtml, articleToPlainText, parseArticleBlocks } from '@/lib/news/articleFormat'

export type NoteArticleFields = {
    interview_source: string
    note_angle: NewsAngle | null
    note_article: string
    note_checklist: string
}

type Props = {
    title: string
    fields: NoteArticleFields
    onChange: (patch: Partial<NoteArticleFields>) => void
    onDraftWritten: (draft: { title: string; lead: string }) => void
    authHeader: () => Promise<Record<string, string> | null>
}

type Step = 'angles' | 'write' | 'review'

// 書式付き(HTML)と文章の両方をクリップボードへ。書式付きが使えない環境では文章だけ
async function copyToClipboard(text: string, html?: string) {
    try {
        if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([html], { type: 'text/html' }),
                    'text/plain': new Blob([text], { type: 'text/plain' }),
                }),
            ])
            return true
        }
    } catch {
        // 書式付きに失敗したら文章だけにフォールバック
    }
    await navigator.clipboard.writeText(text)
    return true
}

const textareaClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-300'
const primaryButton = 'rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 transition'
const subtleButton = 'rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 text-xs font-medium px-3 py-1.5 transition'

export function NoteArticlePanel({ title, fields, onChange, onDraftWritten, authHeader }: Props) {
    const [angles, setAngles] = useState<NewsAngle[]>([])
    const [running, setRunning] = useState<Step | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [showPreview, setShowPreview] = useState(false)
    const [copied, setCopied] = useState<string | null>(null)

    const source = fields.interview_source
    const hasSource = source.trim().length > 0

    const run = async (step: Step) => {
        setError(null)
        setNotice(null)
        if (!hasSource) { setError('取材メモを入力してください'); return }
        if (step === 'write' && !fields.note_angle) { setError('先に切り口を選んでください'); return }
        if (step === 'write' && fields.note_article.trim() && !window.confirm('記事本文が入力済みです。AIの本文で上書きしますか?')) return
        if (step === 'review' && !fields.note_article.trim()) { setError('先に記事本文を用意してください'); return }
        setRunning(step)
        try {
            const headers = await authHeader()
            if (!headers) return
            const res = await fetch('/api/admin/news/article', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ step, source, angle: fields.note_angle, article: fields.note_article }),
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || '生成に失敗しました')
            if (step === 'angles') {
                setAngles(result.angles)
                setNotice('切り口を3案出しました。1つ選んでください(タイトルは後で直せます)')
            } else if (step === 'write') {
                onChange({ note_article: result.article })
                onDraftWritten({ title: result.title, lead: result.lead })
                setShowPreview(true)
                setNotice(`本文を入れました(${result.article.length}文字)。読んで直したら「見直し」で確認リストを作ってください`)
            } else {
                onChange({ note_checklist: result.checklist })
                setNotice('確認リストを作りました。直してから取材相手に送り、OK をもらってから note に公開してください')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '生成に失敗しました')
        } finally {
            setRunning(null)
        }
    }

    const copy = async (kind: 'rich' | 'plain' | 'title' | 'checklist') => {
        const article = fields.note_article
        if (kind === 'rich') await copyToClipboard(articleToPlainText(article), articleToHtml(article))
        else if (kind === 'plain') await copyToClipboard(articleToPlainText(article))
        else if (kind === 'title') await copyToClipboard(title)
        else await copyToClipboard(fields.note_checklist)
        setCopied(kind)
        window.setTimeout(() => setCopied(null), 2000)
    }

    const chosen = fields.note_angle

    return (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-5">
            <div>
                <p className="text-sm font-bold text-indigo-900">note 記事を作る(インタビュー用)</p>
                <p className="text-xs text-indigo-800/80 mt-0.5">
                    取材メモ → 切り口を選ぶ → 本文 → 見直し、の順です。できた本文と確認リストは、下の「保存」でこの投稿と一緒に保存されます。
                </p>
            </div>

            {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            {/* 1. 取材メモ */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    1. 取材メモ・書き起こし <span className="text-xs font-normal text-gray-400">{source.length}/{NEWS_INTERVIEW_SOURCE_MAX}</span>
                </label>
                <textarea
                    value={source}
                    onChange={(e) => onChange({ interview_source: e.target.value })}
                    maxLength={NEWS_INTERVIEW_SOURCE_MAX}
                    rows={10}
                    placeholder={'聞きながら取ったメモでも、録音を文字にした書き起こしでも構いません。\n・担当者の名前や所属を載せてよいなら「掲載可」と書く\n・記事にしない話は「非公開」「オフレコ」と付ける(AI はその部分を使いません)'}
                    className={textareaClass}
                />
            </div>

            {/* 2. 切り口 */}
            <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">2. 切り口</span>
                    <button type="button" onClick={() => run('angles')} disabled={running !== null || !hasSource} className={primaryButton}>
                        {running === 'angles' ? '考え中…(15秒ほど)' : angles.length > 0 ? 'もう一度3案出す' : '切り口を3案出す'}
                    </button>
                </div>
                {angles.length > 0 && (
                    <div className="grid gap-2 md:grid-cols-3">
                        {angles.map((angle, index) => {
                            const selected = chosen?.title === angle.title && chosen?.hook === angle.hook
                            return (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => onChange({ note_angle: angle })}
                                    className={`rounded-lg border p-3 text-left text-xs transition ${selected ? 'border-indigo-500 bg-white ring-2 ring-indigo-200' : 'border-gray-200 bg-white hover:border-indigo-300'}`}
                                >
                                    <p className="text-sm font-bold text-gray-900">{angle.title}</p>
                                    <p className="mt-1.5 text-gray-600"><span className="font-medium text-gray-500">誰に: </span>{angle.audience}</p>
                                    <p className="mt-1 text-gray-600"><span className="font-medium text-gray-500">冒頭: </span>{angle.hook}</p>
                                    <p className="mt-1 text-gray-400">{angle.why}</p>
                                    <p className={`mt-2 font-bold ${selected ? 'text-indigo-700' : 'text-gray-400'}`}>{selected ? '✓ この切り口で書く' : 'この切り口にする'}</p>
                                </button>
                            )
                        })}
                    </div>
                )}
                {chosen && (
                    <div className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs text-gray-700">
                        <span className="font-medium text-indigo-700">選択中の切り口: </span>{chosen.title}
                        <span className="text-gray-400"> — {chosen.audience}</span>
                    </div>
                )}
            </div>

            {/* 3. 本文 */}
            <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">3. 本文</span>
                    <button type="button" onClick={() => run('write')} disabled={running !== null || !hasSource || !chosen} className={primaryButton}>
                        {running === 'write' ? '書いています…(1分ほど)' : 'この切り口で本文を書く'}
                    </button>
                    {fields.note_article.trim() && (
                        <button type="button" onClick={() => setShowPreview((v) => !v)} className={subtleButton}>
                            {showPreview ? '編集に戻る' : 'プレビュー'}
                        </button>
                    )}
                </div>
                {showPreview && fields.note_article.trim() ? (
                    <div className="rounded-lg border border-gray-200 bg-white px-5 py-4 text-[15px] leading-8 text-gray-700">
                        <p className="mb-4 text-xl font-black text-gray-900">{title || '(タイトル未入力)'}</p>
                        {parseArticleBlocks(fields.note_article).map((block, index) => {
                            if (block.type === 'h2') return <h2 key={index} className="mt-6 mb-2 text-lg font-bold text-gray-900">{block.text}</h2>
                            if (block.type === 'h3') return <h3 key={index} className="mt-4 mb-1 text-base font-bold text-gray-900">{block.text}</h3>
                            if (block.type === 'quote') return <blockquote key={index} className="my-4 border-l-4 border-indigo-200 pl-4 text-gray-600 whitespace-pre-line">{block.text}</blockquote>
                            return <p key={index} className="my-3 whitespace-pre-line">{block.text}</p>
                        })}
                    </div>
                ) : (
                    <textarea
                        value={fields.note_article}
                        onChange={(e) => onChange({ note_article: e.target.value })}
                        maxLength={NEWS_ARTICLE_MAX}
                        rows={22}
                        placeholder="AI が書いた本文がここに入ります。自分で書いても構いません(見出しは「## 」、引用は「> 」、段落は空行で区切る)"
                        className={textareaClass}
                    />
                )}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-400">{fields.note_article.length}/{NEWS_ARTICLE_MAX}</span>
                    <button type="button" onClick={() => copy('rich')} disabled={!fields.note_article.trim()} className={subtleButton}>
                        {copied === 'rich' ? 'コピーしました' : 'note 用にコピー(書式付き)'}
                    </button>
                    <button type="button" onClick={() => copy('plain')} disabled={!fields.note_article.trim()} className={subtleButton}>
                        {copied === 'plain' ? 'コピーしました' : '文章だけコピー'}
                    </button>
                    <button type="button" onClick={() => copy('title')} disabled={!title.trim()} className={subtleButton}>
                        {copied === 'title' ? 'コピーしました' : 'タイトルをコピー'}
                    </button>
                </div>
                <p className="text-xs text-gray-400">
                    note の本文欄に「書式付き」で貼ると見出しと引用が残るはずです。残らない場合は「文章だけコピー」で貼り、見出し行を note の見出し機能で付け直してください。タイトルは note のタイトル欄に入れます。
                </p>
            </div>

            {/* 4. 見直し */}
            <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">4. 見直し(取材相手への確認リスト)</span>
                    <button type="button" onClick={() => run('review')} disabled={running !== null || !hasSource || !fields.note_article.trim()} className={primaryButton}>
                        {running === 'review' ? '読んでいます…(30秒ほど)' : '確認リストを作る'}
                    </button>
                    <button type="button" onClick={() => copy('checklist')} disabled={!fields.note_checklist.trim()} className={subtleButton}>
                        {copied === 'checklist' ? 'コピーしました' : 'コピー'}
                    </button>
                </div>
                <textarea
                    value={fields.note_checklist}
                    onChange={(e) => onChange({ note_checklist: e.target.value })}
                    maxLength={NEWS_CHECKLIST_MAX}
                    rows={10}
                    placeholder="編集・事実・個人情報の目で本文を読み、取材相手に確認する項目とライターが直す箇所を出します"
                    className={textareaClass}
                />
                <p className="text-xs text-gray-400">
                    リストを直してから取材相手に送り、OK をもらってから note に公開します。公開したら note の URL を下の「外部リンク」に入れ、この投稿を公開にしてください。
                </p>
            </div>
        </div>
    )
}
