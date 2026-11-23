// 相談に合う支援団体の提案(#138)の決まりと、AI の返事の読み取り。実行: npm run test:units
import assert from 'node:assert/strict'
import {
  SUGGESTION_COUNT,
  displayChannels,
  fitsAge,
  fitsSubject,
  goalOfIndicator,
  isOrganizationCandidate,
  isPublicFallback,
  isUrgentHotline,
  reachable,
  isLocalMembershipBody,
  isPhysicalLocalService,
  prefectureInName,
  areaNoteFor,
  channelsForCard,
  semanticScore,
  SEMANTIC_MIN,
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
  orgType: 'NPO',
  indicators: ['1.2.1'],
  sdgsGoals: [1],
  targets: ['ANYONE'],
  subjects: ['PERSON'],
  channels: [],
  ...over,
})
const person: SuggestCase = { subject: 'PERSON', regionCountry: 'JP', regionCode: 'JP-13', indicators: ['1.2.1', '11.1.1'], isMinor: false, urgent: false }

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

// 相談者が連絡して相談できるか(#148): 全国から選ぶ。ほかの都道府県の団体は遠隔の手段で相談を受けているものだけ
const farInPerson = org({ prefectureCode: 'JP-43', serviceCodes: ['JP-43'], channels: ['VISIT'] })
const farRemote = org({ prefectureCode: 'JP-43', serviceCodes: ['JP-43'], channels: ['VISIT', 'CHAT'] })
const unknownPlace = org({ prefectureCode: null, serviceScope: 'MUNICIPALITY', serviceCodes: [], channels: [] })
assert.equal(reachable(farInPerson, person), false)
assert.equal(reachable(farRemote, person), true)
assert.equal(reachable(org({ prefectureCode: 'JP-43', serviceCodes: ['JP-43'], channels: ['PHONE'] }), person), true)
assert.equal(reachable(org({ channels: ['VISIT'] }), person), true)
assert.equal(reachable(unknownPlace, person), false)
assert.equal(reachable(farRemote, { ...person, regionCountry: 'US' }), false)
assert.equal(isOrganizationCandidate(farInPerson, person), false)
assert.equal(isOrganizationCandidate(farRemote, person), true)

// だれの相談か: 調べが付いていればそれに従う。分からなければ対象者から推す
assert.equal(fitsSubject(org({ subjects: ['PERSON'] }), 'COMPANY'), false)
assert.equal(fitsSubject(org({ subjects: [], targets: ['BUSINESS'] }), 'PERSON'), false)
assert.equal(fitsSubject(org({ subjects: [], targets: ['BUSINESS'] }), 'COMPANY'), true)
assert.equal(fitsSubject(org({ subjects: [], targets: [] }), 'PERSON'), true)
assert.equal(fitsSubject(org({ subjects: [], targets: [] }), 'COMPANY'), false)
assert.equal(fitsSubject(org({ subjects: ['PERSON', 'COMPANY', 'COMMUNITY'] }), 'NATION'), false)

// ほかの都道府県の地域の会員組織(弁護士会・商工会議所など)は、電話で受けていても出さない。全国の連合会と同じ都道府県なら出す
const farBar = org({ name: '仙台弁護士会', prefectureCode: 'JP-04', serviceCodes: ['JP-04'], channels: ['PHONE'] })
assert.equal(isLocalMembershipBody(farBar), true)
assert.equal(isLocalMembershipBody(org({ name: '一般社団法人ＡＢＣユニオン' })), true)
assert.equal(isLocalMembershipBody(org({ name: '特定非営利活動法人TEDIC' })), false)
assert.equal(isLocalMembershipBody(org({ name: 'X', orgType: 'BAR_ASSOCIATION' })), true)
assert.equal(reachable(farBar, person), false)
assert.equal(reachable({ ...farBar, prefectureCode: 'JP-13', serviceCodes: ['JP-13'] }, person), true)
assert.equal(reachable(org({ name: '日本司法書士会連合会', serviceScope: 'NATIONWIDE', prefectureCode: 'JP-04', serviceCodes: [], channels: ['PHONE'] }), person), true)

