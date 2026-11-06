'use client'

// 相談を書く流れの体験(ログイン不要・公開)。本番(WriteFlow)と同じ順に 1 書く → 2 近いものを選ぶ → 結果。
// 結果では、AI に渡す直前に個人情報を伏せる様子(src/lib/pii.ts の層1)を原文と並べて見せる。
// 呼ぶのは「近いもの」の API(/api/public/trial/suggest)だけ。連絡先らしいところを伏せてから AI に渡し、何も保存しない(11/6 代表)。
// 費用は API の回数の上限(DB)で抑え、上限を超えたとき・失敗したときは文字の重なり(suggestByOverlap)で出す。
// ほかの fetch や supabase の呼び出しは足さないこと(相談の保存・届け出はしない)
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { AppHeader } from '@/components/app/AppShell'
import { Footer } from '@/components/app/Footer'
import { Button, Card, Chip, Heading, Lead, Screen, SectionLabel, StepBar, TextArea, TextField } from '@/components/app/ui'
import { IndicatorPicker, SuggestedOptions } from '@/components/consult/IndicatorPicker'
import { CrisisNotice } from '@/components/consult/WriteFlow'
import { suggestByOverlap } from '@/lib/ai/prompts/suggestIndicators'
import { indicatorMessageKey, MAX_INDICATOR_SELECTIONS } from '@/lib/constants/intakeIndicators'
import { caseBodyForAi, DESCRIPTION_MAX, EXTRA_MAX, optionsFor } from '@/lib/domain/intake'
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

// 「本番ではこのあと」の表示例に付ける大項目(例文の困りごと: 住まい・地域 / 差別・不平等)
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
  return <p className="m-0 whitespace-pre-wrap break-words text-[14px] leading-[1.9] text-ink">{parts}</p>
}

// 「本番ではこのあと」の 1 段。下に画面の表示例(架空の内容)を置く
function NextStep({ number, title, description, exampleTag, children }: { number: number; title: string; description: string; exampleTag: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-start gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-night text-[13px] font-bold text-white" aria-hidden>{number}</span>
        <div className="flex flex-col gap-0.5 pt-0.5">
          <span className="text-[14.5px] font-bold">{title}</span>
          <span className="text-[12.5px] leading-[1.7] text-ink-soft">{description}</span>
        </div>
      </div>
      <Card className="relative p-3.5">
        <span className="absolute -top-2 right-3 rounded-full border border-line bg-kinari px-2 py-px text-[10.5px] text-mist">{exampleTag}</span>
        {children}
      </Card>
    </li>
  )
}

function GuardTerm({ children }: { children: ReactNode }) {
  return <span className="ml-1.5 inline-block whitespace-nowrap rounded border border-line-strong bg-paper px-1.5 py-px align-middle text-[10.5px] font-bold text-night">{children}</span>
}

type Result = { body: string; chosen: string[] }

