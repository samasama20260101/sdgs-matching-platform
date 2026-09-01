'use client'
// ============================================================
// 個人情報マスク検証ラボ(実験ページ・ADMIN専用)
//
// 目的: AIに渡す直前の「データ最小化」層として、正規表現+OSS(形態素解析)で
//       どこまで個人情報をマスクできるかを依頼者と一緒に確かめる実験台。
//       完全なマスクを保証するものではない(漏れた分は無学習契約が受け止める二段構え)。
//
// 安全設計:
// - 入力文はこの画面の外に出ない(送信ゼロ・保存ゼロ。すべてブラウザ内で処理)
// - 通信は kuromoji.js の辞書を初回に CDN(jsDelivr)から取得する一回だけ。入力文は含まれない
// - 実験材料には合成サンプル(実在しない人名・住所)を用意。本物の相談文を貼らないこと
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

// ─────────────────────────────────────────────
// カテゴリ定義
// ─────────────────────────────────────────────
type Category =
    | 'url' | 'email' | 'sns' | 'postal' | 'phone' | 'dob' | 'address' | 'number' // 正規表現層
    | 'person' | 'place' | 'org' // 固有表現層(kuromoji)

const CAT_META: Record<Category, { label: string; cls: string; source: 'regex' | 'ner' }> = {
    phone: { label: '電話番号', cls: 'bg-red-100 text-red-800 border-red-300', source: 'regex' },
    email: { label: 'メール', cls: 'bg-orange-100 text-orange-800 border-orange-300', source: 'regex' },
    postal: { label: '郵便番号', cls: 'bg-amber-100 text-amber-800 border-amber-300', source: 'regex' },
    address: { label: '住所', cls: 'bg-lime-100 text-lime-800 border-lime-300', source: 'regex' },
    url: { label: 'URL', cls: 'bg-cyan-100 text-cyan-800 border-cyan-300', source: 'regex' },
    sns: { label: 'SNS ID', cls: 'bg-sky-100 text-sky-800 border-sky-300', source: 'regex' },
    dob: { label: '生年月日', cls: 'bg-violet-100 text-violet-800 border-violet-300', source: 'regex' },
    number: { label: '数字列', cls: 'bg-gray-200 text-gray-700 border-gray-400', source: 'regex' },
    person: { label: '人名', cls: 'bg-pink-100 text-pink-800 border-pink-300', source: 'ner' },
    place: { label: '地名', cls: 'bg-green-100 text-green-800 border-green-300', source: 'ner' },
    org: { label: '組織名', cls: 'bg-teal-100 text-teal-800 border-teal-300', source: 'ner' },
}

type Span = { start: number; end: number; cat: Category; text: string }

