// 支援団体の登録で、掲載台帳の行と支援団体を結ぶ決まり(#140)。実行: npm run test:units
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CLAIM_CANDIDATE_LIMIT,
  CLAIM_PRESERVED_COLUMNS,
  DIRECTORY_ENTRY_KEY,
  claimMatchScore,
  claimOverwrite,
  claimQuery,
  claimState,
  directoryEntryIdOf,
  isClaimableEntry,
  isSearchableQuery,
  normalizeCorporateNumber,
  rankClaimCandidates,
  safeWebsite,
  withDirectoryEntry,
  type ClaimCandidateRow,
} from '../../src/lib/domain/directoryClaim'
import { LEGAL_FORM_NAMES, nameKey } from '../../src/lib/domain/suggestions'

const row = (id: string, name: string, corporateNumber: string | null = null): ClaimCandidateRow => ({ id, name, corporateNumber, prefectureCode: 'JP-40', websiteUrl: null })

// 法人番号: 全角・空白・ハイフンを許し、13 けたでなければ使わない
assert.equal(normalizeCorporateNumber('１２３４５６７８９０１２３'), '1234567890123')
assert.equal(normalizeCorporateNumber('1234-5678-90123'), '1234567890123')
assert.equal(normalizeCorporateNumber(' 1234567890123 '), '1234567890123')
assert.equal(normalizeCorporateNumber('123456789012'), null)
assert.equal(normalizeCorporateNumber('12345678901234'), null)
assert.equal(normalizeCorporateNumber(''), null)
assert.equal(normalizeCorporateNumber(null), null)

// 問い合わせ: 名前は提案と同じ鍵。2 文字に満たない名前は、法人番号がなければ探さない
assert.deepEqual(claimQuery('特定非営利活動法人 フードバンク福岡', null), { key: 'フードバンク福岡', corporateNumber: null })
assert.equal(isSearchableQuery(claimQuery('あ', null)), false)
assert.equal(isSearchableQuery(claimQuery('NPO法人 あ', null)), false)
assert.equal(isSearchableQuery(claimQuery('あい', null)), true)
assert.equal(isSearchableQuery(claimQuery('', '1234567890123')), true)

// 名前の近さ: 法人格・空白・全角半角の違いは同じ名前として扱う
const q = claimQuery('フードバンク福岡', null)
assert.equal(claimMatchScore(row('a', '特定非営利活動法人フードバンク福岡'), q), 500)
assert.equal(claimMatchScore(row('a', 'ＮＰＯ法人 フードバンク　福岡'), q), 500)
// 段の順: 一致 > 前方一致 > 部分一致 > 入れた名前の中に行の名前
const exact = claimMatchScore(row('a', 'フードバンク福岡'), q)
const prefix = claimMatchScore(row('b', 'フードバンク福岡北九州'), q)
const contains = claimMatchScore(row('c', '北九州フードバンク福岡'), q)
const reverse = claimMatchScore(row('d', 'バンク福岡'), q)
assert.ok(exact > prefix && prefix > contains && contains > reverse && reverse > 0)
// 当たらない名前は 0
assert.equal(claimMatchScore(row('e', 'こども食堂ひまわり'), q), 0)
// 入れた名前の中に行の名前が入っている向きは、行の名前が 3 文字以上のときだけ(短い名前でどの申し込みにも当たらない)
assert.equal(claimMatchScore(row('f', '福岡'), q), 0)
// 同じ段では長さの近いものが前
assert.ok(claimMatchScore(row('g', 'フードバンク福岡北'), q) > claimMatchScore(row('h', 'フードバンク福岡北九州市小倉南区'), q))
// 法人番号の一致は名前が違っても一番上
const qc = claimQuery('ふーどばんく', '1234567890123')
assert.equal(claimMatchScore(row('i', '全く別の名前', '1234567890123'), qc), 1000)
assert.equal(claimMatchScore(row('j', '全く別の名前', '9999999999999'), qc), 0)