// 受け取りに行く支援(フードバンク・子ども食堂)は、ほかの都道府県の相談者に出さない。同じ都道府県なら出す
const farFoodbank = org({ categories: ['FOOD_BANK'], prefectureCode: 'JP-15', serviceCodes: ['JP-15'], channels: ['PHONE'] })
assert.equal(isPhysicalLocalService(farFoodbank), true)
assert.equal(reachable(farFoodbank, person), false)
assert.equal(reachable({ ...farFoodbank, prefectureCode: 'JP-13', serviceCodes: ['JP-13'] }, person), true)
assert.equal(isPhysicalLocalService(org()), false)

// 団体名の都道府県: 都府県の付いた名前を先に。「東京都」を京都府と取り違えない
assert.equal(prefectureInName('長崎県信用保証協会'), 'JP-42')
assert.equal(prefectureInName('社会福祉法人 沖縄いのちの電話'), 'JP-47')
assert.equal(prefectureInName('東京都社会福祉協議会'), 'JP-13')
assert.equal(prefectureInName('東京英語いのちの電話'), 'JP-13')
assert.equal(prefectureInName('京都府ひきこもり支援'), 'JP-26')
assert.equal(prefectureInName('北海道家庭生活総合カウンセリングセンター'), 'JP-01')
assert.equal(prefectureInName('特定非営利活動法人TEDIC'), null)
// 団体名に相談者と違う都道府県の名前がある団体は、遠隔で受けていても・対応地域が全国でも出さない。同じ県なら出す
const nagasaki = org({ name: '公益社団法人 長崎犯罪被害者支援センター', serviceScope: 'NATIONWIDE', prefectureCode: 'JP-42', serviceCodes: [], channels: ['PHONE'] })
assert.equal(reachable(nagasaki, person), false)
assert.equal(reachable(nagasaki, { ...person, regionCode: 'JP-42' }), true)
assert.equal(reachable(org({ name: '愛知県信用保証協会', prefectureCode: 'JP-23', serviceCodes: ['JP-23'], channels: ['PHONE'] }), { ...person, regionCode: 'JP-26' }), false)
assert.equal(reachable(org({ name: '特定非営利活動法人TEDIC', prefectureCode: 'JP-04', serviceCodes: ['JP-04'], channels: ['PHONE'] }), person), true)

// 地域の相談は、地域の相談を受ける団体に加えて、個人の相談を受ける団体も候補にする(事業者だけの団体は除く)
const community: SuggestCase = { ...person, subject: 'COMMUNITY' }
assert.equal(fitsSubject(org({ subjects: ['PERSON'] }), 'COMMUNITY'), true)
assert.equal(fitsSubject(org({ subjects: ['COMPANY'] }), 'COMMUNITY'), false)
assert.equal(fitsSubject(org({ subjects: [], targets: ['BUSINESS'] }), 'COMMUNITY'), false)
assert.equal(fitsSubject(org({ subjects: [], targets: [] }), 'COMMUNITY'), true)
assert.equal(isOrganizationCandidate(org(), community), true)

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
// 営利の会社は扱いを決めるまで出さない。弁護士会・法人格の分からない団体は出す
assert.equal(isOrganizationCandidate(org({ orgType: 'COMPANY' }), person), false)
assert.equal(isOrganizationCandidate(org({ orgType: 'BAR_ASSOCIATION' }), person), true)
assert.equal(isOrganizationCandidate(org({ orgType: null }), person), true)

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

