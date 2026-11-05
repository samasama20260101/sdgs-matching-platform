// 支える側の大項目(盤 21・22)。相談した人の種類(個人・会社・地域)ごとに、SDGs のゴールへ付ける名前が違う
// (依頼者の指標一覧の列D〜F。11/5 に岡本さんが「種類ごとに分ける」と決めた)。
// 単位は「相談した人の種類 × ゴール」。名前は表示だけに使い、保存と照らし合わせはこの単位で行う(名前が変わっても記録が壊れない)
import { SUPPORT_AREA_LABELS_JA } from '@/lib/constants/supportAreas.generated'

export type AreaSubject = 'PERSON' | 'COMPANY' | 'COMMUNITY'
export const AREA_SUBJECTS: readonly AreaSubject[] = ['PERSON', 'COMPANY', 'COMMUNITY']

// 種類ごとの、名前があるゴール(= その種類の相談に指標があるゴール)。表の順
export const AREA_GOALS: Record<AreaSubject, number[]> = {
  PERSON: Object.keys(SUPPORT_AREA_LABELS_JA.PERSON).map(Number).sort((a, b) => a - b),
  COMPANY: Object.keys(SUPPORT_AREA_LABELS_JA.COMPANY).map(Number).sort((a, b) => a - b),
  COMMUNITY: Object.keys(SUPPORT_AREA_LABELS_JA.COMMUNITY).map(Number).sort((a, b) => a - b),
}

export function isAreaSubject(value: unknown): value is AreaSubject {
  return typeof value === 'string' && (AREA_SUBJECTS as readonly string[]).includes(value)
}

export function hasArea(subject: AreaSubject, goal: number): boolean {
  return AREA_GOALS[subject].includes(goal)
}

// 得意なことの保存の形: "COMPANY:1"
export type AreaKey = `${AreaSubject}:${number}`

export function areaKey(subject: AreaSubject, goal: number): AreaKey {
  return `${subject}:${goal}`
}

export function parseAreaKey(value: string): { subject: AreaSubject; goal: number } | null {
  const m = /^(PERSON|COMPANY|COMMUNITY):(\d{1,2})$/.exec(value)
  if (!m) return null
  const subject = m[1] as AreaSubject
  const goal = Number(m[2])
  return hasArea(subject, goal) ? { subject, goal } : null
}

// 個人の支え手は会社と地域の相談だけを支える(個人の相談は団体を通す、11/5)。団体の一員はどれも
export function areaSubjectsForFace(kind: 'ORGANIZATION' | 'INDIVIDUAL'): AreaSubject[] {
  return kind === 'INDIVIDUAL' ? ['COMPANY', 'COMMUNITY'] : [...AREA_SUBJECTS]
}

// 画面から届いた得意なことを、知っている組み合わせと、その立場で選べる種類だけに絞る(重なりを除き、表の順に)
export function sanitizeSkillAreas(values: readonly string[], subjects: readonly AreaSubject[]): AreaKey[] {
  const picked = new Set<string>()
  for (const v of values) {
    const parsed = parseAreaKey(v)
    if (parsed && subjects.includes(parsed.subject)) picked.add(areaKey(parsed.subject, parsed.goal))
  }
  return subjects.flatMap((s) => AREA_GOALS[s].map((g) => areaKey(s, g)).filter((k) => picked.has(k)))
}

// 相談に付いた指標の番号("1.5.1" など)から、その相談の大項目(ゴール)を出す。名前のないゴールは出さない
export function caseAreaGoals(subject: AreaSubject, indicatorCodes: readonly string[]): number[] {
  const goals = new Set<number>()
  for (const code of indicatorCodes) {
    const goal = Number(code.split('.')[0])
    if (Number.isInteger(goal) && hasArea(subject, goal)) goals.add(goal)
  }
  return AREA_GOALS[subject].filter((g) => goals.has(g))
}