// ─────────────────────────────────────────────
// 層1: 正規表現ルール(配列順 = 重なったときの優先順)
// ─────────────────────────────────────────────
const REGEX_RULES: { cat: Category; re: () => RegExp }[] = [
    { cat: 'url', re: () => /https?:\/\/[^\s　]+/g },
    { cat: 'email', re: () => /[A-Za-z0-9._%+-]+\s{0,2}@\s{0,2}[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
    // LINE ID: tanaka_123 / @handle 形式
    { cat: 'sns', re: () => /(?:LINE|ライン|Instagram|インスタ(?:グラム)?|Twitter|TikTok|X)\s*(?:の)?\s*(?:ID|ＩＤ|アイディー?)\s*[:：]?\s*[A-Za-z0-9_.-]{3,}|@[A-Za-z0-9_.]{3,}/g },
    { cat: 'postal', re: () => /〒\s*[0-9０-９]{3}[-−ー‐]?[0-9０-９]{4}|(?<![0-9-])[0-9]{3}[-−ー‐][0-9]{4}(?![0-9-])/g },
    { cat: 'phone', re: () => /(?:\+81[-−ー‐\s]?|0|０)[0-9０-９]{1,4}[-−ー‐()（）.・\s]?[0-9０-９]{1,4}[-−ー‐()（）.・\s]?[0-9０-９]{3,4}/g },
    // 年つきの日付のみ(「来週の3月2日」のような予定日は拾わない)
    { cat: 'dob', re: () => /(?:19|20|１９|２０)[0-9０-９]{2}\s*年\s*[0-9０-９]{1,2}\s*月\s*[0-9０-９]{1,2}\s*日\s*(?:生まれ|生)?/g },
    // 市区町村+丁目・番地・号の並び(番地なしの「市役所」等は拾わない)
    { cat: 'address', re: () => /(?:[一-龥]{2,3}[都道府県])?[一-龥ぁ-んァ-ヶー]{1,8}(?:市|区|郡|町|村)(?:[一-龥ぁ-んァ-ヶー]{1,10})?(?:[0-9０-９一二三四五六七八九十]{1,4}(?:丁目|番地|番|号|[-−ー‐])\s?){1,4}[0-9０-９]{0,4}(?:号室|号)?/g },
    // 建物名+部屋番号。名前部分はひらがなも許すが、部屋番号まで来たら止まる(貪欲に後続の文へ食い込まない)。
    // 部屋番号がない建物名はひらがなを含めない(「〜に住んで」等の助詞・動詞への食い込み防止)
    { cat: 'address', re: () => /(?:コーポ|ハイツ|メゾン|アパート|マンション|レジデンス)[一-龥ぁ-んァ-ヶーA-Za-z0-9０-９]{0,12}?[0-9０-９]{1,4}\s?号室?|(?:コーポ|ハイツ|メゾン|アパート|マンション|レジデンス)[一-龥ァ-ヶーA-Za-z0-9０-９]{0,12}|[0-9０-９]{1,4}号室/g },
    // 口座番号・マイナンバー等の7桁以上の数字列
    { cat: 'number', re: () => /(?<![0-9])[0-9]{7,}(?![0-9])/g },
]

// 検出前の正規化: 全角英数字・記号・全角スペースを半角へ(NFKC)。
// 文字数が変わらない置換だけ適用するので、検出位置は原文とずれない。
function normalizeForDetection(original: string): string {
    let out = ''
    for (const ch of original) {
        const n = ch.normalize('NFKC')
        out += n.length === ch.length ? n : ch
    }
    return out
}

function detectRegex(original: string): Span[] {
    const text = normalizeForDetection(original)
    const spans: Span[] = []
    for (const rule of REGEX_RULES) {
        const re = rule.re()
        let m: RegExpExecArray | null
        while ((m = re.exec(text)) !== null) {
            if (m[0].length === 0) { re.lastIndex++; continue }
            // 内訳には原文の該当箇所を見せる(正規化後ではなく)
            spans.push({ start: m.index, end: m.index + m[0].length, cat: rule.cat, text: original.slice(m.index, m.index + m[0].length) })
        }
    }
    return spans
}

// 重なりの解決: 開始位置が早い→長い→ルール順、の優先で採用
const CAT_ORDER = Object.keys(CAT_META) as Category[]
function resolveOverlaps(spans: Span[]): Span[] {
    const sorted = [...spans].sort((a, b) =>
        a.start - b.start || (b.end - b.start) - (a.end - a.start) || CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat)
    )
    const accepted: Span[] = []
    for (const s of sorted) {
        if (accepted.some(a => s.start < a.end && a.start < s.end)) continue
        accepted.push(s)
    }
    return accepted.sort((a, b) => a.start - b.start)
}

// ─────────────────────────────────────────────
// 層2: kuromoji.js による固有表現(人名・地名・組織)
// ─────────────────────────────────────────────
type KuromojiToken = {
    surface_form: string
    pos: string
    pos_detail_1: string
    pos_detail_2: string
    word_position: number // 1始まりの文字位置
}
type KuromojiTokenizer = { tokenize: (text: string) => KuromojiToken[] }
type KuromojiGlobal = {
    builder: (opt: { dicPath: string }) => {
        build: (cb: (err: unknown, tokenizer: KuromojiTokenizer) => void) => void
    }
}

const KUROMOJI_CDN = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2'

function loadKuromojiScript(): Promise<KuromojiGlobal> {
    return new Promise((resolve, reject) => {
        const w = window as unknown as { kuromoji?: KuromojiGlobal }
        if (w.kuromoji) { resolve(w.kuromoji); return }
        const s = document.createElement('script')
        s.src = KUROMOJI_CDN + '/build/kuromoji.js'
        s.onload = () => {
            if (w.kuromoji) resolve(w.kuromoji)
            else reject(new Error('kuromoji global not found'))
        }
        s.onerror = () => reject(new Error('kuromoji script load failed'))
        document.head.appendChild(s)
    })
}

function buildTokenizer(k: KuromojiGlobal): Promise<KuromojiTokenizer> {
    return new Promise((resolve, reject) => {
        k.builder({ dicPath: KUROMOJI_CDN + '/dict/' }).build((err, tokenizer) => {
            if (err) reject(err)
            else resolve(tokenizer)
        })
    })
}

const NER_MAP: Record<string, Category> = { 人名: 'person', 地域: 'place', 組織: 'org' }

function detectNer(text: string, tokenizer: KuromojiTokenizer): Span[] {
    const tokens = tokenizer.tokenize(text)
    const spans: Span[] = []
    for (const t of tokens) {
        if (t.pos !== '名詞' || t.pos_detail_1 !== '固有名詞') continue
        const cat = NER_MAP[t.pos_detail_2]
        if (!cat) continue
        const start = t.word_position - 1
        const end = start + t.surface_form.length
        const prev = spans[spans.length - 1]
        // 連続する同カテゴリ(姓+名など)はひとつに結合
        if (prev && prev.cat === cat && prev.end === start) {
            prev.end = end
            prev.text = text.slice(prev.start, end)
        } else {
            spans.push({ start, end, cat, text: t.surface_form })
        }
    }
    return spans
}

// ─────────────────────────────────────────────
// 合成サンプル(実在しない人名・住所。ひっかけ入り)
// ─────────────────────────────────────────────
const SAMPLES: { name: string; text: string }[] = [
    {
        name: 'サンプル1: 生活困窮',
        text: '山田花子と申します。熊本市中央区水前寺6丁目18-1のコーポひまわり203号室に住んでいます。連絡は090-1234-5678か hanako.yamada@example.com へお願いします。夫の太郎が失業して、家賃が払えず困っています。',
    },
    {
        name: 'サンプル2: 見守り',
        text: '近所の田中のおばあちゃん(1948年3月2日生まれ)が心配です。住所は〒862-0950 熊本市中央区水前寺公園3-1です。LINEのID: tanaka_mimamori に連絡がつきません。知らない人から口座1234567890に振り込めと言われたそうです。',
    },
    {
        name: 'サンプル3: 表記ゆれ',
        text: '電話は０９０－１２３４－５６７８か 096.384.1234 へ。メールは ＨＡＮＡＫＯ＠ＥＸＡＭＰＬＥ．ＣＯＭ か hanako.yamada @ example.com です。郵便番号は８６２−０９５０。',
    },
    {
        name: 'サンプル4: ひっかけ(消しすぎ検証)',
        text: '水俣病の後遺症の相談です。田中内科クリニックを紹介されましたが遠くて通えません。SDGs目標3の関係で、来週の3月2日に市役所へ行く予定です。请求は1万5000円でした。',
    },
]

// ─────────────────────────────────────────────
// 表示部品
// ─────────────────────────────────────────────
function MaskedText({ text, spans }: { text: string; spans: Span[] }) {
    const parts: React.ReactNode[] = []
    let cursor = 0
    spans.forEach((s, i) => {
        if (s.start > cursor) parts.push(<span key={'t' + i}>{text.slice(cursor, s.start)}</span>)
        parts.push(
            <mark key={'m' + i} title={'原文: ' + s.text} className={'rounded border px-1 mx-0.5 text-sm font-medium cursor-help ' + CAT_META[s.cat].cls}>
                【{CAT_META[s.cat].label}】
            </mark>
        )
        cursor = s.end
    })
    if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>)
    return <p className="leading-loose whitespace-pre-wrap break-words">{parts}</p>
}

