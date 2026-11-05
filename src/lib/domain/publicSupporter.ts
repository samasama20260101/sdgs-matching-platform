// 公開の団体一覧・団体ページ・お知らせの団体の札で使う決まり(純粋関数。セキュリティと dead-code のレビュー 11/5)。
// v2 で登録した団体は org_type だけを持ち、v1 の supporter_type を持たない。公開の画面の種別(4 つ)に写して出す
export type PublicSupporterType = 'NPO' | 'CORPORATE' | 'GOVERNMENT' | 'OTHER'

const FROM_ORG_TYPE: Record<string, PublicSupporterType> = {
  NPO: 'NPO',
  NGO: 'NPO',
  INTERMEDIARY: 'NPO',
  COMPANY: 'CORPORATE',
  MUNICIPALITY: 'GOVERNMENT',
  NATIONAL_AGENCY: 'GOVERNMENT',
  OTHER_PUBLIC: 'GOVERNMENT',
  COMMUNITY: 'OTHER',
  SCHOOL: 'OTHER',
  PRO_BONO_LAWYER: 'OTHER',
  OTHER: 'OTHER',
}
const V1_TYPES = new Set<string>(['NPO', 'CORPORATE', 'GOVERNMENT', 'OTHER'])

export function publicSupporterType(supporterType: string | null | undefined, orgType: string | null | undefined): PublicSupporterType {
  if (supporterType && V1_TYPES.has(supporterType)) return supporterType as PublicSupporterType
  return (orgType && FROM_ORG_TYPE[orgType]) || 'OTHER'
}

// 支え手として載せる団体か。会社・地域として相談するために登録した団体(application.purpose = CONSULT)は載せない。
// v1 から移った団体は purpose を持たない(v1 の団体はすべて支え手)
export function isSupporterPurpose(application: unknown): boolean {
  if (!application || typeof application !== 'object') return true
  return (application as { purpose?: unknown }).purpose !== 'CONSULT'
}