// 並べ方: 点数の高い順に 5 つまで、同じ行は 1 つ、当たらない行は出さない
const rows = [
  row('r1', '北九州フードバンク福岡'),
  row('r2', 'フードバンク福岡北九州'),
  row('r3', '特定非営利活動法人フードバンク福岡'),
  row('r3', '特定非営利活動法人フードバンク福岡'),
  row('r4', 'こども食堂ひまわり'),
  row('r5', 'フードバンク福岡A'),
  row('r6', 'フードバンク福岡B'),
  row('r7', 'フードバンク福岡C'),
  row('r8', 'フードバンク福岡D'),
]
const ranked = rankClaimCandidates(rows, q)
assert.equal(ranked.length, CLAIM_CANDIDATE_LIMIT)
assert.equal(ranked[0].id, 'r3')
assert.equal(new Set(ranked.map((r) => r.id)).size, ranked.length)
assert.ok(!ranked.some((r) => r.id === 'r4'))
// 前方一致の 4 つ(長さが同じなので名前の順)が、部分一致より前
assert.deepEqual(ranked.slice(1).map((r) => r.id), ['r5', 'r6', 'r7', 'r8'])
assert.deepEqual(rankClaimCandidates(rows, claimQuery('あ', null)), [])

// サイトは http(s) だけ
assert.equal(safeWebsite('https://example.org/a'), 'https://example.org/a')
assert.equal(safeWebsite('http://example.org'), 'http://example.org/')
assert.equal(safeWebsite('javascript:alert(1)'), null)
assert.equal(safeWebsite('example.org'), null)
assert.equal(safeWebsite(null), null)

// 申し込みに残す行の id: 画面から送られた同じキーは必ず上書きし、null なら外す。形の合わない値は無いものとする
const id = '3f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f'
assert.deepEqual(withDirectoryEntry({ purpose: 'SUPPORT', staff: '3' }, id), { purpose: 'SUPPORT', staff: '3', [DIRECTORY_ENTRY_KEY]: id })
assert.deepEqual(withDirectoryEntry({ purpose: 'SUPPORT', [DIRECTORY_ENTRY_KEY]: 'forged' }, null), { purpose: 'SUPPORT' })
assert.deepEqual(withDirectoryEntry({ [DIRECTORY_ENTRY_KEY]: 'forged' }, id), { [DIRECTORY_ENTRY_KEY]: id })
assert.equal(directoryEntryIdOf({ [DIRECTORY_ENTRY_KEY]: id }), id)
assert.equal(directoryEntryIdOf({ [DIRECTORY_ENTRY_KEY]: 'forged' }), null)
assert.equal(directoryEntryIdOf({}), null)
assert.equal(directoryEntryIdOf(null), null)

// 結べるか
const org = 'org-1'
assert.equal(claimState(null, org), 'GONE')
assert.equal(claimState({ kind: 'PUBLIC_WINDOW', claimStatus: 'UNCLAIMED', claimedOrganizationId: null }, org), 'GONE')
assert.equal(claimState({ kind: 'ORGANIZATION', claimStatus: 'UNCLAIMED', claimedOrganizationId: null }, org), 'LINKABLE')
assert.equal(claimState({ kind: 'ORGANIZATION', claimStatus: 'CLAIM_PENDING', claimedOrganizationId: null }, org), 'LINKABLE')
assert.equal(claimState({ kind: 'ORGANIZATION', claimStatus: 'CLAIMED', claimedOrganizationId: org }, org), 'LINKED')
assert.equal(claimState({ kind: 'ORGANIZATION', claimStatus: 'CLAIMED', claimedOrganizationId: 'org-2' }, org), 'TAKEN')

