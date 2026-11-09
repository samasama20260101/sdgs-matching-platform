'use client'

// 16歳未満の方への、保護者の同意の案内(規約 第2条6項)。同意の中身なので、対象の人には押さなくても読める形で出す
import { useTranslations } from 'next-intl'

export function GuardianConsentNote() {
  const t = useTranslations('app.guardian')
  return (
    <div role="note" className="flex flex-col gap-1 rounded-tool bg-lamp-faint p-4">
      <span className="text-[13.5px] font-bold">{t('title')}</span>
      <span className="text-[12.5px] leading-[1.7] text-ink-soft">{t('body')}</span>
    </div>
  )
}
