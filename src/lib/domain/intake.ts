// 相談の受付の決まり(純粋関数。API と画面の両方で使う)。
//   - 主体ごとに選べる選択肢が違う(個人 = 114、会社・地域 = 代表の指標一覧の B・C 版)
//   - 選べるのは3つまで。0 個でもよい(自分の言葉だけで届けられる)
//   - 緊急: 選択肢の緊急の印か、自由記述の緊急の言葉(AI では決めない)
//   - 機微: 指標の印と18歳未満(src/lib/domain/sensitivity.ts)
//   - 対象の人数: 個人は 1、会社・地域は団体が登録した人数(スコアの「人口」)
import { INTAKE_INDICATORS, MAX_INDICATOR_SELECTIONS } from '@/lib/constants/intakeIndicators'
import { COMMUNITY_INTAKE_INDICATORS, COMPANY_INTAKE_INDICATORS, NATION_INTAKE_INDICATORS } from '@/lib/constants/orgIntakeIndicators.generated'
import { detectUrgency } from '@/lib/urgency'
import { deriveSensitivity } from './sensitivity'

export type SubjectType = 'PERSON' | 'COMPANY' | 'COMMUNITY' | 'NATION'
export const OPEN_SUBJECTS: readonly SubjectType[] = ['PERSON', 'COMPANY', 'COMMUNITY']

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

export type IntakeAssessment = {
  urgency: 'High' | 'Medium'
  isMinor: boolean
  isSensitive: boolean
  sensitiveReasons: string[]
  affectedPopulation: number
}

export function assessIntake(input: {
  subject: SubjectType
  indicatorIds: string[]
  text: string
  personIsMinor: boolean
  organizationPopulation: number | null
}): IntakeAssessment {
  const urgent = urgentCodes()
  const options = new Map(optionsFor(input.subject).map((o) => [o.id, o]))
  const urgentByIndicator = input.indicatorIds.some((id) => Boolean(options.get(id)?.urgent) || (input.subject === 'PERSON' && urgent.has(id)))
  // 会社・地域の相談では、相談する担当者の年齢で「18歳未満の相談」にしない(相談の持ち主は団体)
  const isMinor = input.subject === 'PERSON' && input.personIsMinor
  const sensitivity = deriveSensitivity({ indicatorCodes: input.indicatorIds, urgentCodes: urgent, isMinor })
  const population = input.subject === 'PERSON' ? 1 : Math.max(1, Math.floor(input.organizationPopulation ?? 1))
  return {
    urgency: urgentByIndicator || detectUrgency(input.text) ? 'High' : 'Medium',
    isMinor,
    isSensitive: sensitivity.isSensitive,
    sensitiveReasons: sensitivity.reasons,
    affectedPopulation: population,
  }
}

// AI の整理が届く前の仮の題(選んだ1つ目の文言か、本文の書き出し)
export function provisionalTitle(subject: SubjectType, indicatorIds: string[], text: string): string {
  const first = optionsFor(subject).find((o) => o.id === indicatorIds[0])
  const base = first?.text ?? text.replace(/\s+/g, ' ').trim()
  return base.length > 40 ? `${base.slice(0, 40)}…` : base
}

// 相談所コード(本屋などの QR)。英数字とハイフンだけ、32 字まで
export function sanitizeEntryCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return /^[A-Za-z0-9-]{1,32}$/.test(v) ? v : null
}
