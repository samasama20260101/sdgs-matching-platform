// 相談に合う支援団体の提案(#138、2026-11-19 定例)。どの団体を候補にし、どう並べるかの決まり(純粋関数)。
//   - 候補は掲載台帳の民間の団体(kind = ORGANIZATION)で、相談を受けていると調べが付いたもの(accepts_consultation = YES)
//     明日もsamasama に登録済み(claim 済み)の団体は、相談そのものが届いているので出さない
//   - 営利の会社(org_type = COMPANY)は、提案に入れるかを決めるまで出さない(弁護士会の相談センターは出す)
//   - 自治体の窓口は出さない(定例の決定)。民間の候補が足りないときだけ、自治体でない公的な窓口(よろず支援拠点・法テラスなど)で埋める
//   - 地域: 全国から選ぶ(2026-11-19 定例「範囲は全国で、優先の高いものから 3 つ」、#148)。同じ都道府県・全国の団体は手段を問わず、
//     ほかの都道府県の団体は遠隔(電話・オンライン・チャット・メール・フォーム)で相談を受けているものだけ(来所だけの遠い団体は行けないので出さない)
//   - 並べ方: AI が選んだ指標との重なり・相談文と団体の要約の意味の近さ(埋め込み、#148)> 同じ大項目 > 電話・オンライン(加点)> 同じ都道府県
//     その上位を AI が相談の本文と見比べて 3 つに絞る。AI が使えないときはこの並びの上から 3 つ
//   - 全国の電話窓口(DV相談ナビ・189 など)は常には出さず、緊急と判定した個人の相談でだけ AI に候補として見せる
//     (どれが合うかは AI が相談と見比べて選ぶ。決まりの並びでは埋めない。よりそいホットライン・119・110 は相談の画面の上に別に出る)
import { BUSINESS_WINDOW_CATEGORIES, fitsAudience, referralAudience } from './referrals'
import type { SubjectType } from './intake'

export const SUGGESTION_COUNT = 3
// AI に見比べさせる候補の数(多すぎると遅く、少なすぎると選ぶ余地がない)
export const AI_CANDIDATE_LIMIT = 12

// 民間の候補が足りないときに埋める、自治体でない公的な窓口の種類(よろず支援拠点・取引かけこみ寺・知財総合支援窓口・法テラス)
export const NON_MUNICIPAL_PUBLIC_CATEGORIES = [...BUSINESS_WINDOW_CATEGORIES, 'LEGAL_SUPPORT_OFFICE'] as const

export const CONSULT_CHANNELS = ['PHONE', 'ONLINE', 'EMAIL', 'FORM', 'CHAT', 'VISIT', 'OUTREACH'] as const
// 離れた所からでも相談できる手段(ほかの都道府県の団体を候補にする条件)
export const REMOTE_CHANNELS = ['PHONE', 'ONLINE', 'CHAT', 'EMAIL', 'FORM'] as const
export type ConsultChannel = (typeof CONSULT_CHANNELS)[number]

// 提案に入れるかを決めるまで出さない法人格(営利の会社。2026-11-19 の Issue #138 の論点)
const EXCLUDED_ORG_TYPES = new Set(['COMPANY'])

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
  orgType: string | null
  indicators: string[]
  sdgsGoals: number[]
  targets: string[]
  subjects: string[]
  channels: string[]
  // 相談文と団体の要約の埋め込みの近さ(コサイン類似度)。意味の検索で引いていなければ null
  similarity?: number | null
}

export type SuggestCase = {
  subject: SubjectType
  regionCountry: string | null
  regionCode: string | null
  indicators: string[]
  isMinor: boolean
  // 緊急と判定した相談(全国の電話窓口を AI に見せる)
  urgent: boolean
}

export type RankedCandidate = { candidate: SuggestCandidate; score: number; tier: 'ORGANIZATION' | 'PUBLIC' | 'HOTLINE' }

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

