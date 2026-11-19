// 相談に合う支援団体の提案(#138)の決まりと、AI の返事の読み取り。実行: npm run test:units
import assert from 'node:assert/strict'
import {
  SUGGESTION_COUNT,
  displayChannels,
  emergencyHotlinesFor,
  fitsAge,
  fitsSubject,
  goalOfIndicator,
  isOrganizationCandidate,
  isPublicFallback,
  pickSuggestions,
  rankCandidates,
  relevanceScore,
  servesRegion,
  type SuggestCandidate,
  type SuggestCase,
} from '../../src/lib/domain/suggestions'
import { buildSuggestPrompt, parseSuggestPicks } from '../../src/lib/ai/prompts/suggestOrganizations'

const org = (over: Partial<SuggestCandidate> = {}): SuggestCandidate => ({
  id: 'o1',
  kind: 'ORGANIZATION',
  categories: ['NPO'],
  name: '住まいの相談',
  prefectureCode: 'JP-13',
  serviceScope: 'PREFECTURE',
  serviceCodes: ['JP-13'],
  acceptsConsultation: 'YES',
  claimStatus: 'UNCLAIMED',
  indicators: ['1.2.1'],
  sdgsGoals: [1],
  targets: ['ANYONE'],
  subjects: ['PERSON'],
  channels: [],
  ...over,
})
const person: SuggestCase = { subject: 'PERSON', regionCountry: 'JP', regionCode: 'JP-13', indicators: ['1.2.1', '11.1.1'], isMinor: false }

// 指標の番号から大項目
assert.equal(goalOfIndicator('1.2.1'), 1)
assert.equal(goalOfIndicator('16.2.3'), 16)
assert.equal(goalOfIndicator('x'), null)
assert.equal(goalOfIndicator('18.1.1'), null)

// 地域: 全国・同じ都道府県だけ。日本の外の相談には出さない。市区町村の団体は都道府県で合わせる
assert.equal(servesRegion(org({ serviceScope: 'NATIONWIDE', prefectureCode: 'JP-01', serviceCodes: [] }), person), true)
assert.equal(servesRegion(org(), person), true)
assert.equal(servesRegion(org({ prefectureCode: 'JP-40', serviceCodes: ['JP-40'] }), person), false)
assert.equal(servesRegion(org({ serviceScope: 'MUNICIPALITY', serviceCodes: ['131016'] }), person), true)
assert.equal(servesRegion(org({ serviceScope: 'NATIONWIDE' }), { ...person, regionCountry: 'US' }), false)
assert.equal(servesRegion(org(), { ...person, regionCode: null }), false)

// だれの相談か: 調べが付いていればそれに従う。分からなければ対象者から推す
assert.equal(fitsSubject(org({ subjects: ['PERSON'] }), 'COMPANY'), false)
assert.equal(fitsSubject(org({ subjects: [], targets: ['BUSINESS'] }), 'PERSON'), false)
assert.equal(fitsSubject(org({ subjects: [], targets: ['BUSINESS'] }), 'COMPANY'), true)
assert.equal(fitsSubject(org({ subjects: [], targets: [] }), 'PERSON'), true)
assert.equal(fitsSubject(org({ subjects: [], targets: [] }), 'COMPANY'), false)
assert.equal(fitsSubject(org({ subjects: ['PERSON', 'COMPANY', 'COMMUNITY'] }), 'NATION'), false)

// 18歳未満: 高齢者・事業者・地域だけが対象の団体は出さない
assert.equal(fitsAge(org({ targets: ['ELDERLY'] }), true), false)
assert.equal(fitsAge(org({ targets: ['ELDERLY', 'CHILD'] }), true), true)
assert.equal(fitsAge(org({ targets: ['ELDERLY'] }), false), true)
assert.equal(fitsAge(org({ targets: [] }), true), true)

// 民間の候補: 相談を受けていると調べが付いた・登録済みでない
assert.equal(isOrganizationCandidate(org(), person), true)
assert.equal(isOrganizationCandidate(org({ acceptsConsultation: 'UNKNOWN' }), person), false)
assert.equal(isOrganizationCandidate(org({ claimStatus: 'CLAIMED' }), person), false)
assert.equal(isOrganizationCandidate(org({ kind: 'PUBLIC_WINDOW' }), person), false)

// 公的な窓口は自治体でないものだけを埋め草に。個人の相談に事業者の窓口を出さない(逆も)
const yorozu = org({ id: 'y', kind: 'PUBLIC_WINDOW', categories: ['YOROZU_SUPPORT_CENTER'], acceptsConsultation: 'UNKNOWN', indicators: [], sdgsGoals: Array.from({ length: 17 }, (_, i) => i + 1) })
const houterasu = org({ id: 'h', kind: 'PUBLIC_WINDOW', categories: ['LEGAL_SUPPORT_OFFICE'], acceptsConsultation: 'UNKNOWN', indicators: [], sdgsGoals: [16] })
const municipal = org({ id: 'm', kind: 'PUBLIC_WINDOW', categories: ['SELF_RELIANCE_SUPPORT'], acceptsConsultation: 'UNKNOWN' })
const hotline = org({ id: 'n', kind: 'NATIONAL_HOTLINE', categories: ['GENERAL_CONSULTATION_HOTLINE'], serviceScope: 'NATIONWIDE' })
const company: SuggestCase = { ...person, subject: 'COMPANY', indicators: ['8.3.1'] }
assert.equal(isPublicFallback(yorozu, company), true)
assert.equal(isPublicFallback(yorozu, person), false)
assert.equal(isPublicFallback(houterasu, person), true)
assert.equal(isPublicFallback(municipal, person), false)
assert.equal(isPublicFallback(hotline, person), false)

