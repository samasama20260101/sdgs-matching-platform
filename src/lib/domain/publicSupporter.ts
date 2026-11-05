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

// 団体が登録した SNS などのリンク。http(s) の URL か、X・Instagram はアカウント名(@ 付きでもよい)だけを受ける。
// javascript: などを href に入れないため、組み立てに失敗したものは出さない。LINE の ID はリンクにせず文字で出す
export type PublicSocialLink = { kind: 'website' | 'x' | 'instagram' | 'facebook' | 'line'; href: string | null; label: string }

function httpUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

const HANDLE = /^@?([A-Za-z0-9_.]{1,30})$/

function account(value: string, base: string): { href: string; label: string } | null {
  if (/^https?:\/\//i.test(value)) {
    const href = httpUrl(value)
    return href ? { href, label: '' } : null
  }
  const m = HANDLE.exec(value)
  return m ? { href: `${base}${m[1]}`, label: `@${m[1]}` } : null
}

export function publicSocialLinks(raw: unknown): PublicSocialLink[] {
  if (!raw || typeof raw !== 'object') return []
  const v = raw as Record<string, unknown>
  const str = (k: string) => (typeof v[k] === 'string' ? (v[k] as string).trim() : '')
  const links: PublicSocialLink[] = []
  const website = str('website') && httpUrl(str('website'))
  if (website) links.push({ kind: 'website', href: website, label: '' })
  const x = str('twitter') && account(str('twitter'), 'https://x.com/')
  if (x) links.push({ kind: 'x', ...x })
  const ig = str('instagram') && account(str('instagram'), 'https://instagram.com/')
  if (ig) links.push({ kind: 'instagram', ...ig })
  const facebook = str('facebook') && httpUrl(str('facebook'))
  if (facebook) links.push({ kind: 'facebook', href: facebook, label: '' })
  const line = str('line')
  if (line && line.length <= 40) links.push({ kind: 'line', href: null, label: line })
  return links
}

// 見ている人の地域で活動する団体(全国を含む)を先に並べる。並びはそれ以外は元のまま
export function regionFirst<T extends { nationwide: boolean; areas: { region_code: string }[] }>(list: T[], regionCode: string | null): { items: T[]; matched: Set<T> } {
  if (!regionCode) return { items: list, matched: new Set() }
  const matched = new Set(list.filter((s) => s.nationwide || s.areas.some((a) => a.region_code === regionCode)))
  return { items: [...list.filter((s) => matched.has(s)), ...list.filter((s) => !matched.has(s))], matched }
}
