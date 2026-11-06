// 相談の選択肢の文言を、画面の言語で出す。訳がない選択肢(国)は定数の日本語のまま
import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { indicatorLabelKey, optionsFor, type SubjectType } from '@/lib/domain/intake'

export function useIndicatorLabel(): (subject: SubjectType, id: string) => string | null {
  const t = useTranslations('sdgs')
  return useCallback(
    (subject: SubjectType, id: string) => {
      const key = indicatorLabelKey(subject, id)
      if (key && t.has(key)) return t(key)
      return optionsFor(subject).find((o) => o.id === id)?.text ?? null
    },
    [t],
  )
}
