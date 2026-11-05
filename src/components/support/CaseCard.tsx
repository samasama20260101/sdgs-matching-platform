'use client'

// 支える側の相談の札(盤 20・22)。実線の札は相談した人が選んだ指標、点線は AI の候補(運営が確かめる前)
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Card, Chip, cx } from '@/components/app/ui'
import type { SupportCaseItem } from '@/lib/server/supportCases'

export function CaseCard({ item, face }: { item: SupportCaseItem; face: string }) {
  const t = useTranslations('support.card')
  const tSdgs = useTranslations('sdgs')
  if (item.locked) {
    return (
      <Card tone="support" className="flex flex-col gap-1 p-3.5">
        <span className="text-[14px] font-bold text-mist">{t('locked')}</span>
        <span className="text-[12px] text-mist">{t('lockedNote')}</span>
      </Card>
    )
  }
  const long = item.waitingHours >= 24
  return (
    <Link href={`/support/cases/${item.id}?face=${encodeURIComponent(face)}`} className="no-underline">
      <Card tone="support" className="flex flex-col gap-2 p-3.5 text-ink">
        <span className="text-[14.5px] font-bold leading-[1.5]">{item.title}</span>
        {/* 大項目は相談した人の種類ごとの名前で出す(src/lib/domain/supportAreas.ts) */}
        {item.areaGoals.length > 0 && (
          <span className="text-[12px] font-bold text-ink-soft">{item.areaGoals.map((g) => tSdgs(`area.${item.subjectType}.${g}`)).join(' / ')}</span>
        )}
        <span className="flex flex-wrap gap-1">
          {item.indicators.map((i) => (
            <span key={`${i.source}-${i.code}`} className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold', i.source === 'SELF' ? 'bg-night text-white' : 'border-[1.5px] border-dashed border-mist-light text-ink-soft')}>
              {i.source === 'AI' ? 'AI ' : ''}{i.code}
            </span>
          ))}
          {item.urgent && <Chip color="coral">{t('urgent')}</Chip>}
          {item.isMinor && <Chip color="lamp">{t('minor')}</Chip>}
          {item.isSensitive && <Chip color="coral">{t('sensitive')}</Chip>}
          {item.subjectType !== 'PERSON' && <Chip>{item.subjectType === 'COMPANY' ? t('company') : t('community')}</Chip>}
          {item.regionCode && <Chip>{item.regionCode}</Chip>}
          {item.language !== 'ja' && <Chip>{t('language', { lang: item.language })}</Chip>}
        </span>
        <span className="flex items-center justify-between text-[12px]">
          <span className={long ? 'font-bold text-coral' : 'text-ink-soft'}>{t('waiting', { hours: item.waitingHours })}</span>
          <span className="text-mist">{item.myOfferStatus ? t(`mine.${item.myOfferStatus}`) : t('offers', { count: item.offersCount })}</span>
        </span>
      </Card>
    </Link>
  )
}