export default function TrialPage() {
  const t = useTranslations('consult.trial')
  const tWrite = useTranslations('consult.write')
  const tSdgs = useTranslations('sdgs')
  const options = useMemo(() => optionsFor('PERSON'), [])

  const [step, setStep] = useState<1 | 2>(1)
  const [words, setWords] = useState('')
  const [since, setSince] = useState('')
  const [wish, setWish] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  // null = 探している途中。source が overlap なら、AI を使えなかったことを添える
  const [suggested, setSuggested] = useState<string[] | null>([])
  const [suggestSource, setSuggestSource] = useState<'ai' | 'overlap'>('ai')
  const suggestTicket = useRef(0)
  const [browseAll, setBrowseAll] = useState(false)
  // 「結果を見る」を押した時点の、AI に渡すはずの文と選んだもの(戻って直しても結果がずれないように固定する)
  const [result, setResult] = useState<Result | null>(null)

  const textOf = (id: string) => tSdgs(`indicator.${indicatorMessageKey(id)}`)
  const urgentIds = useMemo(() => new Set(options.filter((o) => o.urgent).map((o) => o.id)), [options])
  const urgent = detectUrgency([words, since, wish].join('\n')) || selected.some((id) => urgentIds.has(id))
  const ready = words.trim().length > 0
  const toggle = (id: string) => {
    if (selected.includes(id)) setSelected(selected.filter((x) => x !== id))
    else if (selected.length < MAX_INDICATOR_SELECTIONS) setSelected([...selected, id])
  }

  const top = () => window.scrollTo({ top: 0 })

  const fillSample = () => {
    setWords(t('sample.words'))
    setSince(t('sample.since'))
    setWish(t('sample.wish'))
  }

  const toPick = async () => {
    if (!ready) return
    setStep(2)
    setSuggested(null)
    top()
    // AI に渡す文は結果の「AI に渡る内容」と同じ並び(本文 → いつから → どうしたいか)
    const text = caseBodyForAi({ description: words, since, wish })
    const ticket = ++suggestTicket.current
    let next: { ids: string[]; source: 'ai' | 'overlap' }
    try {
      const res = await fetch('/api/public/trial/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      if (!res.ok) throw new Error(String(res.status))
      next = (await res.json()) as { ids: string[]; source: 'ai' | 'overlap' }
    } catch {
      next = { ids: suggestByOverlap(text, options), source: 'overlap' }
    }
    if (ticket !== suggestTicket.current) return
    setSuggested(next.ids)
    setSuggestSource(next.source)
    setBrowseAll(next.ids.length === 0)
  }

  const showResult = () => {
    setResult({ body: caseBodyForAi({ description: words, since, wish }), chosen: selected })
    top()
  }

  const retry = () => {
    setResult(null)
    setStep(1)
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
        <p className="m-0 rounded-tool bg-leaf-soft px-3 py-2 text-[12.5px] font-bold leading-[1.7] text-leaf-ink">{t('safe')}</p>

        {result ? (
          <ResultView result={result} textOf={textOf} onRetry={retry} />
        ) : step === 1 ? (
          <>
            <StepBar label={tWrite('step1')} step={1} total={2} />
            <Heading level={2}>{tWrite('wordsTitle')}</Heading>
            <div className="flex flex-col gap-1.5">
              <Button variant="outline" className="self-start" onClick={fillSample}>{t('fillSample')}</Button>
              <span className="px-1 text-[12px] leading-[1.6] text-mist">{t('sampleNote')}</span>
            </div>
            <TextArea label={tWrite('words')} value={words} maxLength={DESCRIPTION_MAX} onChange={(e) => setWords(e.target.value)} />
            <span className="-mt-3 self-end text-[12px] text-mist">{tWrite('charCount', { count: words.length })}</span>
            {urgent && <CrisisNotice />}
            <TextField label={tWrite('since')} hint={tWrite('optional')} value={since} maxLength={EXTRA_MAX} onChange={(e) => setSince(e.target.value)} />
            <TextField label={tWrite('wish')} hint={tWrite('optional')} value={wish} maxLength={EXTRA_MAX} onChange={(e) => setWish(e.target.value)} />
            <Button variant="lamp" disabled={!ready} onClick={() => void toPick()}>{ready ? tWrite('nextToPick') : t('needsWords')}</Button>
          </>
        ) : (
          <>
            <StepBar label={tWrite('step2')} step={2} total={2} />
            <Heading level={2}>{tWrite('suggestTitle')}</Heading>
            <Lead>{tWrite('suggestLead')}</Lead>
            {suggested !== null && suggestSource === 'overlap' && <p className="m-0 rounded-tool bg-kinari-deep px-3 py-2 text-[12.5px] leading-[1.7] text-ink-soft">{t('overlapNote')}</p>}
            {urgent && <CrisisNotice />}
            {suggested === null ? <Lead>{tWrite('suggestLoading')}</Lead> : <SuggestedOptions ids={suggested} selected={selected} onToggle={toggle} textOf={textOf} />}
            {suggested !== null && suggested.length === 0 && <Lead>{tWrite('suggestNone')}</Lead>}
            {browseAll ? (
              <IndicatorPicker options={options} selected={selected} onChange={setSelected} subject="PERSON" />
            ) : (
              suggested !== null && <button type="button" onClick={() => setBrowseAll(true)} className="min-h-[44px] self-start text-[13.5px] font-bold text-night underline">{tWrite('browseAll')}</button>
            )}
            <p className="m-0 text-[12.5px] text-mist">{t('noneIsOk')}</p>
            <Button variant="night" onClick={showResult}>{t('submit')}</Button>
            <button type="button" onClick={() => setStep(1)} className="min-h-[44px] self-start text-[13px] text-night underline">{tWrite('backToWords')}</button>
          </>
        )}

        <Footer />
      </main>
    </Screen>
  )

}

// 結果: 選んだもの → 書いた内容(見つかった所に色)→ AI に渡る内容(印に置き換え)→ 伏せられないもの → 守り方 → このあと
function ResultView({ result, textOf, onRetry }: { result: Result; textOf: (id: string) => string; onRetry: () => void }) {
  const t = useTranslations('consult.trial')
  const tOffers = useTranslations('consult.offers')
  const tSdgs = useTranslations('sdgs')
  const spans = detectPiiSpans(result.body)
  const counts = new Map<PiiCategory, number>()
  spans.forEach((s) => counts.set(s.cat, (counts.get(s.cat) ?? 0) + 1))
  return (
    <>
      <Lead>{t('resultLead')}</Lead>

      <Card className="flex flex-col gap-2 p-4">
        <SectionLabel>{t('chosenTitle')}</SectionLabel>
        {result.chosen.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {result.chosen.map((id) => <Chip key={id} color="lamp">{textOf(id)}</Chip>)}
          </div>
        ) : (
          <span className="px-1 text-[13px] text-mist">{t('chosenNone')}</span>
        )}
      </Card>

      <Card className="flex flex-col gap-2 p-4">
        <Heading level={3}>{t('beforeTitle')}</Heading>
        <span className="text-[12px] text-mist">{t('beforeNote')}</span>
        <SpanText text={result.body} spans={spans} masked={false} />
        <div className="mt-1 flex flex-col gap-0.5 rounded-tool bg-steel-faint p-3">
          <span className="text-[13px] font-bold">{t('readerTitle')}</span>
          <span className="text-[12.5px] leading-[1.7] text-ink-soft">{t('readerBody')}</span>
        </div>
      </Card>

      <Card className="flex flex-col gap-2 border-night p-4">
        <Heading level={3}>{t('afterTitle')}</Heading>
        <span className="text-[12px] text-mist">{t('afterNote')}</span>
        <SpanText text={result.body} spans={spans} masked />
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
          <span className="text-[12.5px] font-bold text-ink-soft">{spans.length > 0 ? t('foundCount', { count: spans.length }) : t('foundNone')}</span>
          {[...counts.entries()].map(([cat, n]) => (
            <span key={cat} className={`rounded-full border px-2 py-0.5 text-[11.5px] ${CATEGORY_CLASSES[cat]}`}>{t(`categories.${cat}`)} × {n}</span>
          ))}
        </div>
        <span className="text-[12px] leading-[1.7] text-mist">{t('aiNote')}</span>
      </Card>

      <div role="note" className="flex flex-col gap-1 rounded-[16px] bg-coral-soft p-4">
        <span className="text-[14px] font-bold text-coral-ink">{t('limitTitle')}</span>
        <span className="text-[12.5px] leading-[1.75] text-ink-soft">{t('limitBody')}</span>
      </div>

      <Card className="flex flex-col gap-2 p-4">
        <Heading level={3}>{t('guardTitle')}</Heading>
        <p className="m-0 text-[12.5px] leading-[1.75] text-ink-soft">{t('guardLead')}<GuardTerm>{t('guardLeadTerm')}</GuardTerm></p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {(['guard1', 'guard2', 'guard3', 'guard4'] as const).map((key) => (
            <li key={key} className="flex gap-2 text-[12.5px] leading-[1.75] text-ink-soft">
              <span aria-hidden className="text-night">✓</span>
              <span>{t(key)}<GuardTerm>{t(`${key}Term`)}</GuardTerm></span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col gap-1 px-1 pt-2">
        <Heading level={2}>{t('nextTitle')}</Heading>
        <span className="text-[12px] text-mist">{t('nextLead')}</span>
      </div>
      <ol className="m-0 flex list-none flex-col gap-5 p-0">
        <NextStep number={1} title={t('next1Title')} description={t('next1')} exampleTag={t('exampleTag')}>
          <span className="block text-[14.5px] font-bold">{t('mockCaseTitle')}</span>
          <div className="mt-2 flex flex-wrap gap-1">
            {MOCK_GOALS.map((goal) => <Chip key={goal}>{goal} {tSdgs(`category.${goal}`)}</Chip>)}
          </div>
          <p className="m-0 mt-2 text-[12.5px] leading-[1.75] text-ink-soft">{t('mockSummary')}</p>
        </NextStep>

        <NextStep number={2} title={t('next2Title')} description={t('next2')} exampleTag={t('exampleTag')}>
          <div className="flex flex-col gap-1">
            <span className="text-[14.5px] font-bold">{t('mockOrgName')}</span>
            <Chip color="leaf" className="self-start">{tOffers('interviewed')}</Chip>
            <span className="mt-1 text-[12.5px] leading-[1.75] text-ink-soft">{t('mockOfferMessage')}</span>
          </div>
          <div className="mt-3 flex gap-2" aria-hidden>
            <span className="flex min-h-[40px] flex-1 items-center justify-center rounded-[14px] bg-night px-3 text-[13px] font-bold text-white">{tOffers('choose')}</span>
            <span className="flex min-h-[40px] flex-1 items-center justify-center rounded-[14px] border-[1.5px] border-line-strong px-3 text-[13px] font-bold text-ink-soft">{tOffers('pass')}</span>
          </div>
        </NextStep>

        <NextStep number={3} title={t('next3Title')} description={t('next3')} exampleTag={t('exampleTag')}>
          <div className="flex flex-col gap-2">
            <p className="m-0 mr-8 rounded-[16px] rounded-tl-[4px] bg-steel-faint px-3 py-2 text-[12.5px] leading-[1.7]">{t('mockChatSupporter')}</p>
            <p className="m-0 ml-8 rounded-[16px] rounded-tr-[4px] bg-night px-3 py-2 text-[12.5px] leading-[1.7] text-white">{t('mockChatUser')}</p>
          </div>
        </NextStep>
      </ol>

      <div className="grid gap-2 pt-2 sm:grid-cols-2">
        <Link href="/consult/new" className="flex min-h-[64px] flex-col justify-center gap-0.5 rounded-[16px] bg-night px-4 py-2.5 text-white no-underline">
          <span className="text-[12px] text-[#C9D6E6]">{t('ctaConsultTitle')}</span>
          <span className="text-[15px] font-bold">{t('ctaConsult')}</span>
        </Link>
        <Link href="/support/join" className="flex min-h-[64px] flex-col justify-center gap-0.5 rounded-[16px] bg-dawn-soft px-4 py-2.5 text-dawn-ink no-underline">
          <span className="text-[12px]">{t('ctaSupportTitle')}</span>
          <span className="text-[15px] font-bold">{t('ctaSupport')}</span>
        </Link>
      </div>
      <Button variant="outline" onClick={onRetry}>{t('retry')}</Button>
    </>
  )
}
