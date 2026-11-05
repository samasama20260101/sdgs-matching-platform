// はじめの質問と「わたし」の変更の入力(純粋。API と画面の両方で使う)
import { z } from 'zod'
import { MAX_AGE } from '@/lib/domain/age'
import { locales } from '@/i18n/routing'
import { isCountryCode } from '@/lib/constants/countries'

export const DISPLAY_NAME_MAX = 20
export const CITY_MAX = 40

// 規約・ポリシーの版。案文の改定(盤 70〜73)が決まったら上げる。上がると、次に入ったときに同意し直してもらう
export const CURRENT_TERMS_VERSION = '2026-11-v2-draft'
export const CURRENT_PRIVACY_VERSION = '2026-11-v2-draft'
export const CURRENT_SUPPORTER_TERMS_VERSION = '2026-11-v2-draft'

const displayName = z
  .string()
  .transform((v) => v.normalize('NFKC').replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(1).max(DISPLAY_NAME_MAX))

const country = z.string().regex(/^[A-Z]{2}$/).refine(isCountryCode)
const regionCode = z.string().regex(/^[A-Z]{2}-[0-9A-Z]{1,3}$/).nullable().optional()
const city = z
  .string()
  .transform((v) => v.normalize('NFKC').trim())
  .pipe(z.string().max(CITY_MAX))
  .nullable()
  .optional()
const age = z.number().int().min(0).max(MAX_AGE)
const locale = z.enum(locales)

export const onboardingSchema = z.object({
  displayName,
  age,
  country,
  regionCode,
  city,
  locale,
  acceptTerms: z.literal(true),
})
export type OnboardingInput = z.infer<typeof onboardingSchema>

export const profileUpdateSchema = z
  .object({ displayName, age, country, regionCode, city, locale })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'empty' })
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
