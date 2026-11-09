'use client'

// 呼び名・年齢・国と地域・言語(はじめの質問と「わたし」の両方で使う)。
// 名前・電話番号・住所・性別・生年月日は聞かない(盤 11)
import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { localeLabels, locales, type AppLocale } from '@/i18n/routing'
import { sortedCountries } from '@/lib/constants/countries'
import { DISPLAY_NAME_MAX, CITY_MAX } from '@/lib/validation/person'
import { needsGuardianConsent, parseAgeInput } from '@/lib/domain/age'
import { GuardianConsentNote } from './GuardianConsentNote'
import { TextField } from './ui'

export type ProfileDraft = {
  displayName: string
  age: string
  country: string
  regionCode: string
  city: string
  locale: AppLocale
}

type Region = { code: string; name_local: string; name_en: string }

export function emptyProfileDraft(locale: AppLocale): ProfileDraft {
  return { displayName: '', age: '', country: locale === 'ja' ? 'JP' : '', regionCode: '', city: '', locale }
}

export function profileDraftErrors(d: ProfileDraft) {
  const age = Number(d.age)
  return {
    displayName: d.displayName.trim().length === 0 || d.displayName.trim().length > DISPLAY_NAME_MAX,
    age: !/^\d{1,3}$/.test(d.age.trim()) || age > 130,
    country: !/^[A-Z]{2}$/.test(d.country),
  }
}

// 読んだ地域はどの国のものかと一緒に持ち、今の国のものだけを出す(国を替えた直後に前の国の地域を選ばせない)
function useRegions(country: string) {
  const [loaded, setLoaded] = useState<{ country: string; regions: Region[] }>({ country: '', regions: [] })
  useEffect(() => {
    if (!country) return
    let alive = true
    fetch(`/api/regions?country=${encodeURIComponent(country)}&level=${country === 'JP' ? 'prefecture' : 'province'}`)
      .then((r) => (r.ok ? r.json() : { regions: [] }))
      .then((d: { regions?: Region[] }) => { if (alive) setLoaded({ country, regions: d.regions ?? [] }) })
      .catch(() => { if (alive) setLoaded({ country, regions: [] }) })
    return () => { alive = false }
  }, [country])
  return loaded.country === country ? loaded.regions : []
}

export function ProfileFields({ draft, onChange, showErrors }: { draft: ProfileDraft; onChange: (d: ProfileDraft) => void; showErrors: boolean }) {
  const t = useTranslations('app.profile')
  const uiLocale = useLocale()
  const countries = useMemo(() => sortedCountries(uiLocale), [uiLocale])
  const regions = useRegions(draft.country)
  const errors = profileDraftErrors(draft)
  const set = (patch: Partial<ProfileDraft>) => onChange({ ...draft, ...patch })
  // 打っている途中(「30」の「3」)で案内が出たり消えたりしないよう、欄を離れてから出す
  const [ageFocused, setAgeFocused] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label={t('displayName')}
        hint={t('displayNameHint')}
        value={draft.displayName}
        maxLength={DISPLAY_NAME_MAX}
        autoComplete="nickname"
        onChange={(e) => set({ displayName: e.target.value })}
        error={showErrors && errors.displayName ? t('displayNameError') : null}
      />
      <TextField
        label={t('age')}
        hint={t('ageHint')}
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft.age}
        maxLength={3}
        onChange={(e) => set({ age: e.target.value.replace(/[^0-9]/g, '') })}
        error={showErrors && errors.age ? t('ageError') : null}
        className="max-w-[160px]"
        onFocus={() => setAgeFocused(true)}
        onBlur={() => setAgeFocused(false)}
      />
      {!ageFocused && needsGuardianConsent(parseAgeInput(draft.age)) && <GuardianConsentNote />}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold">{t('country')}</span>
        <select
          value={draft.country}
          onChange={(e) => set({ country: e.target.value, regionCode: '' })}
          className="min-h-[48px] rounded-tool border-[1.5px] border-line-strong bg-paper px-3 text-[16px]"
          aria-invalid={showErrors && errors.country ? true : undefined}
        >
          <option value="">{t('choose')}</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        {showErrors && errors.country && <span className="text-[12.5px] text-coral">{t('countryError')}</span>}
      </label>
      {regions.length > 0 && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold">{t('region')}<span className="ml-1 text-[11.5px] font-normal text-mist">{t('optional')}</span></span>
          <select
            value={draft.regionCode}
            onChange={(e) => set({ regionCode: e.target.value })}
            className="min-h-[48px] rounded-tool border-[1.5px] border-line-strong bg-paper px-3 text-[16px]"
          >
            <option value="">{t('choose')}</option>
            {regions.map((r) => <option key={r.code} value={r.code}>{uiLocale === 'ja' ? r.name_local : r.name_en}</option>)}
          </select>
        </label>
      )}
      <TextField
        label={t('city')}
        hint={t('optional')}
        value={draft.city}
        maxLength={CITY_MAX}
        onChange={(e) => set({ city: e.target.value })}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold">{t('language')}</span>
        <select
          value={draft.locale}
          onChange={(e) => set({ locale: e.target.value as AppLocale })}
          className="min-h-[48px] rounded-tool border-[1.5px] border-line-strong bg-paper px-3 text-[16px]"
        >
          {locales.map((l) => <option key={l} value={l}>{localeLabels[l]}</option>)}
        </select>
      </label>
    </div>
  )
}

export function draftToPayload(d: ProfileDraft) {
  return {
    displayName: d.displayName,
    age: Number(d.age),
    country: d.country,
    regionCode: d.regionCode || null,
    city: d.city.trim() || null,
    locale: d.locale,
  }
}
