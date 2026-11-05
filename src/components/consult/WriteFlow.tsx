'use client'

// 相談を書く(盤 12・12b・16)。1 ／ 2 困りごとを選ぶ → 2 ／ 2 自分の言葉で書く → 届ける
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { apiFetch, ApiError } from '@/lib/client/api'
import { detectUrgency } from '@/lib/urgency'
import { DESCRIPTION_MAX, EXTRA_MAX, optionsFor, type SubjectType } from '@/lib/domain/intake'
import { CrisisLinks } from '@/components/app/CrisisLinks'
import { Button, Card, ErrorNote, Heading, TextArea, TextField, Tip } from '@/components/app/ui'
import { IndicatorPicker } from './IndicatorPicker'

function CrisisNotice({ country }: { country: string }) {
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
  const router = useRouter()
  const options = useMemo(() => optionsFor(subject), [subject])
  const [step, setStep] = useState<1 | 2>(1)
  const [selected, setSelected] = useState<string[]>([])
  const [words, setWords] = useState('')
  const [since, setSince] = useState('')
  const [wish, setWish] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const urgentPicked = selected.some((id) => options.find((o) => o.id === id)?.urgent)
  const urgentWords = detectUrgency(words)
  const ready = words.trim().length > 0

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
          <Heading level={2}>{subject === 'PERSON' ? t('pickTitle') : t('pickTitleOrg')}</Heading>
          {urgentPicked && <CrisisNotice country={country} />}
          <IndicatorPicker options={options} selected={selected} onChange={setSelected} translate={subject === 'PERSON'} />
          <Button variant="lamp" onClick={() => setStep(2)} className="sticky bottom-20">{t('next')}</Button>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <Heading level={2}>{t('wordsTitle')}</Heading>
            <Tip label={t('wordsTipLabel')}>{t('wordsTip')}</Tip>
          </div>
          {selected.length > 0 && (
            <button type="button" onClick={() => setStep(1)} className="self-start text-[13px] text-night underline">{t('repick', { count: selected.length })}</button>
          )}
          <p className="m-0 rounded-tool bg-lamp-faint px-3 py-2 text-[12.5px] font-bold text-ink-soft">{t('noPersonalInfo')}</p>
          <TextArea label={t('words')} value={words} maxLength={DESCRIPTION_MAX} onChange={(e) => setWords(e.target.value)} />
          <span className="-mt-3 self-end text-[12px] text-mist">{t('charCount', { count: words.length })}</span>
          {(urgentWords || urgentPicked) && <CrisisNotice country={country} />}
          <TextField label={t('since')} hint={t('optional')} value={since} maxLength={EXTRA_MAX} onChange={(e) => setSince(e.target.value)} />
          <TextField label={t('wish')} hint={t('optional')} value={wish} maxLength={EXTRA_MAX} onChange={(e) => setWish(e.target.value)} />
          <ErrorNote>{error}</ErrorNote>
          <Button variant="night" disabled={!ready || busy} onClick={() => void submit()}>{ready ? t('send') : t('sendNeedsWords')}</Button>
        </>
      )}
    </div>
  )
}
