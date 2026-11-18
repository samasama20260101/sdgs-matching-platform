// 相談の受付の決まり(純粋関数。API と画面の両方で使う)。
//   - 主体ごとに分類に使う選択肢が違う(個人 = 115、会社・地域 = 代表の指標一覧の B・C 版)
//   - 相談者は選ばない。届けるときに AI が選択肢から3つまで選び、大項目はその指標からサーバーが決める(#133)
//   - 緊急: 書いた言葉の緊急の言葉が下限。AI の判定と、AI が選んだ指標の緊急の印は上げる方向にだけ効く
//   - 機微: 書いた言葉と18歳未満が下限。AI は上げる方向だけで、AI が使えないときは機微(src/lib/domain/sensitivity.ts)
//   - 対象の人数: 個人は 1、会社・地域は登録した人数(スコアの「人口」)
import { INTAKE_INDICATORS, MAX_INDICATOR_SELECTIONS, indicatorMessageKey } from '@/lib/constants/intakeIndicators'
import { COMMUNITY_INTAKE_INDICATORS, COMPANY_INTAKE_INDICATORS, NATION_INTAKE_INDICATORS } from '@/lib/constants/orgIntakeIndicators.generated'
import { detectUrgency } from '@/lib/urgency'
import { deriveSensitivity, raiseSensitivityWithAi, type SensitiveReason } from './sensitivity'

export type SubjectType = 'PERSON' | 'COMPANY' | 'COMMUNITY' | 'NATION'

export type IntakeOption = { id: string; category: number; text: string; urgent?: boolean }

export const DESCRIPTION_MAX = 2000
export const EXTRA_MAX = 500

export function optionsFor(subject: SubjectType): IntakeOption[] {
  switch (subject) {
    case 'PERSON':
      return INTAKE_INDICATORS
    case 'COMPANY':
      return COMPANY_INTAKE_INDICATORS
    case 'COMMUNITY':
      return COMMUNITY_INTAKE_INDICATORS
    case 'NATION':
      return NATION_INTAKE_INDICATORS
  }
}

export function urgentCodes(): Set<string> {
  return new Set(INTAKE_INDICATORS.filter((i) => i.urgent).map((i) => i.id))
}

export function sanitizeSelection(subject: SubjectType, ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const allowed = new Set(optionsFor(subject).map((o) => o.id))
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && allowed.has(id)))].slice(0, MAX_INDICATOR_SELECTIONS)
}

// 会社・地域として相談できる団体の種類(盤 05b・05c)。地域は自治体の課や町内会など(規模は問わない、11/5)
export function canConsultAs(subject: SubjectType, orgType: string): boolean {
  if (subject === 'COMPANY') return orgType === 'COMPANY'
  if (subject === 'COMMUNITY') return orgType === 'MUNICIPALITY' || orgType === 'COMMUNITY'
  return false
}

// 届けるときの AI の分類(src/lib/server/caseAi.ts)のうち、判定に使うところ。ok: false は AI が使えなかったとき
export type IntakeAi = { ok: true; indicatorIds: readonly string[]; urgent: boolean; sensitive: boolean } | { ok: false }

export type IntakeAssessment = {
  // 分類に使う指標(AI が選び、その主体の選択肢にあるものだけ。3つまで)
  indicatorIds: string[]
  urgency: 'High' | 'Medium'
  isMinor: boolean
  isSensitive: boolean
  sensitiveReasons: SensitiveReason[]
  affectedPopulation: number
}

function hasUrgentIndicator(subject: SubjectType, indicatorIds: readonly string[]): boolean {
  const urgent = urgentCodes()
  const options = new Map(optionsFor(subject).map((o) => [o.id, o]))
  return indicatorIds.some((id) => Boolean(options.get(id)?.urgent) || (subject === 'PERSON' && urgent.has(id)))
}

// 緊急度。書いた言葉が下限で、AI の判定と AI が選んだ指標の緊急の印は上げる方向にだけ効く
export function deriveUrgency(input: { urgentWords: boolean; aiUrgent: boolean; urgentIndicator: boolean }): 'High' | 'Medium' {
  return input.urgentWords || input.aiUrgent || input.urgentIndicator ? 'High' : 'Medium'
}

export function assessIntake(input: {
  subject: SubjectType
  text: string
  personIsMinor: boolean
  organizationPopulation: number | null
  ai: IntakeAi
}): IntakeAssessment {
  const indicatorIds = input.ai.ok ? sanitizeSelection(input.subject, input.ai.indicatorIds) : []
  const urgentWords = detectUrgency(input.text)
  // 会社・地域の相談では、相談する担当者の年齢で「18歳未満の相談」にしない(相談の持ち主は会社・地域)
  const isMinor = input.subject === 'PERSON' && input.personIsMinor
  const sensitivity = deriveSensitivity({
    urgentWords,
    isMinor,
    urgentCodes: urgentCodes(),
    ai: input.ai.ok ? { ok: true, indicatorCodes: indicatorIds, sensitive: input.ai.sensitive } : { ok: false },
  })
  const population = input.subject === 'PERSON' ? 1 : Math.max(1, Math.floor(input.organizationPopulation ?? 1))
  return {
    indicatorIds,
    urgency: deriveUrgency({ urgentWords, aiUrgent: input.ai.ok && input.ai.urgent, urgentIndicator: hasUrgentIndicator(input.subject, indicatorIds) }),
    isMinor,
    isSensitive: sensitivity.isSensitive,
    sensitiveReasons: sensitivity.reasons,
    affectedPopulation: population,
  }
}

