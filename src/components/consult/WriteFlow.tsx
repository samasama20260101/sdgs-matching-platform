'use client'

// 相談を書く(盤 12・12b・16)。自分の言葉で書く → 近いものを選ぶ → 届ける。
// 会社・地域として相談するときは、届ける前に「どの団体として届けるか」を選ぶ(なければその場で登録)段を足す。
// 団体の登録を先に求めない(何が得られるか分からないうちに登録する人はいない。2026-11-17 岡本さん)
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { apiFetch, ApiError } from '@/lib/client/api'
import { detectUrgency } from '@/lib/urgency'
import { DESCRIPTION_MAX, EXTRA_MAX, optionsFor, type SubjectType } from '@/lib/domain/intake'
import { CrisisLinks } from '@/components/app/CrisisLinks'
import { Button, ErrorNote, Heading, Lead, StepBar, TextArea, TextField, Tip } from '@/components/app/ui'
import { IndicatorPicker, SuggestedOptions } from './IndicatorPicker'
import { MAX_INDICATOR_SELECTIONS } from '@/lib/constants/intakeIndicators'
import { useIndicatorLabel } from '@/lib/client/indicatorLabel'

// 重い言葉や緊急の選択肢に気づいたとき、その場で窓口を出す(体験ページ /trial でも使う)
export function CrisisNotice({ country }: { country?: string | null }) {
  const t = useTranslations('consult.write')
  return (
    <div role="status" className="flex flex-col gap-2 rounded-[16px] bg-coral-soft p-4">
      <span className="text-t15 font-bold text-coral-ink">{t('crisisTitle')}</span>
      <span className="text-t13 leading-[1.7] text-ink-soft">{t('crisisBody')}</span>
      <CrisisLinks country={country} />
    </div>
  )
}

// 届ける団体を選ぶ段(会社・地域の相談だけ)。send に団体を渡すと相談を届け、届けられたら true を返す
export type OrganizationStep = (args: { send: (organizationId: string) => Promise<boolean>; busy: boolean }) => ReactNode

