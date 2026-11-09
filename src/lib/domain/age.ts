// 年齢(11/5 定例): 生年月日は持たず、登録したときの年齢を入れてもらい、その日を基準に1年ごとに進める。
// 本人が直したら、その日を新しい基準日にする。日付は 'YYYY-MM-DD'(暦の日。時刻と時差を持ち込まない)。

export const ADULT_AGE = 18
// この年齢より下は、保護者の同意を原則にする(規約 第2条6項。改正個人情報保護法の「16歳未満」に合わせる)
export const GUARDIAN_CONSENT_UNDER_AGE = 16
// 支える側(個人の支え手・団体の一員・コーディネーター)として活動できる年齢(2026-11-06 代表。どの国でも同じ)
export const SUPPORTER_MIN_AGE = 18
export const MAX_AGE = 130

function parseDay(value: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

// 基準日から today までに迎えた「基準日の記念日」の数(2/29 は平年では 2/28 の翌日=3/1 に進める)
export function fullYearsBetween(baseDate: string, today: string): number {
  const a = parseDay(baseDate)
  const b = parseDay(today)
  if (!a || !b) return 0
  let years = b.y - a.y
  if (b.m < a.m || (b.m === a.m && b.d < a.d)) years -= 1
  return Math.max(0, years)
}

export function currentAge(ageYears: number | null | undefined, baseDate: string | null | undefined, today: string): number | null {
  if (ageYears === null || ageYears === undefined || !baseDate) return null
  return Math.min(MAX_AGE, ageYears + fullYearsBetween(baseDate, today))
}

// 年齢が分からない人は、未成年として扱わない(はじめの質問で必ず聞くので、v1 から来た人だけが当たる)
export function isMinorAge(age: number | null): boolean {
  return age !== null && age < ADULT_AGE
}

export function needsGuardianConsent(age: number | null): boolean {
  return age !== null && age < GUARDIAN_CONSENT_UNDER_AGE
}

// 年齢が分からない人は止めない(isMinorAge と同じく、はじめの質問で必ず聞くので v1 から来た人だけが当たる)
export function canSupportAtAge(age: number | null): boolean {
  return age === null || age >= SUPPORTER_MIN_AGE
}

export function parseAgeInput(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d{1,3}$/.test(value.trim()) ? Number(value.trim()) : NaN
  if (!Number.isInteger(n) || n < 0 || n > MAX_AGE) return null
  return n
}

// 日本時間の暦の日(サーバーは UTC で動くため)
export function todayInTokyo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