// 登録のときに選べる行: 民間の団体・公開中・まだ結んでいない
assert.equal(isClaimableEntry({ kind: 'ORGANIZATION', visibility: 'PUBLIC', claimStatus: 'UNCLAIMED' }), true)
assert.equal(isClaimableEntry({ kind: 'ORGANIZATION', visibility: 'HIDDEN', claimStatus: 'UNCLAIMED' }), false)
assert.equal(isClaimableEntry({ kind: 'ORGANIZATION', visibility: 'PUBLIC', claimStatus: 'CLAIMED' }), false)
assert.equal(isClaimableEntry({ kind: 'NATIONAL_HOTLINE', visibility: 'PUBLIC', claimStatus: 'UNCLAIMED' }), false)
assert.equal(isClaimableEntry(null), false)

// 承認で行に書く値: 名前と活動地域を登録に合わせ、結んだ印を付ける
const base = { id: org, name: 'フードバンク福岡', corporateNumber: null }
assert.deepEqual(claimOverwrite({ corporateNumber: null }, { ...base, areas: { nationwide: true, regionCodes: [] } }), {
  name: 'フードバンク福岡', claim_status: 'CLAIMED', claimed_organization_id: org, service_scope: 'NATIONWIDE', service_codes: [],
})
assert.deepEqual(claimOverwrite({ corporateNumber: null }, { ...base, areas: { nationwide: false, regionCodes: ['JP-40', 'JP-41', 'JP-40'] } }), {
  name: 'フードバンク福岡', claim_status: 'CLAIMED', claimed_organization_id: org, service_scope: 'PREFECTURE', service_codes: ['JP-40', 'JP-41'],
})
// 活動地域の登録がない・日本の都道府県でない地域が混ざるときは、活動地域を変えない
assert.deepEqual(claimOverwrite({ corporateNumber: null }, { ...base, areas: null }), { name: 'フードバンク福岡', claim_status: 'CLAIMED', claimed_organization_id: org })
assert.equal(claimOverwrite({ corporateNumber: null }, { ...base, areas: { nationwide: false, regionCodes: ['JP-40', 'PH-00'] } }).service_scope, undefined)
// 法人番号は行に無いときだけ足す(出典の番号を書き換えない)
assert.equal(claimOverwrite({ corporateNumber: null }, { ...base, corporateNumber: '1234567890123', areas: null }).corporate_number, '1234567890123')
assert.equal(claimOverwrite({ corporateNumber: '9999999999999' }, { ...base, corporateNumber: '1234567890123', areas: null }).corporate_number, undefined)

// 取り込みで戻さない列は、承認で書く列(結んだ印を除く)と同じ
const written = new Set(Object.keys(claimOverwrite({ corporateNumber: null }, { ...base, corporateNumber: '1234567890123', areas: { nationwide: true, regionCodes: [] } })))
written.delete('claim_status')
written.delete('claimed_organization_id')
assert.deepEqual([...written].sort(), [...CLAIM_PRESERVED_COLUMNS].sort())

// DB の名前の鍵(migrations/v2_17 の directory_entries.name_key)が、nameKey と同じ法人格と記号を除く
const sql = readFileSync(join(process.cwd(), 'migrations/v2_17_directory_claim_search.sql'), 'utf8')
const column = sql.slice(sql.indexOf('ADD COLUMN IF NOT EXISTS name_key'), sql.indexOf('CREATE OR REPLACE FUNCTION search_directory_organizations'))
const alternation = column.match(/'\(([^)]*)\)'/)?.[1]?.split('|') ?? []
assert.deepEqual([...alternation].sort(), [...LEGAL_FORM_NAMES].sort())
assert.ok(column.includes("'[\\s・()（）「」『』]'"), 'nameKey の記号の並びと同じにする')
assert.ok(column.includes('normalize(coalesce(name, \'\'), NFKC)') && column.includes('lower('), 'NFKC にそろえて小文字にする(nameKey と同じ順)')
assert.equal(nameKey('認定特定非営利活動法人 ( フードバンク・福岡 )'), 'フードバンク福岡')

console.log('directoryClaim: ok')