// 意味の近さ(#148): SEMANTIC_MIN 未満は 0。指標が重ならなくても、意味が近ければ候補になる
assert.equal(semanticScore(null), 0)
assert.equal(semanticScore(SEMANTIC_MIN - 0.01), 0)
assert.equal(semanticScore(SEMANTIC_MIN), 3)
assert.equal(semanticScore(0.5), 11)
assert.equal(semanticScore(Number.NaN), 0)
const noIndicator = org({ indicators: [], sdgsGoals: [], serviceScope: 'NATIONWIDE' })
assert.equal(relevanceScore({ ...noIndicator, similarity: 0.2 }, person), 0)
assert.equal(relevanceScore({ ...noIndicator, similarity: 0.5 }, person), 11)
assert.equal(relevanceScore({ ...noIndicator, similarity: 0.5 }, { ...person, indicators: [] }), 11)
assert.deepEqual(rankCandidates([{ ...noIndicator, id: 'sem', similarity: 0.45 }], { ...person, indicators: [] }).map((r) => r.candidate.id), ['sem'])

// ほかの都道府県の団体は、合い方が同じなら同じ都道府県・全国の団体より後ろ(減点しても 1 点は残る)
const localPhone = org({ id: 'local', name: 'う', channels: ['PHONE'] })
const farPhone = org({ id: 'far', name: 'あ', prefectureCode: 'JP-43', serviceCodes: ['JP-43'], channels: ['PHONE'] })
assert.ok(relevanceScore(farPhone, person) < relevanceScore(localPhone, person))
assert.deepEqual(rankCandidates([farPhone, localPhone], person).map((r) => r.candidate.id), ['local', 'far'])
assert.equal(relevanceScore({ ...farPhone, indicators: [], sdgsGoals: [], similarity: 0.3 }, person), 1)

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
// 公的な窓口は民間の数にかかわらず後ろに残る(AI が民間を選ばなかったときに埋められる)
assert.deepEqual(many.map((r) => r.candidate.id), ['a', 'b', 'd', 'h'])
assert.deepEqual(pickSuggestions(many, []).map((p) => p.id), ['h'])
// 会社の相談は、民間の候補がなくても事業者の窓口で埋める
assert.deepEqual(rankCandidates([yorozu, a], company).map((r) => r.candidate.id), ['y'])

// 会社の相談は、指標が付かなくても事業者向けの窓口を出す(法テラスは出さない)
assert.deepEqual(rankCandidates([yorozu, houterasu], { ...company, indicators: [] }).map((r) => r.candidate.id), ['y'])
assert.deepEqual(rankCandidates([org({ ...yorozu, sdgsGoals: [] })], { ...company, indicators: [] }).map((r) => r.candidate.id), ['y'])

// 同じ名前の団体(法人格・空白・全角半角の違い)は点数の高い 1 つだけ
const dup1 = org({ id: 'dup1', name: '特定非営利活動法人TEDIC', indicators: ['1.2.1', '11.1.1'] })
const dup2 = org({ id: 'dup2', name: 'ＴＥＤＩＣ' })
assert.deepEqual(rankCandidates([dup2, dup1], person).map((r) => r.candidate.id), ['dup1'])

// 選び方: AI が選んだ候補を先に。候補にない id・重なりは捨てる
const picks = pickSuggestions(many, [{ id: 'd', reason: '住まいの相談に乗ってくれます' }, { id: 'zzz', reason: 'x' }, { id: 'd', reason: 'y' }])
assert.deepEqual(picks.map((p) => [p.id, p.rank, p.method]), [['d', 1, 'AI'], ['h', 2, 'RULE']])
assert.equal(picks[0].reason, '住まいの相談に乗ってくれます')
// AI が選んだときは、AI が選ばなかった民間の団体で埋めず、公的な窓口だけで埋める
const withPublic = rankCandidates([a, b, houterasu], legal)
assert.deepEqual(pickSuggestions(withPublic, [{ id: 'b', reason: 'x' }]).map((p) => [p.id, p.method]), [['b', 'AI'], ['h', 'RULE']])
assert.deepEqual(pickSuggestions(withPublic, []).map((p) => p.id), ['h'])
// AI が使えなかったときは決まりの並びの上から 3 つ
assert.equal(pickSuggestions(many, null).length, SUGGESTION_COUNT)
assert.deepEqual(pickSuggestions(many, null)[0].method, 'RULE')
assert.deepEqual(pickSuggestions([], [{ id: 'a', reason: 'x' }]), [])

