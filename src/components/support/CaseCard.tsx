'use client'

// 支える側の相談の札(盤 20・22)。大項目(ゴールの番号と種類ごとの名前)・印・地域・待っている時間。指標の中身は詳細で出す
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Card, Chip } from '@/components/app/ui'
import type { SupportCaseItem } from '@/lib/server/supportCases'
import { waitingLabel } from '@/lib/domain/schedule'
import { regionText, WaitingText } from './caseText'

export function CaseCard({ item, face }: { item: SupportCaseItem; face: string }) {
  const t = useTranslations('support.card')
  const tSdgs = useTranslations('sdgs')
  const locale = useLocale()
  if (item.locked) {
    return (
      <Card tone="support" className="flex flex-col gap-1 p-3.5">
        <span className="text-t14 font-bold text-mist">{t('locked')}</span>
        <span className="text-t12 text-mist">{t('lockedNote')}</span>
      </Card>
    )
  }
  const wait = waitingLabel(item.waitingHours)
  return (
    <Link href={`/support/cases/${item.id}?face=${encodeURIComponent(face)}`} className="no-underline">
      <Card tone="support" className="flex flex-col gap-2 p-3.5 text-ink">
        <span className="text-t14_5 font-bold leading-[1.5]">{item.title}</span>
        <span className="flex flex-wrap gap-1">
          {/* 大項目はゴールの番号と、相談した人の種類ごとの名前で出す(支える側には SDGs を前に出す)。
              指標の番号は札に出さず、相談の詳細で中身と一緒に出す(画面の見直し 所見 3) */}
          {item.areaGoals.map((g) => (
            <span key={g} className="inline-flex items-center gap-1 rounded-full bg-night px-2 py-0.5 text-t11_5 font-bold text-white">
              <span aria-hidden className="opacity-80">{g}</span>{tSdgs(`area.${item.subjectType}.${g}`)}
            </span>
          ))}
          {item.urgent && <Chip color="coral">{t('urgent')}</Chip>}
          {item.isMinor && <Chip color="lamp">{t('minor')}</Chip>}
          {item.isSensitive && <Chip color="coral">{t('sensitive')}</Chip>}
          {item.subjectType !== 'PERSON' && <Chip>{item.subjectType === 'COMPANY' ? t('company') : t('community')}</Chip>}
          {item.regionCode && <Chip>{regionText(item, locale)}</Chip>}
          {item.language !== 'ja' && <Chip>{t('language', { lang: item.language })}</Chip>}
        </span>
        <span className="flex items-center justify-between text-t12">
          <WaitingText wait={wait} />
          <span className="text-mist">{item.myOfferStatus ? t(`mine.${item.myOfferStatus}`) : t('offers', { count: item.offersCount })}</span>
        </span>
      </Card>
    </Link>
  )
}
