'use client'

// 活動地域を選ぶ(全国か、地域を 1 つ以上)。支援団体の申し込み(必ず選ぶ、#140)と、団体のページの「活動地域を変える」で使う。
// 地域はその国の地域(日本は都道府県)。nationwide が null のあいだは、どちらもまだ選んでいない
import { useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useLoad } from '@/lib/client/useLoad'
import { cx, Spinner } from '@/components/app/ui'
import { regionLevelFor } from '@/lib/domain/serviceAreas'

export type AreaChoice = { nationwide: boolean | null; regionCodes: string[] }
export type Region = { code: string; name_local: string; name_en: string }

// 選び終えているか(全国、または地域を 1 つ以上)
export function isAreaChoiceComplete(v: AreaChoice): v is { nationwide: boolean; regionCodes: string[] } {
  return v.nationwide === true || (v.nationwide === false && v.regionCodes.length > 0)
}

export function useRegions(country: string) {
  const fetchRegions = useCallback(
    () => fetch(`/api/regions?country=${encodeURIComponent(country)}&level=${regionLevelFor(country)}`)
      .then((r) => (r.ok ? r.json() : { regions: [] }))
      .then((d: { regions?: Region[] }) => d.regions ?? []),
    [country],
  )
  return useLoad(fetchRegions).data
}

export function ServiceAreaPicker({ country, value, onChange, label }: { country: string; value: AreaChoice; onChange: (v: AreaChoice) => void; label: string }) {
  const t = useTranslations('support.org')
  const locale = useLocale()
  const regions = useRegions(country)
  const toggle = (code: string) => onChange({ ...value, regionCodes: value.regionCodes.includes(code) ? value.regionCodes.filter((c) => c !== code) : [...value.regionCodes, code] })
  const choice = (on: boolean, text: string, onClick: () => void) => (
    <button type="button" role="radio" aria-checked={on} onClick={onClick}
      className={cx('min-h-[44px] flex-1 rounded-tool px-3 text-t13_5 font-bold', on ? 'bg-night text-white' : 'border border-line bg-paper text-ink-soft')}>
      {text}
    </button>
  )
  const needOne = value.nationwide === false && value.regionCodes.length === 0
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label={label} className="flex gap-1.5">
        {choice(value.nationwide === true, t('areasNationwide'), () => onChange({ ...value, nationwide: true }))}
        {choice(value.nationwide === false, t('areasPick'), () => onChange({ ...value, nationwide: false }))}
      </div>
      {value.nationwide === false && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(regions ?? []).map((r) => (
              <button key={r.code} type="button" aria-pressed={value.regionCodes.includes(r.code)} onClick={() => toggle(r.code)}
                className={cx('min-h-[36px] rounded-full px-3 text-t12_5 font-bold', value.regionCodes.includes(r.code) ? 'bg-night text-white' : 'border border-line bg-paper text-ink-soft')}>
                {locale === 'ja' ? r.name_local : r.name_en}
              </button>
            ))}
            {!regions && <Spinner />}
          </div>
          <span className={cx('text-t12_5', needOne ? 'text-coral' : 'text-mist')}>{needOne ? t('areasNeedOne') : t('areasPicked', { count: value.regionCodes.length })}</span>
        </>
      )}
    </div>
  )
}
