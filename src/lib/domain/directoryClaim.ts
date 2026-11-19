// 支援団体の登録で、掲載台帳(directory_entries)の行と支援団体を結ぶ決まり(純粋関数、#140。2026-11-19 定例)。
//   - 登録のとき、団体名(と分かれば法人番号)から掲載台帳の民間の団体を探し、名前の近い順に 5 つまで「この団体でしょうか」と出す
//     名前は提案と同じ鍵(nameKey: 法人格・空白・全角半角の違いを除く)で比べ、部分一致を拾う。法人番号が一致すれば一番上
//   - 選ばれたら、申し込み(organizations.application)に行の id を残すだけ。結ぶのは運営が承認したとき
//     (面談で本人の団体かを確かめる前に結ぶと、名の知れた団体を名乗る申し込みで行を取られてしまう)
//   - 承認で行を支援団体に結び(claim_status = CLAIMED・claimed_organization_id)、行の名前・活動地域を登録の内容に合わせる。
//     法人番号は行に無いときだけ足す。出典の列(source_*・license・attribution)と、出典から調べた列(電話・住所・相談の受け方など)は残す
//   - 結んだ行は、相談に合う支援団体の提案(#138)に出さない(相談そのものが届くため。suggestions.ts の isOrganizationCandidate)
import { nameKey } from './suggestions'

export const CLAIM_CANDIDATE_LIMIT = 5
// これより短い名前では探さない(1 文字だと、ほとんどの団体が当たる)
export const CLAIM_QUERY_MIN_LENGTH = 2
// 入れた名前の中に行の名前が入っている(支部の名前で登録したなど)の向きで拾う、行の名前の長さの下限
export const CLAIM_REVERSE_MIN_LENGTH = 3

// 申し込み(organizations.application)の中で、選んだ掲載台帳の行を置くキー。画面から送られた答えでは上書きさせない
export const DIRECTORY_ENTRY_KEY = 'directoryEntryId'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ClaimQuery = { key: string; corporateNumber: string | null }

export type ClaimCandidateRow = {
  id: string
  name: string
  corporateNumber: string | null
  prefectureCode: string | null
  websiteUrl: string | null
}

// 法人番号(13 けた)。全角の数字・空白・ハイフンは許し、それ以外の形は使わない
export function normalizeCorporateNumber(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.normalize('NFKC').replace(/[\s-]/gu, '')
  return /^\d{13}$/.test(digits) ? digits : null
}

export function claimQuery(name: string | null | undefined, corporateNumber: string | null | undefined): ClaimQuery {
  return { key: nameKey(name ?? ''), corporateNumber: normalizeCorporateNumber(corporateNumber) }
}

// 探せる問い合わせか(名前が短すぎず、または法人番号がある)
export function isSearchableQuery(q: ClaimQuery): boolean {
  return q.key.length >= CLAIM_QUERY_MIN_LENGTH || q.corporateNumber !== null
}

// 名前の近さの点数。0 は候補にしない。
// 法人番号の一致 > 名前の鍵の一致 > 行の名前が入れた名前で始まる > 行の名前に入れた名前が入っている > 入れた名前に行の名前が入っている。
// 同じ段の中は、長さの近いもの(短いほうの長さ ÷ 長いほうの長さ)を前にする
export function claimMatchScore(row: Pick<ClaimCandidateRow, 'name' | 'corporateNumber'>, q: ClaimQuery): number {
  if (q.corporateNumber && row.corporateNumber === q.corporateNumber) return 1000
  if (q.key.length < CLAIM_QUERY_MIN_LENGTH) return 0
  const key = nameKey(row.name)
  if (!key) return 0
  const coverage = Math.min(key.length, q.key.length) / Math.max(key.length, q.key.length)
  if (key === q.key) return 500
  if (key.startsWith(q.key)) return 300 + coverage * 100
  if (key.includes(q.key)) return 200 + coverage * 100
  if (key.length >= CLAIM_REVERSE_MIN_LENGTH && q.key.includes(key)) return 100 + coverage * 100
  return 0
}

