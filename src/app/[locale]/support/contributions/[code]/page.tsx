'use client'

// 指標を世界の中で見る(11/12 定例。引き続き考えることの 3。数の意味は src/lib/domain/score.ts の冒頭)。
// 起こりうる最大・いま困っている人・明日もsamasama で解決した相談・目標(ゼロ)を1枚の図と数で並べる。
// 「解決を、世界の大きさまで積み上げる」はインサイドアウト、「困りごとを、世界からなくす」はアウトサイドイン
// (SDG Compass の考え方。代表が共有)。図の円の大きさは数の比ではない(解決した数は小さすぎて見えなくなるため)
import { useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { useLoad } from '@/lib/client/useLoad'
import { findIndicator, indicatorMessageKey } from '@/lib/constants/intakeIndicators'
import { Link } from '@/i18n/navigation'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Card, Chip, cx, ErrorNote, Heading, Lead, Tip } from '@/components/app/ui'
import type { WorldCount, WorldPopulation } from '@/lib/domain/worldCount'

type Payload = {
  code: string
  resolved: { count: number; growth: { month: number; year: number } }
  mine: number
  facing: WorldCount | null
  possible: WorldPopulation
}

// 図の輪の色と、下の数の印の色をそろえる
const SWATCH = {
  possible: 'bg-steel border border-line-strong',
  facing: 'bg-lamp-soft border border-dawn',
  facingUnknown: 'bg-paper border border-dashed border-dawn',
  resolved: 'bg-night',
  goal: 'bg-leaf-soft border border-leaf',
}

function Diagram({ hasFacing }: { hasFacing: boolean }) {
  const t = useTranslations('support.world')
  return (
    <svg viewBox="0 0 320 236" role="img" aria-label={t('diagramLabel')} className="h-auto w-full">
      <circle cx="160" cy="118" r="112" fill="var(--color-steel)" stroke="var(--color-line-strong)" />
      <circle cx="160" cy="150" r="78" fill={hasFacing ? 'var(--color-lamp-soft)' : 'var(--color-paper)'} stroke="var(--color-dawn)" strokeDasharray={hasFacing ? undefined : '5 4'} />
      <circle cx="160" cy="184" r="42" fill="var(--color-night)" />
      <text x="160" y="42" textAnchor="middle" className="fill-ink-soft text-t12 font-bold">{t('possibleRing')}</text>
      <text x="160" y="100" textAnchor="middle" className="fill-dawn-ink text-t12 font-bold">{t('facingRing')}</text>
      {!hasFacing && <text x="160" y="116" textAnchor="middle" className="fill-dawn-ink text-t11">{t('facingUnknownRing')}</text>}
      <text x="160" y="174" textAnchor="middle" className="fill-white text-t11 font-bold">{t('resolvedRing1')}</text>
      <text x="160" y="189" textAnchor="middle" className="fill-white text-t11 font-bold">{t('resolvedRing2')}</text>
      <text x="160" y="204" textAnchor="middle" className="fill-lamp text-t11 font-bold">{t('resolvedRing3')}</text>
    </svg>
  )
}

function Row({ swatch, title, value, note }: { swatch: string; title: string; value: string; note?: string }) {
  return (
    <div className="flex items-start gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
      <span className={cx('mt-1 h-4 w-4 shrink-0 rounded-full', swatch)} aria-hidden />
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
            <Diagram hasFacing={data.facing !== null} />
            <div className="flex flex-col gap-2 rounded-tool bg-steel-faint p-3 text-t12_5 leading-[1.7]">
              <span><strong>{t('insideOutTitle')}</strong><br />{t('insideOut')}</span>
              <span><strong>{t('outsideInTitle')}</strong><br />{t('outsideIn')}</span>
            </div>
          </Card>
          <Card tone="support" className="flex flex-col p-4">
            <Row swatch={SWATCH.possible} title={t('possibleTitle')} value={t('people', { value: big(data.possible.value) })} note={t('possibleNote', { year: data.possible.year, source: data.possible.source, full: data.possible.value.toLocaleString(locale) })} />
            {data.facing ? (
              <Row swatch={SWATCH.facing} title={t('facingTitle')} value={t('people', { value: big(data.facing.value) })} note={t(`facingNote.${data.facing.method}`, { year: data.facing.year, source: data.facing.source, full: data.facing.value.toLocaleString(locale) })} />
            ) : (
              <Row swatch={SWATCH.facingUnknown} title={t('facingTitle')} value={t('facingUnknown')} note={t('facingUnknownNote')} />
            )}
            <Row swatch={SWATCH.resolved} title={t('resolvedTitle')} value={t('cases', { count: data.resolved.count })} note={`${t('growth', { month: data.resolved.growth.month, year: data.resolved.growth.year })} ・ ${t('mine', { count: data.mine })}`} />
            <Row swatch={SWATCH.goal} title={t('goalTitle')} value={t('goalValue')} note={t('goalNote')} />
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