// その地域の人や会員のための組織(弁護士会・商工会議所・社会福祉協議会・地域の労働組合・都道府県の産業支援機関など)。
// 電話で受けていても、ほかの都道府県の相談者の相談先にはならない(相談の例で、東京の会社の相談に仙台弁護士会が出た。#148)
const LOCAL_MEMBERSHIP_NAME = /(弁護士会|司法書士会|行政書士会|社会保険労務士会|税理士会|土地家屋調査士会|商工会議所|商工会|中小企業団体中央会|社会福祉協議会|社会福祉協会|労働組合|ユニオン|産業振興|産業支援|経営者協会)/u
export function isLocalMembershipBody(c: Pick<SuggestCandidate, 'name' | 'orgType'>): boolean {
  return c.orgType === 'BAR_ASSOCIATION' || LOCAL_MEMBERSHIP_NAME.test(c.name.normalize('NFKC'))
}

// 相談者が連絡して相談できるか: 相談の地域で受けている団体か、ほかの都道府県でも遠隔の手段で相談を受けている団体
// (ほかの都道府県の地域の会員組織は除く)。
// 掲載台帳は日本の団体だけなので、日本の外の相談には出さない
export function reachable(c: Pick<SuggestCandidate, 'serviceScope' | 'serviceCodes' | 'prefectureCode' | 'channels' | 'name' | 'orgType'>, k: Pick<SuggestCase, 'regionCountry' | 'regionCode'>): boolean {
  if ((k.regionCountry ?? 'JP') !== 'JP') return false
  if (servesRegion(c, k)) return true
  if (isLocalMembershipBody(c)) return false
  return c.channels.some((ch) => (REMOTE_CHANNELS as readonly string[]).includes(ch))
}

// だれの相談を受けるか。調べで分かっていればそれに従い、分からなければ対象者から推す。
// 地域(町内会・自治体の課など)の相談は、地域の相談を受ける団体に加えて、個人の相談を受ける団体も候補にする
// (子ども食堂の立ち上げや見守りの相談は、個人やグループの相談として受けている団体が多い。#148)
export function fitsSubject(c: Pick<SuggestCandidate, 'subjects' | 'targets'>, subject: SubjectType): boolean {
  if (subject === 'NATION') return false
  const onlyBusiness = c.targets.length > 0 && c.targets.every((t) => t === 'BUSINESS')
  if (c.subjects.length > 0) {
    if (subject === 'COMMUNITY') return c.subjects.includes('COMMUNITY') || c.subjects.includes('PERSON')
    return c.subjects.includes(subject)
  }
  if (subject === 'PERSON') return !onlyBusiness
  if (subject === 'COMPANY') return c.targets.includes('BUSINESS')
  return c.targets.includes('COMMUNITY') || !onlyBusiness
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
    && !EXCLUDED_ORG_TYPES.has(c.orgType ?? '')
    && reachable(c, k)
    && fitsSubject(c, k.subject)
    && fitsAge(c, k.isMinor)
}

// 民間の候補が足りないときに埋める公的な窓口として使えるか(自治体の窓口は使わない)。
// 全国の電話窓口は、事業者向け(取引かけこみ寺・知財総合支援窓口)だけを埋め草にする
export function isPublicFallback(c: SuggestCandidate, k: SuggestCase): boolean {
  const businessHotline = c.kind === 'NATIONAL_HOTLINE' && c.categories.some((cat) => (BUSINESS_WINDOW_CATEGORIES as readonly string[]).includes(cat))
  if (c.kind !== 'PUBLIC_WINDOW' && !businessHotline) return false
  if (!c.categories.some((cat) => (NON_MUNICIPAL_PUBLIC_CATEGORIES as readonly string[]).includes(cat))) return false
  return fitsAudience(c.categories, referralAudience(k.subject)) && servesRegion(c, k)
}

// 緊急と判定した個人の相談で、AI に見せる全国の電話窓口か(事業者向けは除く)
export function isUrgentHotline(c: SuggestCandidate, k: SuggestCase): boolean {
  return k.urgent && k.subject === 'PERSON' && c.kind === 'NATIONAL_HOTLINE'
    && fitsAudience(c.categories, referralAudience(k.subject)) && servesRegion(c, k)
}

