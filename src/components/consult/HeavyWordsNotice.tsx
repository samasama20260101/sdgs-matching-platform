'use client'

// 書く画面・体験ページで重い言葉に気づいたときに、その場で出す言葉。
// よりそいホットライン・119・110 の窓口は並べない(2026-11-23 代表の要望で外した。#160)。
// 緊急と判定した個人の相談では、届けたあとの「合いそうな支援団体」に AI が分野の全国の電話窓口(DV相談ナビ・189 など)を入れることがある
import { useTranslations } from 'next-intl'

export function HeavyWordsNotice() {
  const t = useTranslations('consult.write')
  return (
    <div role="status" className="flex flex-col gap-2 rounded-[16px] bg-coral-soft p-4">
      <span className="text-t15 font-bold text-coral-ink">{t('crisisTitle')}</span>
      <span className="text-t13 leading-[1.7] text-ink-soft">{t('crisisBody')}</span>
    </div>
  )
}
