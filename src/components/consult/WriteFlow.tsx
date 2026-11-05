'use client'

// 相談を書く(盤 12・12b・16)。1 ／ 2 困りごとを選ぶ → 2 ／ 2 自分の言葉で書く → 届ける
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { apiFetch, ApiError } from '@/lib/client/api'
import { detectUrgency } from '@/lib/urgency'
import { DESCRIPTION_MAX, EXTRA_MAX, optionsFor, type SubjectType } from '@/lib/domain/intake'
import { CrisisLinks } from '@/components/app/CrisisLinks'
import { Button, Card, ErrorNote, Heading, Lead, TextArea, TextField, Tip } from '@/components/app/ui'
import { IndicatorPicker, SuggestedOptions } from './IndicatorPicker'
import { indicatorMessageKey, MAX_INDICATOR_SELECTIONS } from '@/lib/constants/intakeIndicators'

// 重い言葉や緊急の選択肢に気づいたとき、その場で窓口を出す(体験ページ /trial でも使う)
export function CrisisNotice({ country }: { country?: string | null }) {
  const t = useTranslations('consult.write')
  return (
    <div role="status" className="flex flex-col gap-2 rounded-[16px] bg-coral-soft p-4">
      <span className="text-[15px] font-bold text-coral-ink">{t('crisisTitle')}</span>
      <span className="text-[13px] leading-[1.7] text-ink-soft">{t('crisisBody')}</span>
      <CrisisLinks country={country} />
    </div>
  )
}

export function WriteFlow({
  subject,
  organizationId,
  organizationName,
  country,
  entryCode,
}: {
  subject: SubjectType
  organizationId?: string
  organizationName?: string
  country: string
  entryCode?: string | null
}) {
  const t = useTranslations('consult.write')
  const tSdgs = useTranslations('sdgs')
  const router = useRouter()
  const options = useMemo(() => optionsFor(subject), [subject])
  // 先に自分の言葉で書き、そのあとで近いものを選ぶ(画面の見直し 所見 5、11/5 岡本さん「推奨案で」)。
  // 大項目の一覧を最初に見せない(相談者に SDGs を意識させない)。選ぶのは本人で、選ばなくても届けられる
  const [step, setStep] = useState<1 | 2>(1)
  const [selected, setSelected] = useState<string[]>([])
  const [words, setWords] = useState('')
  const [since, setSince] = useState('')
  const [wish, setWish] = useState('')
  const [suggested, setSuggested] = useState<string[] | null>(null)
  const [browseAll, setBrowseAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])
  const textOf = (id: string) => {
    const o = byId.get(id)
    if (!o) return id
    return subject === 'PERSON' ? tSdgs(`indicator.${indicatorMessageKey(o.id)}`) : o.text
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
    try {
      const text = [words, since && `${t('since')}: ${since}`, wish && `${t('wish')}: ${wish}`].filter(Boolean).join('\n')
      const res = await apiFetch<{ ids: string[] }>('/api/cases/suggest', { method: 'POST', json: { subjectType: subject, text } })
      setSuggested(res.ids)
      if (res.ids.length === 0) setBrowseAll(true)
    } catch {
      setSuggested([])
      setBrowseAll(true)
    }
  }

  const submit = async () => {
    if (!ready) return
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
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined
      setError(code === 'ACTIVE_LIMIT' ? t('activeLimit') : code === 'DAILY_LIMIT' ? t('dailyLimit') : t('sendFailed'))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[12px] font-bold text-mist">{step === 1 ? t('step1') : t('step2')}</span>
        <div className="flex gap-2" aria-hidden>
          <span className="h-1.5 flex-1 rounded-full bg-night" />
          <span className={`h-1.5 flex-1 rounded-full ${step === 2 ? 'bg-night' : 'bg-line'}`} />
        </div>
      </div>
      {organizationName && (
        <Card className="flex items-center justify-between gap-2 p-3">
          <span className="text-[13px] text-mist">{t('shownName')}</span>
          <span className="text-[14px] font-bold">{organizationName}</span>
        </Card>
      )}

      {step === 1 ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <Heading level={2}>{subject === 'PERSON' ? t('wordsTitle') : t('wordsTitleOrg')}</Heading>
            <Tip label={t('wordsTipLabel')}>{t('wordsTip')}</Tip>
          </div>
          <p className="m-0 rounded-tool bg-lamp-faint px-3 py-2 text-[12.5px] font-bold text-ink-soft">{t('noPersonalInfo')}</p>
          <TextArea label={t('words')} value={words} maxLength={DESCRIPTION_MAX} onChange={(e) => setWords(e.target.value)} />
          <span className="-mt-3 self-end text-[12px] text-mist">{t('charCount', { count: words.length })}</span>
          {urgentWords && <CrisisNotice country={country} />}
          <TextField label={t('since')} hint={t('optional')} value={since} maxLength={EXTRA_MAX} onChange={(e) => setSince(e.target.value)} />
          <TextField label={t('wish')} hint={t('optional')} value={wish} maxLength={EXTRA_MAX} onChange={(e) => setWish(e.target.value)} />
          <Button variant="lamp" disabled={!ready} onClick={() => void toPick()}>{ready ? t('nextToPick') : t('sendNeedsWords')}</Button>
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
            <IndicatorPicker options={options} selected={selected} onChange={setSelected} translate={subject === 'PERSON'} />
          ) : (
            suggested !== null && <button type="button" onClick={() => setBrowseAll(true)} className="self-start min-h-[44px] text-[13.5px] font-bold text-night underline">{t('browseAll')}</button>
          )}
          <p className="m-0 text-[12.5px] text-mist">{t('noneIsOkSend')}</p>
          <ErrorNote>{error}</ErrorNote>
          <Button variant="night" disabled={busy} onClick={() => void submit()}>{t('send')}</Button>
          <button type="button" onClick={() => setStep(1)} className="self-start min-h-[44px] text-[13px] text-night underline">{t('backToWords')}</button>
        </>
      )}
    </div>
  )
}
