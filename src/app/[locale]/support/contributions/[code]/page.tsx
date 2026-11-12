'use client'

// 指標を世界の中で見る(11/12 定例。引き続き考えることの 3)。
// z(世界で最大限に広がったとき)・n(今の世界)・m(明日もsamasama で解決した数)・0(目標)を1枚の図にする。
// 「m を z に近づける」はインサイドアウト、「z を 0 にする」はアウトサイドイン(SDG Compass の考え方。代表が共有)。
// 図の円の大きさは数の比ではない(m は z に比べて小さすぎて見えなくなるため)
import { useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { useLoad } from '@/lib/client/useLoad'
import { findIndicator, indicatorMessageKey } from '@/lib/constants/intakeIndicators'
import { Link } from '@/i18n/navigation'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Card, Chip, ErrorNote, Heading, Lead, Tip } from '@/components/app/ui'
import type { WorldCount, WorldPopulation } from '@/lib/domain/worldCount'

type Payload = { code: string; world: { m: number; growth: { month: number; year: number } }; mine: number; n: WorldCount | null; z: WorldPopulation }

function Diagram({ hasN }: { hasN: boolean }) {
  const t = useTranslations('support.world')
  return (
    <svg viewBox="0 0 320 236" role="img" aria-label={t('diagramLabel')} className="h-auto w-full">
      <circle cx="160" cy="118" r="112" fill="var(--color-steel)" stroke="var(--color-line-strong)" />
      <circle cx="160" cy="150" r="78" fill={hasN ? 'var(--color-lamp-soft)' : 'var(--color-paper)'} stroke="var(--color-dawn)" strokeDasharray={hasN ? undefined : '5 4'} />
      <circle cx="160" cy="194" r="30" fill="var(--color-night)" />
      <text x="160" y="34" textAnchor="middle" className="fill-ink-soft text-t12 font-bold">z</text>
      <text x="160" y="50" textAnchor="middle" className="fill-ink-soft text-t11">{t('zShort')}</text>
      <text x="160" y="100" textAnchor="middle" className="fill-dawn-ink text-t12 font-bold">n</text>
      <text x="160" y="116" textAnchor="middle" className="fill-dawn-ink text-t11">{hasN ? t('nShort') : t('nUnknownShort')}</text>
      <text x="160" y="192" textAnchor="middle" className="fill-white text-t12 font-bold">m</text>
      <text x="160" y="207" textAnchor="middle" className="fill-lamp text-t10_5">{t('mShort')}</text>
    </svg>
  )
}

function Row({ letter, title, value, note, tone = 'steel' }: { letter: string; title: string; value: string; note?: string; tone?: 'steel' | 'dawn' | 'night' | 'leaf' }) {
  const badge = { steel: 'bg-steel text-ink-soft', dawn: 'bg-dawn-soft text-dawn-ink', night: 'bg-night text-lamp', leaf: 'bg-leaf-soft text-leaf-ink' }[tone]
  return (
    <div className="flex items-start gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-t14 font-bold ${badge}`} aria-hidden>{letter}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-t12_5 text-mist">{title}</span>
        <span className="text-t18 font-bold leading-tight">{value}</span>
        {note && <span className="text-t12 leading-[1.6] text-ink-soft">{note}</span>}
      </div>
    </div>
  )
}

function World() {
  const { code } = useParams<{ code: string }>()
  const t = useTranslations('support.world')
  const tSdgs = useTranslations('sdgs')
  const locale = useLocale()
  const fetcher = useCallback(() => apiFetch<Payload>(`/api/support/indicators/${encodeURIComponent(code)}`), [code])
  const { data, error } = useLoad(fetcher)
  const big = (v: number) => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(v)
  const label = findIndicator(code) ? tSdgs(`indicator.${indicatorMessageKey(code)}`) : null
  return (
    <>
      <Link href="/support/contributions" className="text-t13 font-bold text-night no-underline">‹ {t('back')}</Link>
      <div className="flex flex-col gap-1">
        <span><Chip color="night">{code}</Chip></span>
        <Heading level={2}>{label ?? code}</Heading>
      </div>
      {!data ? (error ? <ErrorNote>{t('loadFailed')}</ErrorNote> : null) : (
        <>
          <Card tone="support" className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-t15 font-bold">{t('title')}</span>
              <Tip label={t('aboutLabel')}>{t('about')}</Tip>
            </div>
            <Diagram hasN={data.n !== null} />
            <div className="flex flex-col gap-2 rounded-tool bg-steel-faint p-3 text-t12_5 leading-[1.7]">
              <span><strong>{t('insideOutTitle')}</strong> {t('insideOut')}</span>
              <span><strong>{t('outsideInTitle')}</strong> {t('outsideIn')}</span>
            </div>
          </Card>
          <Card tone="support" className="flex flex-col p-4">
            <Row letter="z" title={t('zTitle')} value={t('people', { value: big(data.z.value) })} note={t('zNote', { year: data.z.year, source: data.z.source, full: data.z.value.toLocaleString(locale) })} />
            {data.n ? (
              <Row letter="n" tone="dawn" title={t('nTitle')} value={t('people', { value: big(data.n.value) })} note={t(`nNote.${data.n.method}`, { year: data.n.year, source: data.n.source, full: data.n.value.toLocaleString(locale) })} />
            ) : (
              <Row letter="n" tone="dawn" title={t('nTitle')} value={t('nUnknown')} note={t('nUnknownNote')} />
            )}
            <Row letter="m" tone="night" title={t('mTitle')} value={t('cases', { count: data.world.m })} note={`${t('growth', { month: data.world.growth.month, year: data.world.growth.year })} ・ ${t('mine', { count: data.mine })}`} />
            <Row letter="0" tone="leaf" title={t('zeroTitle')} value={t('zeroValue')} note={t('zeroNote')} />
          </Card>
          <Lead className="px-1 text-t12">{t('footnote')}</Lead>
        </>
      )}
    </>
  )
}

export default function WorldPage() {
  return <RequireMe>{() => <AppFrame tone="support"><World /></AppFrame>}</RequireMe>
}