function ResultPanel({ title, note, text, spans }: { title: string; note: string; text: string; spans: Span[] }) {
    const counts = new Map<Category, number>()
    spans.forEach(s => counts.set(s.cat, (counts.get(s.cat) || 0) + 1))
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <div>
                <h3 className="font-bold text-gray-800">{title}</h3>
                <p className="text-xs text-gray-500">{note}</p>
            </div>
            <div className="bg-gray-50 rounded p-3 min-h-24">
                <MaskedText text={text} spans={spans} />
            </div>
            <div className="flex flex-wrap gap-1.5">
                {counts.size === 0 && <span className="text-xs text-gray-400">検出なし</span>}
                {[...counts.entries()].map(([cat, n]) => (
                    <span key={cat} className={'text-xs rounded-full border px-2 py-0.5 ' + CAT_META[cat].cls}>
                        {CAT_META[cat].label} × {n}
                    </span>
                ))}
            </div>
            {spans.length > 0 && (
                <details className="text-sm">
                    <summary className="cursor-pointer text-gray-500 text-xs">検出の内訳(原文を表示)</summary>
                    <table className="mt-2 w-full text-xs">
                        <tbody>
                            {spans.map((s, i) => (
                                <tr key={i} className="border-t border-gray-100">
                                    <td className="py-1 pr-2 whitespace-nowrap">
                                        <span className={'rounded border px-1.5 py-0.5 ' + CAT_META[s.cat].cls}>{CAT_META[s.cat].label}</span>
                                    </td>
                                    <td className="py-1 text-gray-700 break-all">{s.text}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </details>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────
// ページ本体
// ─────────────────────────────────────────────
export default function MaskLabPage() {
    const router = useRouter()
    const [authChecked, setAuthChecked] = useState(false)
    const [input, setInput] = useState('')
    // 変換実行時のスナップショット(textarea編集で結果がずれないように)
    const [snapshot, setSnapshot] = useState<string | null>(null)
    const [layer1, setLayer1] = useState<Span[]>([])
    const [layer2, setLayer2] = useState<Span[] | null>(null)
    const [dictState, setDictState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
    const tokenizerRef = useRef<KuromojiTokenizer | null>(null)

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/admin/login'); return }
            const res = await fetch('/api/admin/check-role', { headers: { 'Authorization': 'Bearer ' + session.access_token } })
            const result = await res.json()
            if (result.role !== 'ADMIN') { router.push('/admin/login'); return }
            setAuthChecked(true)
        }
        checkAdmin()
    }, [router])

    const runLayers = useCallback((text: string) => {
        setSnapshot(text)
        setLayer1(resolveOverlaps(detectRegex(text)))
        if (tokenizerRef.current) {
            setLayer2(resolveOverlaps([...detectRegex(text), ...detectNer(text, tokenizerRef.current)]))
        } else {
            setLayer2(null)
        }
    }, [])

    const handleConvert = () => {
        if (!input.trim()) return
        runLayers(input)
    }

    const handleLoadDict = async () => {
        setDictState('loading')
        try {
            const k = await loadKuromojiScript()
            tokenizerRef.current = await buildTokenizer(k)
            setDictState('ready')
            // すでに変換済みなら層2を追いがけで計算
            if (snapshot !== null) {
                setLayer2(resolveOverlaps([...detectRegex(snapshot), ...detectNer(snapshot, tokenizerRef.current)]))
            }
        } catch (e) {
            console.error('[mask-lab] dictionary load failed:', e)
            setDictState('error')
        }
    }

    if (!authChecked) {
        return <div className="flex items-center justify-center min-h-screen text-gray-400">確認中…</div>
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">個人情報マスク検証ラボ</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        AIに渡す直前の「データ最小化」層の実験ページ。完全なマスクを保証するものではありません。
                    </p>
                </div>
                <Link href="/admin/dashboard" className="text-sm text-blue-600 hover:underline whitespace-nowrap">← 管理画面へ</Link>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                <p>・入力した文章は<strong>この画面の外に出ません</strong>(送信・保存は一切なし。すべてブラウザ内で処理します)。</p>
                <p>・通信が発生するのは、層2の辞書(約18MB・初回のみ)を CDN から取得するときだけです。入力文は含まれません。</p>
                <p>・実験には下の合成サンプルを使ってください。<strong>本物の相談文を貼らないでください。</strong></p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                    {SAMPLES.map(s => (
                        <button key={s.name} onClick={() => setInput(s.text)}
                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full px-3 py-1.5">
                            {s.name}
                        </button>
                    ))}
                </div>
                <textarea
                    rows={5}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="ここに検証したい文章を入力(または上のサンプルを挿入)"
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <div className="flex items-center gap-3">
                    <button onClick={handleConvert} disabled={!input.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg px-6 py-2">
                        マスク変換を実行
                    </button>
                    {dictState === 'idle' && (
                        <button onClick={handleLoadDict} className="text-sm text-blue-600 hover:underline">
                            層2の辞書を読み込む(約18MB・初回のみ)
                        </button>
                    )}
                    {dictState === 'loading' && <span className="text-sm text-gray-500 animate-pulse">辞書を読み込み中…(数十秒かかることがあります)</span>}
                    {dictState === 'ready' && <span className="text-sm text-green-600">層2 準備完了</span>}
                    {dictState === 'error' && (
                        <span className="text-sm text-red-600">
                            辞書の読み込みに失敗しました。<button onClick={handleLoadDict} className="underline">再試行</button>
                        </span>
                    )}
                </div>
            </div>

            {snapshot !== null && (
                <div className="grid md:grid-cols-2 gap-4">
                    <ResultPanel
                        title="層1: 正規表現のみ"
                        note="電話・メール・郵便番号・住所・URL・SNS ID・生年月日・長い数字列。無料で確実に獲れる範囲。"
                        text={snapshot}
                        spans={layer1}
                    />
                    {layer2 !== null ? (
                        <ResultPanel
                            title="層2: 正規表現 + 固有表現(kuromoji.js)"
                            note="層1に加えて、形態素解析の品詞情報から人名・地名・組織名を検出。"
                            text={snapshot}
                            spans={layer2}
                        />
                    ) : (
                        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-4 flex flex-col items-center justify-center text-center gap-2 min-h-40">
                            <p className="text-sm text-gray-500">層2(人名・地名・組織名の検出)には辞書の読み込みが必要です</p>
                            {dictState === 'loading'
                                ? <span className="text-sm text-gray-500 animate-pulse">辞書を読み込み中…</span>
                                : <button onClick={handleLoadDict} className="text-sm text-blue-600 hover:underline">辞書を読み込む(約18MB・初回のみ)</button>}
                        </div>
                    )}
                </div>
            )}

            <div className="text-xs text-gray-400 space-y-1">
                <p>凡例: {(Object.keys(CAT_META) as Category[]).map(cat => (
                    <span key={cat} className={'inline-block rounded border px-1.5 py-0.5 mr-1 mb-1 ' + CAT_META[cat].cls}>
                        {CAT_META[cat].label}{CAT_META[cat].source === 'ner' ? '(層2)' : ''}
                    </span>
                ))}</p>
                <p>マスク箇所にカーソルを乗せると原文が見えます。「検出の内訳」でも一覧できます。</p>
            </div>
        </div>
    )
}