// 全国の電話窓口は、緊急と判定した個人の相談でだけ AI に見せる。事業者向けは会社の相談の埋め草
const dvHotline = org({ id: 'dv', kind: 'NATIONAL_HOTLINE', categories: ['DV_HOTLINE'], serviceScope: 'NATIONWIDE', serviceCodes: [], indicators: [], sdgsGoals: [5], acceptsConsultation: 'UNKNOWN' })
const tradeHotline = org({ id: 'tr', kind: 'NATIONAL_HOTLINE', categories: ['TRADE_DISPUTE_HOTLINE'], serviceScope: 'NATIONWIDE', serviceCodes: [], indicators: [], sdgsGoals: [8], acceptsConsultation: 'UNKNOWN' })
const urgentPerson: SuggestCase = { ...person, urgent: true }
assert.equal(isUrgentHotline(dvHotline, urgentPerson), true)
assert.equal(isUrgentHotline(dvHotline, person), false)
assert.equal(isUrgentHotline(dvHotline, { ...company, urgent: true }), false)
assert.equal(isUrgentHotline(tradeHotline, urgentPerson), false)
// 総合の電話相談(よりそいホットライン)は緊急の相談でも見せない(つながりにくい。#160)
assert.equal(isUrgentHotline(hotline, urgentPerson), false)
assert.deepEqual(rankCandidates([hotline], urgentPerson), [])
assert.equal(isPublicFallback(tradeHotline, company), true)
assert.equal(isPublicFallback(dvHotline, person), false)
// 緊急の電話窓口は大項目で絞らずに後ろに並べ、AI が選んだときだけ出す(決まりの並びでは埋めない)
const urgentRanked = rankCandidates([a, dvHotline], urgentPerson)
assert.deepEqual(urgentRanked.map((r) => [r.candidate.id, r.tier]), [['a', 'ORGANIZATION'], ['dv', 'HOTLINE']])
assert.deepEqual(pickSuggestions(urgentRanked, null).map((p) => p.id), ['a'])
assert.deepEqual(pickSuggestions(urgentRanked, []).map((p) => p.id), [])
assert.deepEqual(pickSuggestions(urgentRanked, [{ id: 'dv', reason: 'x' }, { id: 'a', reason: 'y' }]).map((p) => p.id), ['dv', 'a'])

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

// 札の所在: 全国・ほかの都道府県だけ出す。ほかの都道府県の団体には来所・訪問を出さない
assert.deepEqual(areaNoteFor({ serviceScope: 'NATIONWIDE', serviceCodes: [], prefectureCode: 'JP-13' }, 'JP-43'), { kind: 'NATIONWIDE' })
assert.equal(areaNoteFor({ serviceScope: 'PREFECTURE', serviceCodes: ['JP-43'], prefectureCode: 'JP-43' }, 'JP-43'), null)
assert.deepEqual(areaNoteFor({ serviceScope: 'PREFECTURE', serviceCodes: ['JP-43'], prefectureCode: 'JP-43' }, 'JP-13'), { kind: 'OTHER_PREFECTURE', code: 'JP-43' })
assert.deepEqual(areaNoteFor({ serviceScope: 'MUNICIPALITY', serviceCodes: [], prefectureCode: null }, 'JP-13'), { kind: 'OTHER_PREFECTURE', code: null })
assert.deepEqual(channelsForCard(['VISIT', 'PHONE', 'OUTREACH', 'CHAT'], true), ['PHONE', 'CHAT'])
assert.deepEqual(channelsForCard(['VISIT', 'PHONE'], false), ['PHONE', 'VISIT'])

console.log('suggestions: ok')
