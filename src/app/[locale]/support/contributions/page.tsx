'use client'

// わたしの社会貢献(盤 30)
import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { findIndicator, indicatorMessageKey } from '@/lib/constants/intakeIndicators'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Card, Chip, Heading, Lead, SectionLabel, Tip } from '@/components/app/ui'
import type { ScoreSummary } from '@/lib/domain/score'

type Payload = { summary: ScoreSummary; records: { kind: 'RESOLVED' | 'THANKS'; at: string; organization: string | null; indicators: string[]; points: number }[] }

function Contributions() {
  const t = useTranslations('support.contrib')
  const tSdgs = useTranslations('sdgs')
  const locale = useLocale()
  const [data, setData] = useState<Payload | null>(null)
  useEffect(() => { apiFetch<Payload>('/api/support/contributions').then(setData).catch(() => setData(null)) }, [])
  const label = (code: string) => (findIndicator(code) ? tSdgs(`indicator.${indicatorMessageKey(code)}`) : code)
  if (!data) return null
  const s = data.summary
  return (
    <>
      <Heading level={2}>{t('title')}</Heading>
      <Card tone="support" className="flex flex-col gap-2 p-4">
        <span className="text-[15px]">{t('resolvedCount', { count: s.resolvedCases })}</span>
        <div className="flex items-end gap-6">
          <span className="flex flex-col"><span className="text-[12px] text-mist">{t('score')}</span><span className="text-[32px] font-bold leading-none">{s.score.toLocaleString(locale)}</span></span>
          <span className="flex flex-col"><span className="text-[12px] text-mist">{t('thanks')}</span><span className="text-[24px] font-bold leading-none">{s.thanks}</span></span>
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-mist">{t('howCalculated')}<Tip label={t('formulaLabel')}>{t('formula')}</Tip></div>
      </Card>
      {Object.keys(s.byIndicator).length > 0 && (
        <Card tone="support" className="flex flex-col gap-2 p-4">
          <SectionLabel>{t('byIndicator')}</SectionLabel>
          {Object.entries(s.byIndicator).map(([code, n]) => (
            <div key={code} className="flex items-center justify-between gap-2 text-[13.5px]">
              <span><Chip color="night">{code}</Chip> {label(code)}</span><span className="font-bold">×{n}</span>
            </div>
          ))}
        </Card>
      )}
      <Card tone="support" className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between"><SectionLabel>{t('records')}</SectionLabel><Tip label={t('keepLabel')}>{t('keep')}</Tip></div>
        {data.records.length === 0 && <Lead>{t('noRecords')}</Lead>}
        {data.records.map((r, i) => (
          <div key={i} className="flex flex-col gap-0.5 border-t border-line pt-2 first:border-t-0 first:pt-0">
            <span className="text-[12px] text-mist">{r.at.slice(0, 10)}</span>
            <span className="text-[13.5px] font-bold">{r.kind === 'THANKS' ? t('thanksArrived') : t('resolvedRecord', { count: r.indicators.length })}</span>
            <span className="text-[12px] text-ink-soft">{r.organization ? t('asMemberOf', { name: r.organization }) : t('asIndividual')}</span>
          </div>
        ))}
      </Card>
      <Card tone="support" className="p-4"><Lead>{t('exportSoon')}</Lead></Card>
    </>
  )
}

export default function ContributionsPage() {
  return <RequireMe>{() => <AppFrame tone="support"><Contributions /></AppFrame>}</RequireMe>
}