// 意味の近さがこれ以上なら、指標が重ならなくても候補にする。相談の例 30 件(text-embedding-3-small)で、合う団体は 0.33〜0.50、
// 合わない団体はおおむね 0.30 未満だった(重なりはあるので、最後は AI が相談と見比べて選ぶ)。モデルを替えたら測り直す
export const SEMANTIC_MIN = 0.3
// 意味の近さの点数の重み(近さ 0.30 で 3 点、0.50 で 3 + 0.2 × 40 = 11 点。指標 1 つの重なり 10 点と同じくらい)
const SEMANTIC_WEIGHT = 40
// ほかの都道府県の団体を後ろにする減点(指標 1 つの重なりより少し小さく、合い方の差が大きければ前に出られる)
const FAR_PENALTY = 8

// 意味の近さの点数(SEMANTIC_MIN 未満は 0)
export function semanticScore(similarity: number | null | undefined): number {
  if (typeof similarity !== 'number' || !Number.isFinite(similarity) || similarity < SEMANTIC_MIN) return 0
  return 3 + Math.round((similarity - SEMANTIC_MIN) * SEMANTIC_WEIGHT)
}

// 相談との近さの点数。指標も大項目も重ならず、意味も遠ければ 0(候補にしない)
export function relevanceScore(c: Pick<SuggestCandidate, 'indicators' | 'sdgsGoals' | 'channels' | 'serviceScope' | 'serviceCodes' | 'prefectureCode' | 'similarity'>, k: Pick<SuggestCase, 'indicators' | 'regionCode'>): number {
  const indicatorHits = k.indicators.filter((code) => c.indicators.includes(code)).length
  const caseGoals = goalsOf(k.indicators)
  const candidateGoals = new Set([...c.sdgsGoals, ...goalsOf(c.indicators)])
  const goalHit = caseGoals.some((g) => candidateGoals.has(g))
  const semantic = semanticScore(c.similarity)
  if (indicatorHits === 0 && !goalHit && semantic === 0) return 0
  let score = indicatorHits * 10 + (goalHit ? 3 : 0) + semantic
  // 電話・オンラインで受けている団体はつながりやすい(定例の決定で加点)
  if (c.channels.includes('PHONE')) score += 2
  if (c.channels.includes('ONLINE')) score += 2
  // 同じ都道府県で受けている団体を、全国の団体やほかの都道府県の団体より少しだけ前に
  if (c.serviceScope !== 'NATIONWIDE' && k.regionCode && c.prefectureCode === k.regionCode) score += 1
  // ほかの都道府県の団体(遠隔で受けているので候補には入る)は、同じ都道府県・全国の団体より後ろに。
  // 地元の団体を先に出すため(相談の例で、地元の弁護士会より遠くの弁護士会が先に出た。#148)
  if (!servesRegion(c, { regionCountry: 'JP', regionCode: k.regionCode })) score = Math.max(1, score - FAR_PENALTY)
  return score
}

// 同じ団体かを名前で見るための鍵(法人格・空白・全角半角の違いを除く)。出典が違うと同じ団体が別の行になることがある。
// 支援団体の登録で掲載台帳の行を探すときも同じ鍵を使う(#140)。DB の directory_entries.name_key(migrations/v2_17)も同じ作りにしてある
export const LEGAL_FORM_NAMES = ['特定非営利活動法人', '認定特定非営利活動法人', '認定NPO法人', 'NPO法人', '一般社団法人', '公益社団法人', '一般財団法人', '公益財団法人', '社会福祉法人', '社会福祉協議会法人'] as const
const LEGAL_FORMS = new RegExp(`(${LEGAL_FORM_NAMES.join('|')})`, 'gu')
export function nameKey(name: string): string {
  return name.normalize('NFKC').replace(LEGAL_FORMS, '').replace(/[\s・()（）「」『』]/gu, '').toLowerCase()
}