// 近さの点数: 指標の重なり > 大項目 > 電話・オンラインの加点 > 同じ都道府県
assert.equal(relevanceScore(org({ indicators: ['5.2.1'], sdgsGoals: [5] }), person), 0)
const exact = relevanceScore(org({ serviceScope: 'NATIONWIDE' }), person)
const goalOnly = relevanceScore(org({ indicators: ['1.4.1'], sdgsGoals: [], serviceScope: 'NATIONWIDE' }), person)
assert.ok(exact > goalOnly)
assert.equal(goalOnly, 3)
const phone = relevanceScore(org({ serviceScope: 'NATIONWIDE', channels: ['PHONE', 'ONLINE'] }), person)
assert.equal(phone, exact + 4)
assert.equal(relevanceScore(org(), person), exact + 1)
// 加点は指標の重なり 1 つ分を超えない
assert.ok(relevanceScore(org({ indicators: ['1.4.1'], channels: ['PHONE', 'ONLINE'] }), person) < exact)

// 並べ方: 民間を点数順に。公的な窓口は民間が 3 つに足りない分だけ後ろに
const a = org({ id: 'a', name: 'あ', channels: ['PHONE'] })
const b = org({ id: 'b', name: 'い', indicators: ['1.2.1', '11.1.1'] })
const c = org({ id: 'c', name: 'う', indicators: ['5.2.1'], sdgsGoals: [5] })
const legal: SuggestCase = { ...person, indicators: ['1.2.1', '16.3.1'] }
const ranked = rankCandidates([a, b, c, houterasu, municipal, hotline, a], legal)
assert.deepEqual(ranked.map((r) => r.candidate.id), ['a', 'b', 'h'])
// 公的な窓口の埋め草も、相談の大項目と合わなければ出さない(家賃の相談に法テラスを出さない)
assert.deepEqual(rankCandidates([a, b, houterasu], person).map((r) => r.candidate.id), ['b', 'a'])
const many = rankCandidates([a, b, org({ id: 'd', name: 'え' }), houterasu], legal)
assert.deepEqual(many.map((r) => r.candidate.id), ['a', 'b', 'd'])
// 会社の相談は、民間の候補がなくても事業者の窓口で埋める
assert.deepEqual(rankCandidates([yorozu, a], company).map((r) => r.candidate.id), ['y'])

// 選び方: AI が選んだ候補を先に、足りない分を決まりの並びで。候補にない id・重なりは捨てる
const picks = pickSuggestions(many, [{ id: 'd', reason: '住まいの相談に乗ってくれます' }, { id: 'zzz', reason: 'x' }, { id: 'd', reason: 'y' }])
assert.deepEqual(picks.map((p) => [p.id, p.rank, p.method]), [['d', 1, 'AI'], ['a', 2, 'RULE'], ['b', 3, 'RULE']])
assert.equal(picks[0].reason, '住まいの相談に乗ってくれます')
assert.equal(picks[1].reason, null)
assert.equal(pickSuggestions(many, null).length, SUGGESTION_COUNT)
assert.deepEqual(pickSuggestions([], [{ id: 'a', reason: 'x' }]), [])

// 全国の電話窓口は、緊急と判定した個人の相談にだけ
assert.equal(emergencyHotlinesFor('PERSON', true).show, true)
assert.equal(emergencyHotlinesFor('PERSON', false).show, false)
assert.equal(emergencyHotlinesFor('COMPANY', true).show, false)

// 画面の相談の手段は電話・オンラインを先に、知らない値は出さない
assert.deepEqual(displayChannels(['VISIT', 'ONLINE', 'X', 'PHONE']), ['PHONE', 'ONLINE', 'VISIT'])

// プロンプト: 相談文と候補をデータとして囲み、相談者の言語を指定する
const prompt = buildSuggestPrompt({
  subject: 'PERSON',
  fencedText: '<consultation>家賃が払えない</consultation>',
  locale: 'es',
  isMinor: true,
  candidates: [{ id: 'a', name: 'あ', summary: null, targets: [], channels: ['PHONE'], area: '全国' }],
})
assert.ok(prompt.includes('<consultation>家賃が払えない</consultation>'))
assert.ok(prompt.includes('スペイン語'))
assert.ok(prompt.includes('18歳未満'))
assert.ok(prompt.includes('(調べが付いていない)'))
assert.ok(prompt.includes(`最大${SUGGESTION_COUNT}つ`))

// 返事の読み取り: 並びでなければ null。候補にない id・重なり・4 つ目以降を捨て、理由のリンクを外して短くする
assert.equal(parseSuggestPicks({ picks: 'a' }, new Set(['a'])), null)
assert.deepEqual(parseSuggestPicks({ picks: [] }, new Set(['a'])), [])
const parsed = parseSuggestPicks({
  picks: [
    { id: 'a', reason: '  詳しくは https://example.com を  ' },
    { id: 'a', reason: '重なり' },
    { id: 'q', reason: '候補にない' },
    { id: 'b' },
    { id: 'c', reason: 'う' },
    { id: 'd', reason: 'え' },
  ],
}, new Set(['a', 'b', 'c', 'd']))
assert.ok(parsed)
assert.deepEqual(parsed.map((p) => p.id), ['a', 'b', 'c'])
assert.equal(parsed[1].reason, null)
assert.ok(!parsed[0].reason?.includes('https://'))

console.log('suggestions: ok')
