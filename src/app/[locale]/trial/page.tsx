'use client'

// 相談を書く流れの体験(ログイン不要・公開)。本番(WriteFlow)と同じく、書いて届ける → 結果。困りごとを選ぶ段はない(#133)。
// 結果では、AI に渡す直前に個人情報を伏せる様子(src/lib/pii.ts の層1)を原文と並べて見せ、
// 本番で届けたときにサービスの側でどう分類されて支援団体に届くかを、書いた文から作って見せる。
// 呼ぶのは分類の API(/api/public/trial/classify)だけ。連絡先らしいところを伏せてから AI に渡し、何も保存しない(11/6 代表)。
// 費用は API の回数の上限(DB)で抑え、上限を超えたとき・失敗したときは表示例を出す。
// ほかの fetch や supabase の呼び出しは足さないこと(相談の保存・届け出はしない)
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { AppHeader } from '@/components/app/AppShell'
import { Footer } from '@/components/app/Footer'
import { Button, Card, Chip, Heading, Lead, Screen, TextArea, TextField } from '@/components/app/ui'
import { CrisisNotice } from '@/components/app/CrisisLinks'
import { indicatorMessageKey, NEIGHBOR_CATEGORY } from '@/lib/constants/intakeIndicators'
import { caseBodyForAi, caseTitle, DESCRIPTION_MAX, EXTRA_MAX, optionsFor, shortTitle } from '@/lib/domain/intake'
import { detectPiiSpans, PII_PLACEHOLDERS, type PiiCategory, type PiiSpan } from '@/lib/pii'
import { detectUrgency } from '@/lib/urgency'

const CATEGORY_CLASSES: Record<PiiCategory, string> = {
  phone: 'bg-red-100 text-red-800 border-red-300',
  email: 'bg-orange-100 text-orange-800 border-orange-300',
  postal: 'bg-amber-100 text-amber-800 border-amber-300',
  address: 'bg-lime-100 text-lime-800 border-lime-300',
  url: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  sns: 'bg-sky-100 text-sky-800 border-sky-300',
  dob: 'bg-violet-100 text-violet-800 border-violet-300',
  date: 'bg-purple-100 text-purple-800 border-purple-300',
  number: 'bg-gray-200 text-gray-700 border-gray-400',
}

// AI を使えなかったときの表示例に付ける大項目(例文の困りごと: 住まい・地域 / 差別・不平等)
const MOCK_GOALS = [11, 10]

// 原文(色付き)またはマスク後(印に置き換え)を描く
function SpanText({ text, spans, masked }: { text: string; spans: PiiSpan[]; masked: boolean }) {
  const parts: ReactNode[] = []
  let cursor = 0
  spans.forEach((s, i) => {
    if (s.start > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, s.start)}</span>)
    parts.push(
      <mark key={`m${i}`} className={`rounded border px-0.5 ${CATEGORY_CLASSES[s.cat]}`}>
        {masked ? PII_PLACEHOLDERS[s.cat] : text.slice(s.start, s.end)}
      </mark>,
    )
    cursor = s.end
  })
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>)
  return <p className="m-0 whitespace-pre-wrap break-words text-t14 leading-[1.9] text-ink">{parts}</p>
}

// 「本番ではこのあと」の 1 段。下に画面の表示例を置く
function NextStep({ number, title, description, exampleTag, children }: { number: number; title: string; description: string; exampleTag: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-start gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-night text-t13 font-bold text-white" aria-hidden>{number}</span>
        <div className="flex flex-col gap-0.5 pt-0.5">
          <span className="text-t14_5 font-bold">{title}</span>
          <span className="text-t12_5 leading-[1.7] text-ink-soft">{description}</span>
        </div>
      </div>
      <Card className="relative p-3.5">
        <span className="absolute -top-2 right-3 rounded-full border border-line bg-kinari px-2 py-px text-t10_5 text-mist">{exampleTag}</span>
        {children}
      </Card>
    </li>
  )
}

function GuardTerm({ children }: { children: ReactNode }) {
  return <span className="ml-1.5 inline-block whitespace-nowrap rounded border border-line-strong bg-paper px-1.5 py-px align-middle text-t10_5 font-bold text-night">{children}</span>
}

// 分類の API の返事。source が none なら AI を使えなかった(回数の上限・失敗)ので、表示例を出す
type Classified = { title: string | null; ids: string[]; source: 'ai' | 'none' }
type Result = { body: string; words: string; classified: Classified }

