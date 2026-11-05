'use client'

// 支える側の札と相談の詳細で使う、地域と待っている時間の出し方(画面の見直し 所見 3)
import { useTranslations } from 'next-intl'
import type { WaitingLabel } from '@/lib/domain/schedule'
import type { SupportCaseItem } from '@/lib/server/supportCases'

// 地域は名前で出す。英語・スペイン語は英語の名前があればそれを使う。名前がないときだけ記号のまま
export function regionText(item: Pick<SupportCaseItem, 'regionCode' | 'regionName'>, locale: string): string {
  if (!item.regionName) return item.regionCode ?? ''
  return locale === 'ja' ? item.regionName.local : item.regionName.en ?? item.regionName.local
}

export function WaitingText({ wait }: { wait: WaitingLabel }) {
  const t = useTranslations('support.card')
  const text = wait.unit === 'hours' ? t('waitingHours', { value: wait.value }) : t('waitingDays', { value: wait.value })
  return <span className={wait.long ? 'font-bold text-coral' : 'text-ink-soft'}>{text}</span>
}