// 候補を決まりで絞って並べる。民間の団体を先に、足りない分だけ公的な窓口を後ろに足す。同じ名前の団体は 1 つにする
export function rankCandidates(candidates: readonly SuggestCandidate[], k: SuggestCase): RankedCandidate[] {
  const seen = new Set<string>()
  const scored: RankedCandidate[] = []
  for (const c of candidates) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    const tier = isOrganizationCandidate(c, k) ? 'ORGANIZATION' : isPublicFallback(c, k) ? 'PUBLIC' : isUrgentHotline(c, k) ? 'HOTLINE' : null
    if (!tier) continue
    const score = relevanceScore(c, k)
    // 埋め草の公的な窓口も相談の大項目と合うものだけ(命にかかわる相談に法テラスを出さない)。
    // ただし会社の相談の事業者向けの窓口は、指標が付かなくても出す(経営の相談はどれも受けるため)。
    // 緊急の電話窓口は大項目で絞らず、AI が相談と見比べて選ぶ
    const businessForCompany = tier === 'PUBLIC' && k.subject === 'COMPANY' && c.categories.some((cat) => (BUSINESS_WINDOW_CATEGORIES as readonly string[]).includes(cat))
    if (score === 0 && !businessForCompany && tier !== 'HOTLINE') continue
    scored.push({ candidate: c, score, tier })
  }
  const order = (r: RankedCandidate) => (r.tier === 'ORGANIZATION' ? 0 : r.tier === 'PUBLIC' ? 1 : 2)
  scored.sort((a, b) => order(a) - order(b) || b.score - a.score || a.candidate.name.localeCompare(b.candidate.name, 'ja'))
  const names = new Set<string>()
  const ranked = scored.filter((r) => {
    const key = nameKey(r.candidate.name)
    if (names.has(key)) return false
    names.add(key)
    return true
  })
  const organizations = ranked.filter((r) => r.tier === 'ORGANIZATION')
  const publics = ranked.filter((r) => r.tier === 'PUBLIC')
  const hotlines = ranked.filter((r) => r.tier === 'HOTLINE')
  return [...organizations, ...publics.slice(0, Math.max(0, SUGGESTION_COUNT - organizations.length)), ...hotlines]
}

// AI が選んだもの(候補の中の id だけ・重なりなし)を先に並べる。
// AI が選んだときは、AI が合わないと見た民間の団体で埋めず、足りない分は公的な窓口(大項目の合うもの)だけで埋める。
// AI が使えなかったときは決まりの並びの上から 3 つ。緊急の電話窓口は AI が選んだときだけ出す
export function pickSuggestions(ranked: readonly RankedCandidate[], aiPicks: readonly { id: string; reason: string | null }[] | null): Suggestion[] {
  const allowed = new Set(ranked.map((r) => r.candidate.id))
  const picked: Suggestion[] = []
  for (const p of aiPicks ?? []) {
    if (picked.length >= SUGGESTION_COUNT) break
    if (!allowed.has(p.id) || picked.some((s) => s.id === p.id)) continue
    picked.push({ id: p.id, rank: picked.length + 1, reason: p.reason, method: 'AI' })
  }
  const fill = aiPicks === null ? ranked.filter((r) => r.tier !== 'HOTLINE') : ranked.filter((r) => r.tier === 'PUBLIC')
  for (const r of fill) {
    if (picked.length >= SUGGESTION_COUNT) break
    if (picked.some((s) => s.id === r.candidate.id)) continue
    picked.push({ id: r.candidate.id, rank: picked.length + 1, reason: null, method: 'RULE' })
  }
  return picked
}

// 画面に出す相談の手段(加点の対象の電話・オンラインを先に)
export function displayChannels(channels: readonly string[]): ConsultChannel[] {
  const order: ConsultChannel[] = ['PHONE', 'ONLINE', 'CHAT', 'EMAIL', 'FORM', 'VISIT', 'OUTREACH']
  return order.filter((ch) => channels.includes(ch))
}