export function WriteFlow({
  subject,
  organizationStep,
  country,
  entryCode,
}: {
  subject: SubjectType
  organizationStep?: OrganizationStep
  country: string
  entryCode?: string | null
}) {
  const t = useTranslations('consult.write')
  const label = useIndicatorLabel()
  const router = useRouter()
  const options = useMemo(() => optionsFor(subject), [subject])
  // 先に自分の言葉で書き、そのあとで近いものを選ぶ(画面の見直し 所見 5、11/5 岡本さん「推奨案で」)。
  // 大項目の一覧を最初に見せない(相談者に SDGs を意識させない)。選ぶのは本人で、選ばなくても届けられる
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selected, setSelected] = useState<string[]>([])
  const [words, setWords] = useState('')
  const [since, setSince] = useState('')
  const [wish, setWish] = useState('')
  const [suggested, setSuggested] = useState<string[] | null>(null)
  const [browseAll, setBrowseAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 候補を頼んだ回の番号。戻って書き直して頼み直したとき、前の回の遅い返事で上書きしない
  const suggestTicket = useRef(0)

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])
  const textOf = (id: string) => {
    const o = byId.get(id)
    if (!o) return id
    return label(subject, o.id) ?? o.text
  }
  const urgentPicked = selected.some((id) => byId.get(id)?.urgent)
  const urgentWords = detectUrgency(words)
  const ready = words.trim().length > 0
  const full = selected.length >= MAX_INDICATOR_SELECTIONS
  const toggle = (id: string) => {
    if (selected.includes(id)) setSelected(selected.filter((x) => x !== id))
    else if (!full) setSelected([...selected, id])
  }

  const toPick = async () => {
    if (!ready) return
    setStep(2)
    setSuggested(null)
    const ticket = ++suggestTicket.current
    try {
      const text = [words, since && `${t('since')}: ${since}`, wish && `${t('wish')}: ${wish}`].filter(Boolean).join('\n')
      const res = await apiFetch<{ ids: string[] }>('/api/cases/suggest', { method: 'POST', json: { subjectType: subject, text } })
      if (ticket !== suggestTicket.current) return
      setSuggested(res.ids)
      if (res.ids.length === 0) setBrowseAll(true)
    } catch {
      if (ticket !== suggestTicket.current) return
      setSuggested([])
      setBrowseAll(true)
    }
  }

  const submit = async (organizationId?: string): Promise<boolean> => {
    if (!ready) return false
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch<{ id: string }>('/api/cases', {
        method: 'POST',
        json: {
          subjectType: subject,
          subjectOrganizationId: organizationId,
          indicators: selected,
          description: words,
          since: since.trim() || undefined,
          wish: wish.trim() || undefined,
          entryCode: entryCode ?? undefined,
        },
      })
      router.replace(`/cases/${res.id}?sent=1`)
      return true
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined
      setError(code === 'ACTIVE_LIMIT' ? t('activeLimit') : code === 'DAILY_LIMIT' ? t('dailyLimit') : t('sendFailed'))
      setBusy(false)
      return false
    }
  }

  const stepLabel = organizationStep
    ? (step === 1 ? t('step1Org') : step === 2 ? t('step2Org') : t('step3Org'))
    : (step === 1 ? t('step1') : t('step2'))
  const wordsTitle = subject === 'COMPANY' ? t('wordsTitleCompany') : subject === 'COMMUNITY' ? t('wordsTitleCommunity') : t('wordsTitle')

  return (
    <div className="flex flex-col gap-4">
      <StepBar label={stepLabel} step={step} total={organizationStep ? 3 : 2} />

      {step === 1 ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <Heading level={2}>{wordsTitle}</Heading>
            <Tip label={t('wordsTipLabel')}>{t('wordsTip')}</Tip>
          </div>
          <p className="m-0 rounded-tool bg-lamp-faint px-3 py-2 text-t12_5 font-bold text-ink-soft">{t('noPersonalInfo')}</p>
          <TextArea label={t('words')} value={words} maxLength={DESCRIPTION_MAX} onChange={(e) => setWords(e.target.value)} />
          <span className="-mt-3 self-end text-t12 text-mist">{t('charCount', { count: words.length })}</span>
          {urgentWords && <CrisisNotice country={country} />}
          <TextField label={t('since')} hint={t('optional')} value={since} maxLength={EXTRA_MAX} onChange={(e) => setSince(e.target.value)} />
          <TextField label={t('wish')} hint={t('optional')} value={wish} maxLength={EXTRA_MAX} onChange={(e) => setWish(e.target.value)} />
          <Button variant="lamp" disabled={!ready} onClick={() => void toPick()}>{ready ? t('nextToPick') : t('sendNeedsWords')}</Button>
        </>
      ) : step === 3 && organizationStep ? (
        <>
          {organizationStep({ send: submit, busy })}
          <ErrorNote>{error}</ErrorNote>
          <button type="button" onClick={() => setStep(2)} className="self-start min-h-[44px] text-t13 text-night underline">{t('backToPick')}</button>
        </>
      ) : (
        <>
          <Heading level={2}>{t('suggestTitle')}</Heading>
          <Lead>{t('suggestLead')}</Lead>
          {(urgentWords || urgentPicked) && <CrisisNotice country={country} />}
          {suggested === null ? (
            <Lead>{t('suggestLoading')}</Lead>
          ) : (
            <SuggestedOptions ids={suggested} selected={selected} onToggle={toggle} textOf={textOf} />
          )}
          {suggested !== null && suggested.length === 0 && <Lead>{t('suggestNone')}</Lead>}
          {browseAll ? (
            <IndicatorPicker options={options} selected={selected} onChange={setSelected} subject={subject} />
          ) : (
            suggested !== null && <button type="button" onClick={() => setBrowseAll(true)} className="self-start min-h-[44px] text-t13_5 font-bold text-night underline">{t('browseAll')}</button>
          )}
          <p className="m-0 text-t12_5 text-mist">{t('noneIsOkSend')}</p>
          <ErrorNote>{error}</ErrorNote>
          {organizationStep ? (
            <Button variant="night" onClick={() => { setError(null); setStep(3) }}>{t('nextToOrg')}</Button>
          ) : (
            <Button variant="night" disabled={busy} onClick={() => void submit()}>{t('send')}</Button>
          )}
          <button type="button" onClick={() => setStep(1)} className="self-start min-h-[44px] text-t13 text-night underline">{t('backToWords')}</button>
        </>
      )}
    </div>
  )
}
