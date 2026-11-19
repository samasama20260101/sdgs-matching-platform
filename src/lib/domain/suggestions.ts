// 相談に合う支援団体の提案(#138、2026-11-19 定例)。どの団体を候補にし、どう並べるかの決まり(純粋関数)。
//   - 候補は掲載台帳の民間の団体(kind = ORGANIZATION)で、相談を受けていると調べが付いたもの(accepts_consultation = YES)
//     明日もsamasama に登録済み(claim 済み)の団体は、相談そのものが届いているので出さない
//   - 自治体の窓口は出さない(定例の決定)。民間の候補が足りないときだけ、自治体でない公的な窓口(よろず支援拠点・法テラスなど)で埋める
//   - 地域: 全国で受けている団体か、相談の都道府県で受けている団体(相談者に住所は聞かない)
//   - 並べ方: AI が選んだ指標との重なり > 同じ大項目 > 電話・オンラインで受けている(加点)> 同じ都道府県
//     その上位を AI が相談の本文と見比べて 3 つに絞る。AI が使えないときはこの並びの上から 3 つ
//   - 全国の電話窓口(よりそいホットライン・189 など)は常には出さず、緊急と判定した相談にだけ出す
import { BUSINESS_WINDOW_CATEGORIES, fitsAudience, referralAudience } from './referrals'
import type { SubjectType } from './intake'

export const SUGGESTION_COUNT = 3
// AI に見比べさせる候補の数(多すぎると遅く、少なすぎると選ぶ余地がない)
export const AI_CANDIDATE_LIMIT = 12
// 緊急の相談に出す全国の窓口の数
export const EMERGENCY_HOTLINE_LIMIT = 3

// 民間の候補が足りないときに埋める、自治体でない公的な窓口の種類(よろず支援拠点・取引かけこみ寺・知財総合支援窓口・法テラス)
export const NON_MUNICIPAL_PUBLIC_CATEGORIES = [...BUSINESS_WINDOW_CATEGORIES, 'LEGAL_SUPPORT_OFFICE'] as const

export const CONSULT_CHANNELS = ['PHONE', 'ONLINE', 'EMAIL', 'FORM', 'CHAT', 'VISIT', 'OUTREACH'] as const
export type ConsultChannel = (typeof CONSULT_CHANNELS)[number]

// 18歳未満の相談に出さない対象(高齢者・事業者・地域だけを対象にしている団体)
const ADULT_ONLY_TARGETS = new Set(['ELDERLY', 'BUSINESS', 'COMMUNITY'])

export type SuggestCandidate = {
  id: string
  kind: string
  categories: string[]
  name: string
  prefectureCode: string | null
  serviceScope: string
  serviceCodes: string[]
  acceptsConsultation: string
  claimStatus: string
  indicators: string[]
  sdgsGoals: number[]
  targets: string[]
  subjects: string[]
  channels: string[]
}

export type SuggestCase = {
  subject: SubjectType
  regionCountry: string | null
  regionCode: string | null
  indicators: string[]
  isMinor: boolean
}

export type RankedCandidate = { candidate: SuggestCandidate; score: number; tier: 'ORGANIZATION' | 'PUBLIC' }

export type Suggestion = { id: string; rank: number; reason: string | null; method: 'AI' | 'RULE' }

// 指標の番号('1.2.1')の大項目(1)
export function goalOfIndicator(code: string): number | null {
  const head = Number.parseInt(code.split('.')[0] ?? '', 10)
  return Number.isInteger(head) && head >= 1 && head <= 17 ? head : null
}

export function goalsOf(indicators: readonly string[]): number[] {
  return [...new Set(indicators.map(goalOfIndicator).filter((g): g is number => g !== null))]
}

// 相談の地域で受けているか(全国・相談の都道府県)。掲載台帳は日本の団体だけなので、日本の外の相談には出さない
export function servesRegion(c: Pick<SuggestCandidate, 'serviceScope' | 'serviceCodes' | 'prefectureCode'>, k: Pick<SuggestCase, 'regionCountry' | 'regionCode'>): boolean {
  if ((k.regionCountry ?? 'JP') !== 'JP') return false
  if (c.serviceScope === 'NATIONWIDE') return true
  if (!k.regionCode) return false
  if (c.serviceScope === 'PREFECTURE') return c.serviceCodes.includes(k.regionCode) || c.prefectureCode === k.regionCode
  // 市区町村・地区の団体は、相談者の市区町村が分からないので都道府県で合わせる
  return c.prefectureCode === k.regionCode
}

// だれの相談を受けるか。調べで分かっていればそれに従い、分からなければ対象者から推す
export function fitsSubject(c: Pick<SuggestCandidate, 'subjects' | 'targets'>, subject: SubjectType): boolean {
  if (subject === 'NATION') return false
  if (c.subjects.length > 0) return c.subjects.includes(subject)
  const onlyBusiness = c.targets.length > 0 && c.targets.every((t) => t === 'BUSINESS')
  if (subject === 'PERSON') return !onlyBusiness
  if (subject === 'COMPANY') return c.targets.includes('BUSINESS')
  return c.targets.includes('COMMUNITY')
}

export function fitsAge(c: Pick<SuggestCandidate, 'targets'>, isMinor: boolean): boolean {
  if (!isMinor || c.targets.length === 0) return true
  return !c.targets.every((t) => ADULT_ONLY_TARGETS.has(t))
}