// 届いたときに AI が使えなかった相談を、あとで分類し直すとき(毎日の処理)。緊急度と機微は上げる方向だけ。
// 分類に使う指標は、まだないときだけ AI の選んだものにする(v2 の初めに本人が選んだ相談は、本人の選んだものを残す)
export function raiseWithAi(input: {
  subject: SubjectType
  currentIndicatorIds: readonly string[]
  urgency: string | null
  reasons: readonly SensitiveReason[]
  ai: { indicatorIds: readonly string[]; urgent: boolean; sensitive: boolean }
}): { indicatorIds: string[]; aiIndicatorIds: string[]; urgency: 'High' | 'Medium'; isSensitive: boolean; sensitiveReasons: SensitiveReason[] } {
  const aiIndicatorIds = sanitizeSelection(input.subject, input.ai.indicatorIds)
  const indicatorIds = input.currentIndicatorIds.length > 0 ? [...input.currentIndicatorIds] : aiIndicatorIds
  const sensitivity = raiseSensitivityWithAi(input.reasons, { indicatorCodes: aiIndicatorIds, sensitive: input.ai.sensitive }, urgentCodes())
  return {
    indicatorIds,
    aiIndicatorIds,
    urgency: input.urgency === 'High' ? 'High' : deriveUrgency({ urgentWords: false, aiUrgent: input.ai.urgent, urgentIndicator: hasUrgentIndicator(input.subject, aiIndicatorIds) }),
    isSensitive: sensitivity.isSensitive,
    sensitiveReasons: sensitivity.reasons,
  }
}

// AI の題がないときの仮の題(分類した1つ目の文言か、本文の書き出し)
export function provisionalTitle(subject: SubjectType, indicatorIds: string[], text: string): string {
  const first = optionsFor(subject).find((o) => o.id === indicatorIds[0])
  return shortTitle(first?.text ?? text)
}

// 題にする長さ(40 字)に縮める
export function shortTitle(text: string): string {
  const base = text.replace(/\s+/g, ' ').trim()
  return base.length > 40 ? `${base.slice(0, 40)}…` : base
}

// 選択肢の文言の訳のキー(messages/<言語>/sdgs.json)。個人は indicator、会社・地域は orgIndicator.<主体>。
// 国の選択肢は相談の入口がまだないので訳を持たない(null なら定数の日本語を出す)
export function indicatorLabelKey(subject: SubjectType, id: string): string | null {
  if (!optionsFor(subject).some((o) => o.id === id)) return null
  const key = indicatorMessageKey(id)
  if (subject === 'PERSON') return `indicator.${key}`
  if (subject === 'COMPANY' || subject === 'COMMUNITY') return `orgIndicator.${subject}.${key}`
  return null
}

// 画面に出す相談の題。保存してある題(仮の題も AI の題も)は日本語なので、
// 日本語の画面ではそのまま、ほかの言語では「分類した1つ目の指標の訳」か「本人の言葉の書き出し」にする(2026-11-06 代表の Staging での指摘)。
// 支える側は ownWords を渡さない(本人の言葉は訳ではないので、指標がなければ保存してある題のまま)。
// 相談者の画面には AI が選んだ指標を出さない(相談者に SDGs を意識させない)ので、firstIndicatorLabel は本人が選んだ v2 の初めの相談だけ
export function caseTitle(input: { locale: string; savedTitle: string; firstIndicatorLabel: string | null; ownWords: string | null }): string {
  if (input.locale === 'ja') return input.savedTitle
  return input.firstIndicatorLabel ?? (input.ownWords ? shortTitle(input.ownWords) : input.savedTitle)
}

// AI に渡す相談文の並び(本文 → いつから → どうしたいか)。届けるときの分類(caseAi)と体験ページ(/trial)で同じものを使う。
// 見出しは AI 向けなので、画面の言語にかかわらず日本語
export function caseBodyForAi(input: { description: string | null; since?: string | null; wish?: string | null }): string {
  const since = input.since?.trim()
  const wish = input.wish?.trim()
  return [input.description?.trim(), since ? `いつから: ${since}` : '', wish ? `どうしたいか: ${wish}` : ''].filter(Boolean).join('\n')
}

// 相談所コード(本屋などの QR)。英数字とハイフンだけ、32 字まで
export function sanitizeEntryCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return /^[A-Za-z0-9-]{1,32}$/.test(v) ? v : null
}
