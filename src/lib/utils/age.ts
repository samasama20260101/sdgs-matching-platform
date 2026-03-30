// src/lib/utils/age.ts
// 年齢・未成年判定ユーティリティ（SDGs基準: 18歳未満）

export function isMinor(birthDate: string | null | undefined): boolean {
  if (!birthDate) return false
  const birth = new Date(birthDate)
  if (isNaN(birth.getTime())) return false
  const today = new Date()
  const age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  const dayDiff = today.getDate() - birth.getDate()
  const adjustedAge = (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) ? age - 1 : age
  return adjustedAge < 18
}
