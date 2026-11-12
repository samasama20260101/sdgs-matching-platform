'use client'

// わたしの社会貢献(盤 30)。11/12 の定例で、関わった解決した相談の数(m)をいちばん大きく出し、
// 指標ごとの数から「世界の中で見る」へつなぐ形にした。人口を掛けるスコアは出さない。ありがとうは別に数える
import { useLocale, useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { useLoad } from '@/lib/client/useLoad'
import { findIndicator, indicatorMessageKey } from '@/lib/constants/intakeIndicators'
import { Link } from '@/i18n/navigation'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Card, Chip, ErrorNote, Heading, Lead, SectionLabel, Tip } from '@/components/app/ui'
import type { RecordSummary } from '@/lib/domain/score'

type Payload = { summary: RecordSummary; records: { kind: 'RESOLVED' | 'THANKS'; at: string; organization: string | null; indicators: string[] }[] }

const fetchContributions = () => apiFetch<Payload>('/api/support/contributions')

function Contributions() {
  const t = useTranslations('support.contrib')
  const tSdgs = useTranslations('sdgs')
  const locale = useLocale()
  const { data, error } = useLoad(fetchContributions)
  const label = (code: string) => (findIndicator(code) ? tSdgs(`indicator.${indicatorMessageKey(code)}`) : code)
  if (!data) return error ? <ErrorNote>{t('loadFailed')}</ErrorNote> : null
  const s = data.summary
  return (
    <>
      <Heading level={2}>{t('title')}</Heading>
      <Card tone="support" className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-t13 font-bold text-mist">{t('mLabel')}</span>
          <Tip label={t('howCountedLabel')}>{t('howCounted')}</Tip>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-t32 font-bold leading-none">{s.resolvedCases.toLocaleString(locale)}</span>
          <span className="text-t15 font-bold">{t('unit')}</span>
        </div>
        <span className="text-t12_5 text-ink-soft">{t('growth', { month: s.growth.month, year: s.growth.year })}</span>
        <div className="flex items-baseline gap-2 border-t border-line pt-3">
          <span className="text-t12_5 text-mist">{t('thanks')}</span>
          <span className="text-t24 font-bold leading-none">{s.thanks.toLocaleString(locale)}</span>
        </div>
      </Card>
      {Object.keys(s.byIndicator).length > 0 && (
        <Card tone="support" className="flex flex-col gap-1 p-4">
          <SectionLabel>{t('byIndicator')}</SectionLabel>
          <span className="px-1 text-t12 text-mist">{t('worldHint')}</span>
          {Object.entries(s.byIndicator).map(([code, n]) => (
            <Link key={code} href={`/support/contributions/${code}`} className="flex min-h-[48px] items-center justify-between gap-2 border-t border-line text-t13_5 text-ink no-underline first-of-type:border-t-0">
              <span className="min-w-0"><Chip color="night">{code}</Chip> {label(code)}</span>
              <span className="flex shrink-0 items-center gap-2 font-bold">{t('perIndicator', { count: n })}<span aria-hidden className="text-night">›</span></span>
            </Link>
          ))}
        </Card>
      )}
      <Card tone="support" className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between"><SectionLabel>{t('records')}</SectionLabel><Tip label={t('keepLabel')}>{t('keep')}</Tip></div>
        {data.records.length === 0 && <Lead>{t('noRecords')}</Lead>}
        {data.records.map((r, i) => (
          <div key={i} className="flex flex-col gap-0.5 border-t border-line pt-2 first:border-t-0 first:pt-0">
            <span className="text-t12 text-mist">{r.at.slice(0, 10)}</span>
            <span className="text-t13_5 font-bold">{r.kind === 'THANKS' ? t('thanksArrived') : t('resolvedRecord', { count: r.indicators.length })}</span>
            <span className="text-t12 text-ink-soft">{r.organization ? t('asMemberOf', { name: r.organization }) : t('asIndividual')}</span>
          </div>
        ))}
      </Card>
    </>
  )
}

export default function ContributionsPage() {
  return <RequireMe>{() => <AppFrame tone="support"><Contributions /></AppFrame>}</RequireMe>
}