// 民間の団体として候補にできるか
export function isOrganizationCandidate(c: SuggestCandidate, k: SuggestCase): boolean {
  return c.kind === 'ORGANIZATION'
    && c.acceptsConsultation === 'YES'
    && c.claimStatus !== 'CLAIMED'
    && servesRegion(c, k)
    && fitsSubject(c, k.subject)
    && fitsAge(c, k.isMinor)
}

// 民間の候補が足りないときに埋める公的な窓口として使えるか(自治体の窓口と全国の電話窓口は使わない)
export function isPublicFallback(c: SuggestCandidate, k: SuggestCase): boolean {
  if (c.kind !== 'PUBLIC_WINDOW') return false
  if (!c.categories.some((cat) => (NON_MUNICIPAL_PUBLIC_CATEGORIES as readonly string[]).includes(cat))) return false
  return fitsAudience(c.categories, referralAudience(k.subject)) && servesRegion(c, k)
}

// 相談との近さの点数。指標も大項目も重ならなければ 0(候補にしない)
export function relevanceScore(c: Pick<SuggestCandidate, 'indicators' | 'sdgsGoals' | 'channels' | 'serviceScope' | 'prefectureCode'>, k: Pick<SuggestCase, 'indicators' | 'regionCode'>): number {
  const indicatorHits = k.indicators.filter((code) => c.indicators.includes(code)).length
  const caseGoals = goalsOf(k.indicators)
  const candidateGoals = new Set([...c.sdgsGoals, ...goalsOf(c.indicators)])
  const goalHit = caseGoals.some((g) => candidateGoals.has(g))
  if (indicatorHits === 0 && !goalHit) return 0
  let score = indicatorHits * 10 + (goalHit ? 3 : 0)
  // 電話・オンラインで受けている団体はつながりやすい(定例の決定で加点)
  if (c.channels.includes('PHONE')) score += 2
  if (c.channels.includes('ONLINE')) score += 2
  // 同じ都道府県で受けている団体を、全国の団体より少しだけ前に
  if (c.serviceScope !== 'NATIONWIDE' && k.regionCode && c.prefectureCode === k.regionCode) score += 1
  return score
}

// 候補を決まりで絞って並べる。民間の団体を先に、足りない分だけ公的な窓口を後ろに足す
export function rankCandidates(candidates: readonly SuggestCandidate[], k: SuggestCase): RankedCandidate[] {
  const seen = new Set<string>()
  const ranked: RankedCandidate[] = []
  for (const c of candidates) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    const tier = isOrganizationCandidate(c, k) ? 'ORGANIZATION' : isPublicFallback(c, k) ? 'PUBLIC' : null
    if (!tier) continue
    const score = relevanceScore(c, k)
    // 公的な窓口の埋め草も、相談の大項目と合うものだけ(命にかかわる相談に法テラスを出さない)
    if (score === 0) continue
    ranked.push({ candidate: c, score, tier })
  }
  const order = (r: RankedCandidate) => (r.tier === 'ORGANIZATION' ? 0 : 1)
  ranked.sort((a, b) => order(a) - order(b) || b.score - a.score || a.candidate.name.localeCompare(b.candidate.name, 'ja'))
  const organizations = ranked.filter((r) => r.tier === 'ORGANIZATION')
  const publics = ranked.filter((r) => r.tier === 'PUBLIC')
  return [...organizations, ...publics.slice(0, Math.max(0, SUGGESTION_COUNT - organizations.length))]
}

// AI が選んだもの(候補の中の id だけ・重なりなし)を先に、足りない分を決まりの並びで埋めて 3 つにする
export function pickSuggestions(ranked: readonly RankedCandidate[], aiPicks: readonly { id: string; reason: string | null }[] | null): Suggestion[] {
  const allowed = new Set(ranked.map((r) => r.candidate.id))
  const picked: Suggestion[] = []
  for (const p of aiPicks ?? []) {
    if (picked.length >= SUGGESTION_COUNT) break
    if (!allowed.has(p.id) || picked.some((s) => s.id === p.id)) continue
    picked.push({ id: p.id, rank: picked.length + 1, reason: p.reason, method: 'AI' })
  }
  for (const r of ranked) {
    if (picked.length >= SUGGESTION_COUNT) break
    if (picked.some((s) => s.id === r.candidate.id)) continue
    picked.push({ id: r.candidate.id, rank: picked.length + 1, reason: null, method: 'RULE' })
  }
  return picked
}

// 緊急の相談にだけ全国の電話窓口を出す。事業者向けの窓口は個人の相談に出さない(逆も)
export function emergencyHotlinesFor(subject: SubjectType, urgent: boolean): { show: boolean; audience: ReturnType<typeof referralAudience> } {
  return { show: urgent && subject === 'PERSON', audience: referralAudience(subject) }
}

// 画面に出す相談の手段(加点の対象の電話・オンラインを先に)
export function displayChannels(channels: readonly string[]): ConsultChannel[] {
  const order: ConsultChannel[] = ['PHONE', 'ONLINE', 'CHAT', 'EMAIL', 'FORM', 'VISIT', 'OUTREACH']
  return order.filter((ch) => channels.includes(ch))
}
