// 待つあいだの近くの窓口(盤 13)を、だれの相談かで分ける(純粋関数)。
// 個人の窓口(よりそいホットラインなど)を会社の相談に出さず、事業者の窓口を個人の相談に出さない(2026-11-06 代表)。
// 窓口の種類の名前は directory_entries.categories と同じ(正本は directory-data の mappings/window-types.yaml)
import type { SubjectType } from './intake'

// 中小企業・小規模事業者の相談の窓口(よろず支援拠点・取引かけこみ寺・知財総合支援窓口)
export const BUSINESS_WINDOW_CATEGORIES = ['YOROZU_SUPPORT_CENTER', 'TRADE_DISPUTE_HOTLINE', 'IP_SUPPORT_HOTLINE'] as const

export type ReferralAudience =
  | { kind: 'only'; categories: readonly string[] }
  | { kind: 'except'; categories: readonly string[] }
  | { kind: 'none' }

// 地域・国として相談したときに合う窓口は、まだ集めていない(出さない)
export function referralAudience(subject: SubjectType): ReferralAudience {
  switch (subject) {
    case 'PERSON':
      return { kind: 'except', categories: BUSINESS_WINDOW_CATEGORIES }
    case 'COMPANY':
      return { kind: 'only', categories: BUSINESS_WINDOW_CATEGORIES }
    case 'COMMUNITY':
    case 'NATION':
      return { kind: 'none' }
  }
}

// 窓口がその相談に出せるか(種類のどれか1つが合えば出す)
export function fitsAudience(categories: readonly string[], audience: ReferralAudience): boolean {
  if (audience.kind === 'none') return false
  const hit = categories.some((c) => audience.categories.includes(c))
  return audience.kind === 'only' ? hit : !hit
}