export default function TrialPage() {
  const t = useTranslations('consult.trial')
  const tWrite = useTranslations('consult.write')

  const [words, setWords] = useState('')
  const [since, setSince] = useState('')
  const [wish, setWish] = useState('')
  const [busy, setBusy] = useState(false)
  const ticket = useRef(0)
  // 「届けてみる」を押した時点の、AI に渡す文と分類(戻って直しても結果がずれないように固定する)
  const [result, setResult] = useState<Result | null>(null)

  const urgent = detectUrgency([words, since, wish].join('\n'))
  const ready = words.trim().length > 0

  const top = () => window.scrollTo({ top: 0 })

  const fillSample = () => {
    setWords(t('sample.words'))
    setSince(t('sample.since'))
    setWish(t('sample.wish'))
  }

  const send = async () => {
    if (!ready) return
    setBusy(true)
    // AI に渡す文は結果の「AI に渡る内容」と同じ並び(本文 → いつから → どうしたいか)
    const body = caseBodyForAi({ description: words, since, wish })
    const mine = ++ticket.current
    let classified: Classified
    try {
      const res = await fetch('/api/public/trial/classify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: body }) })
      if (!res.ok) throw new Error(String(res.status))
      classified = (await res.json()) as Classified
    } catch {
      classified = { title: null, ids: [], source: 'none' }
    }
    if (mine !== ticket.current) return
    setBusy(false)
    setResult({ body, words, classified })
    top()
  }

  const retry = () => {
    setResult(null)
    top()
  }

  return (
    <Screen>
      <AppHeader />
      <main className="flex flex-col gap-4 pb-6">
        <div className="flex flex-col gap-2 px-1 pt-1">
          <Chip color="lamp" className="self-start">{t('badge')}</Chip>
          <Heading>{result ? t('resultTitle') : t('title')}</Heading>
          {!result && <Lead>{t('subtitle')}</Lead>}
        </div>
        <p className="m-0 rounded-tool bg-leaf-soft px-3 py-2 text-t12_5 font-bold leading-[1.7] text-leaf-ink">{t('safe')}</p>

        {result ? (
          <ResultView result={result} onRetry={retry} />
        ) : (
          <>
            <Heading level={2}>{tWrite('wordsTitle')}</Heading>
            <div className="flex flex-col gap-1.5">
              <Button variant="outline" className="self-start" onClick={fillSample}>{t('fillSample')}</Button>
              <span className="px-1 text-t12 leading-[1.6] text-mist">{t('sampleNote')}</span>
            </div>
            <TextArea label={tWrite('words')} value={words} maxLength={DESCRIPTION_MAX} onChange={(e) => setWords(e.target.value)} />
            <span className="-mt-3 self-end text-t12 text-mist">{tWrite('charCount', { count: words.length })}</span>
            {urgent && <CrisisNotice />}
            <TextField label={tWrite('since')} hint={tWrite('optional')} value={since} maxLength={EXTRA_MAX} onChange={(e) => setSince(e.target.value)} />
            <TextField label={tWrite('wish')} hint={tWrite('optional')} value={wish} maxLength={EXTRA_MAX} onChange={(e) => setWish(e.target.value)} />
            <Button variant="night" disabled={!ready || busy} onClick={() => void send()}>{!ready ? t('needsWords') : busy ? t('submitting') : t('submit')}</Button>
            {busy && <p role="status" className="m-0 text-t12_5 text-mist">{t('submittingNote')}</p>}
          </>
        )}

        <Footer />
      </main>
    </Screen>
  )

}

// 結果: 書いた内容(見つかった所に色)→ AI に渡る内容(印に置き換え)→ 伏せられないもの → 守り方 → このあと(1 は書いた文の分類)
function ResultView({ result, onRetry }: { result: Result; onRetry: () => void }) {
  const t = useTranslations('consult.trial')
  const tOffers = useTranslations('consult.offers')
  const tSdgs = useTranslations('sdgs')
  const locale = useLocale()
  const options = useMemo(() => optionsFor('PERSON'), [])
  const spans = detectPiiSpans(result.body)
  const counts = new Map<PiiCategory, number>()
  spans.forEach((s) => counts.set(s.cat, (counts.get(s.cat) ?? 0) + 1))
  // 支援団体の画面での見え方。AI の分類があれば書いた文から、なければ表示例
  const fromAi = result.classified.source === 'ai'
  const goals = fromAi
    ? [...new Set(result.classified.ids.map((id) => options.find((o) => o.id === id)?.category).filter((c): c is number => typeof c === 'number'))]
    : MOCK_GOALS
  const shownGoals = goals.length > 0 ? goals : [NEIGHBOR_CATEGORY]
  const firstId = fromAi ? result.classified.ids[0] : undefined
  const shownTitle = fromAi
    ? caseTitle({ locale, savedTitle: result.classified.title ?? shortTitle(result.words), firstIndicatorLabel: firstId ? tSdgs(`indicator.${indicatorMessageKey(firstId)}`) : null, ownWords: null })
    : t('mockCaseTitle')
  return (
    <>
      <Lead>{t('resultLead')}</Lead>

      <Card className="flex flex-col gap-2 p-4">
        <Heading level={3}>{t('beforeTitle')}</Heading>
        <span className="text-t12 text-mist">{t('beforeNote')}</span>
        <SpanText text={result.body} spans={spans} masked={false} />
        <div className="mt-1 flex flex-col gap-0.5 rounded-tool bg-steel-faint p-3">
          <span className="text-t13 font-bold">{t('readerTitle')}</span>
          <span className="text-t12_5 leading-[1.7] text-ink-soft">{t('readerBody')}</span>
        </div>
      </Card>

      <Card className="flex flex-col gap-2 border-night p-4">
        <Heading level={3}>{t('afterTitle')}</Heading>
        <span className="text-t12 text-mist">{t('afterNote')}</span>
        <SpanText text={result.body} spans={spans} masked />
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
          <span className="text-t12_5 font-bold text-ink-soft">{spans.length > 0 ? t('foundCount', { count: spans.length }) : t('foundNone')}</span>
          {[...counts.entries()].map(([cat, n]) => (
            <span key={cat} className={`rounded-full border px-2 py-0.5 text-t11_5 ${CATEGORY_CLASSES[cat]}`}>{t(`categories.${cat}`)} × {n}</span>
          ))}
        </div>
        <span className="text-t12 leading-[1.7] text-mist">{t('aiNote')}</span>
      </Card>

      <div role="note" className="flex flex-col gap-1 rounded-[16px] bg-coral-soft p-4">
        <span className="text-t14 font-bold text-coral-ink">{t('limitTitle')}</span>
        <span className="text-t12_5 leading-[1.75] text-ink-soft">{t('limitBody')}</span>
      </div>

      <Card className="flex flex-col gap-2 p-4">
        <Heading level={3}>{t('guardTitle')}</Heading>
        <p className="m-0 text-t12_5 leading-[1.75] text-ink-soft">{t('guardLead')}<GuardTerm>{t('guardLeadTerm')}</GuardTerm></p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {(['guard1', 'guard2', 'guard3', 'guard4'] as const).map((key) => (
            <li key={key} className="flex gap-2 text-t12_5 leading-[1.75] text-ink-soft">
              <span aria-hidden className="text-night">✓</span>
              <span>{t(key)}<GuardTerm>{t(`${key}Term`)}</GuardTerm></span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col gap-1 px-1 pt-2">
        <Heading level={2}>{t('nextTitle')}</Heading>
        <span className="text-t12 text-mist">{fromAi ? t('nextLeadAi') : t('nextLead')}</span>
      </div>
      <ol className="m-0 flex list-none flex-col gap-5 p-0">
        <NextStep number={1} title={t('next1Title')} description={t('next1')} exampleTag={fromAi ? t('fromYourWordsTag') : t('exampleTag')}>
          <span className="block text-t14_5 font-bold">{shownTitle}</span>
          <div className="mt-2 flex flex-wrap gap-1">
            {shownGoals.map((goal) => <Chip key={goal}>{goal} {tSdgs(`category.${goal}`)}</Chip>)}
          </div>
          {!fromAi && <p className="m-0 mt-2 text-t12 leading-[1.7] text-mist">{t('aiUnavailableNote')}</p>}
        </NextStep>

        <NextStep number={2} title={t('next2Title')} description={t('next2')} exampleTag={t('exampleTag')}>
          <div className="flex flex-col gap-1">
            <span className="text-t14_5 font-bold">{t('mockOrgName')}</span>
            <Chip color="leaf" className="self-start">{tOffers('interviewed')}</Chip>
            <span className="mt-1 text-t12_5 leading-[1.75] text-ink-soft">{t('mockOfferMessage')}</span>
          </div>
          <div className="mt-3 flex gap-2" aria-hidden>
            <span className="flex min-h-[40px] flex-1 items-center justify-center rounded-[14px] bg-night px-3 text-t13 font-bold text-white">{tOffers('choose')}</span>
            <span className="flex min-h-[40px] flex-1 items-center justify-center rounded-[14px] border-[1.5px] border-line-strong px-3 text-t13 font-bold text-ink-soft">{tOffers('pass')}</span>
          </div>
        </NextStep>

        <NextStep number={3} title={t('next3Title')} description={t('next3')} exampleTag={t('exampleTag')}>
          <div className="flex flex-col gap-2">
            <p className="m-0 mr-8 rounded-[16px] rounded-tl-[4px] bg-steel-faint px-3 py-2 text-t12_5 leading-[1.7]">{t('mockChatSupporter')}</p>
            <p className="m-0 ml-8 rounded-[16px] rounded-tr-[4px] bg-night px-3 py-2 text-t12_5 leading-[1.7] text-white">{t('mockChatUser')}</p>
          </div>
        </NextStep>
      </ol>

      <div className="grid gap-2 pt-2 sm:grid-cols-2">
        <Link href="/consult/new" className="flex min-h-[64px] flex-col justify-center gap-0.5 rounded-[16px] bg-night px-4 py-2.5 text-white no-underline">
          <span className="text-t12 text-[#C9D6E6]">{t('ctaConsultTitle')}</span>
          <span className="text-t15 font-bold">{t('ctaConsult')}</span>
        </Link>
        <Link href="/support/join" className="flex min-h-[64px] flex-col justify-center gap-0.5 rounded-[16px] bg-dawn-soft px-4 py-2.5 text-dawn-ink no-underline">
          <span className="text-t12">{t('ctaSupportTitle')}</span>
          <span className="text-t15 font-bold">{t('ctaSupport')}</span>
        </Link>
      </div>
      <Button variant="outline" onClick={onRetry}>{t('retry')}</Button>
    </>
  )
}