// 候補を名前の近い順に 5 つまで。同じ行は 1 つにする
export function rankClaimCandidates<T extends ClaimCandidateRow>(rows: readonly T[], q: ClaimQuery): T[] {
  if (!isSearchableQuery(q)) return []
  const seen = new Set<string>()
  const scored: { row: T; score: number }[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    const score = claimMatchScore(row, q)
    if (score > 0) scored.push({ row, score })
  }
  scored.sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name, 'ja'))
  return scored.slice(0, CLAIM_CANDIDATE_LIMIT).map((s) => s.row)
}

// 画面に出すサイトの URL。http(s) だけ(javascript: などを href に入れない)
export function safeWebsite(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

// 申し込みに残した掲載台帳の行の id(形の合わない値は無いものとする)
export function directoryEntryIdOf(application: unknown): string | null {
  if (!application || typeof application !== 'object') return null
  const value = (application as Record<string, unknown>)[DIRECTORY_ENTRY_KEY]
  return typeof value === 'string' && UUID.test(value) ? value : null
}

// 申し込みに、選んだ行の id を置く(null なら外す)。画面から送られた答えに同じキーがあっても、ここで必ず上書きする
export function withDirectoryEntry<T extends Record<string, unknown>>(application: T, entryId: string | null): Record<string, unknown> {
  const { [DIRECTORY_ENTRY_KEY]: _dropped, ...rest } = application
  return entryId ? { ...rest, [DIRECTORY_ENTRY_KEY]: entryId } : rest
}

export type ClaimEntry = {
  kind: string
  claimStatus: string
  claimedOrganizationId: string | null
}

// 行を結べるか。LINKED = この支援団体と結び済み / TAKEN = ほかの支援団体と結び済み / GONE = 行が無い・民間の団体の行でない
export type ClaimState = 'LINKABLE' | 'LINKED' | 'TAKEN' | 'GONE'

export function claimState(entry: ClaimEntry | null, organizationId: string): ClaimState {
  if (!entry || entry.kind !== 'ORGANIZATION') return 'GONE'
  if (entry.claimStatus === 'CLAIMED') return entry.claimedOrganizationId === organizationId ? 'LINKED' : 'TAKEN'
  return 'LINKABLE'
}

// 登録のときに選べる行か(民間の団体の行で、公開していて、まだ結んでいない)
export function isClaimableEntry(entry: { kind: string; visibility: string; claimStatus: string } | null): boolean {
  return !!entry && entry.kind === 'ORGANIZATION' && entry.visibility === 'PUBLIC' && entry.claimStatus !== 'CLAIMED'
}

export type ClaimOrganization = {
  id: string
  name: string
  corporateNumber: string | null
  // 登録のときに選んだ活動地域(supporter_service_areas)。登録が無ければ null
  areas: { nationwide: boolean; regionCodes: string[] } | null
}

export type ClaimOverwrite = {
  name: string
  claim_status: 'CLAIMED'
  claimed_organization_id: string
  corporate_number?: string
  service_scope?: 'NATIONWIDE' | 'PREFECTURE'
  service_codes?: string[]
}

const JP_PREFECTURE = /^JP-\d{2}$/

// 承認で行に書く値。名前は登録の名前に、活動地域は登録で選んだもの(全国か都道府県の一覧)に合わせる。
// 掲載台帳は日本の団体の表なので、日本の都道府県でない地域が混ざるときは活動地域を変えない。
// 法人番号は行に無いときだけ足す(出典の番号と違えば、出典のほうを残す)
export function claimOverwrite(entry: { corporateNumber: string | null }, org: ClaimOrganization): ClaimOverwrite {
  const update: ClaimOverwrite = { name: org.name, claim_status: 'CLAIMED', claimed_organization_id: org.id }
  const corporateNumber = normalizeCorporateNumber(org.corporateNumber)
  if (!entry.corporateNumber && corporateNumber) update.corporate_number = corporateNumber
  if (org.areas?.nationwide) {
    update.service_scope = 'NATIONWIDE'
    update.service_codes = []
  } else if (org.areas && org.areas.regionCodes.length > 0 && org.areas.regionCodes.every((c) => JP_PREFECTURE.test(c))) {
    update.service_scope = 'PREFECTURE'
    update.service_codes = [...new Set(org.areas.regionCodes)]
  }
  return update
}

// 取り込み(scripts/import-directory-entries.mts)で、結んだ行について出典の値で戻さない列。claimOverwrite が書く列と同じ
export const CLAIM_PRESERVED_COLUMNS = ['name', 'corporate_number', 'service_scope', 'service_codes'] as const
