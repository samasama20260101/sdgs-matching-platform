// v2.0 の決まりの芯(年齢・スコア・機微・見える範囲・引き継ぎコード)。実行: npm run test:units
import assert from 'node:assert/strict'
import { currentAge, fullYearsBetween, isMinorAge, needsGuardianConsent, parseAgeInput, todayInTokyo } from '../../src/lib/domain/age'
import { organizationScore, resolvedPoints, summarizeContributions } from '../../src/lib/domain/score'
import { applyAiSensitivity, deriveSensitivity } from '../../src/lib/domain/sensitivity'
import { canOffer, supporterCaseAccess, type CaseForVisibility, type SupporterFace } from '../../src/lib/domain/visibility'
import { formatHandoverCode, HANDOVER_ALPHABET, normalizeHandoverInput } from '../../src/lib/domain/handover'

// ---- 年齢: 登録日の年齢を基準日から1年ごとに進める
assert.equal(fullYearsBetween('2026-11-05', '2026-11-05'), 0)
assert.equal(fullYearsBetween('2026-11-05', '2027-11-04'), 0)
assert.equal(fullYearsBetween('2026-11-05', '2027-11-05'), 1)
assert.equal(fullYearsBetween('2026-11-05', '2031-01-01'), 4)
assert.equal(fullYearsBetween('2028-02-29', '2029-02-28'), 0) // うるう日の基準は平年では 3/1 に進む
assert.equal(fullYearsBetween('2028-02-29', '2029-03-01'), 1)
assert.equal(fullYearsBetween('2027-01-01', '2026-01-01'), 0) // 基準日より前は進めない
assert.equal(currentAge(17, '2026-11-05', '2027-11-04'), 17)
assert.equal(currentAge(17, '2026-11-05', '2027-11-05'), 18)
assert.equal(currentAge(null, null, '2027-01-01'), null)
assert.equal(currentAge(129, '2026-01-01', '2030-01-01'), 130) // 上限で止める
assert.equal(isMinorAge(17), true)
assert.equal(isMinorAge(18), false)
assert.equal(isMinorAge(null), false)
assert.equal(needsGuardianConsent(15), true)
assert.equal(needsGuardianConsent(16), false)
assert.equal(parseAgeInput('16'), 16)
assert.equal(parseAgeInput(' 40 '), 40)
assert.equal(parseAgeInput('16.5'), null)
assert.equal(parseAgeInput('-1'), null)
assert.equal(parseAgeInput('131'), null)
assert.equal(parseAgeInput(''), null)
assert.equal(todayInTokyo(new Date('2026-11-05T15:30:00Z')), '2026-11-06') // UTC 15:30 は JST の翌日
assert.equal(todayInTokyo(new Date('2026-11-05T14:59:00Z')), '2026-11-05')

// ---- スコア: 解決した相談に付いた指標の数 × 対象の人数。ありがとうは別に数える
assert.equal(resolvedPoints(3, 1), 3)
assert.equal(resolvedPoints(2, 120000), 240000)
assert.equal(resolvedPoints(0, 5), 0)
assert.equal(resolvedPoints(2, 0), 2) // 人数は最低 1
// 新しい順に渡す。c1 は解決のときに指標 2 つ、あとで運営が 1 つ外した(訂正 -1、最新の指標は 1.3.1 だけ)
const summary = summarizeContributions([
  { kind: 'CORRECTION', indicator_codes: ['1.3.1'], population: 1, points: -1, case_id: 'c1' },
  { kind: 'THANKS', indicator_codes: [], population: 1, points: 0, case_id: 'c2' },
  { kind: 'THANKS', indicator_codes: [], population: 1, points: 0, case_id: 'c1' },
  { kind: 'RESOLVED', indicator_codes: ['1.3.1'], population: 300, points: 300, case_id: 'c2' },
  { kind: 'RESOLVED', indicator_codes: ['1.3.1', '4.4.1'], population: 1, points: 2, case_id: 'c1' },
])
assert.equal(summary.score, 301)
assert.equal(summary.resolvedCases, 2)
assert.equal(summary.thanks, 2)
assert.deepEqual(summary.byIndicator, { '1.3.1': 2 })
// 解決のときは指標が未確定(0 点)で、あとで確定した(訂正 +2)
const later = summarizeContributions([
  { kind: 'CORRECTION', indicator_codes: ['1.3.1', '11.1.1'], population: 1, points: 1, case_id: 'c3' },
  { kind: 'CORRECTION', indicator_codes: ['1.3.1'], population: 1, points: 1, case_id: 'c3' },
  { kind: 'RESOLVED', indicator_codes: [], population: 1, points: 0, case_id: 'c3' },
])
assert.equal(later.score, 2)
assert.deepEqual(later.byIndicator, { '1.3.1': 1, '11.1.1': 1 })
assert.equal(organizationScore([summary, { score: 9, resolvedCases: 1, thanks: 0, byIndicator: {} }]), 310)

// ---- 機微: 指標の印・18歳未満・AI は上げるだけ
const urgent = new Set(['3.4.2', '16.1.1'])
assert.deepEqual(deriveSensitivity({ indicatorCodes: ['1.1.1'], urgentCodes: urgent, isMinor: false }), { isSensitive: false, reasons: [] })
assert.deepEqual(deriveSensitivity({ indicatorCodes: ['3.4.2'], urgentCodes: urgent, isMinor: false }).reasons, ['INDICATOR'])
assert.deepEqual(deriveSensitivity({ indicatorCodes: ['3.5.1'], urgentCodes: urgent, isMinor: false }).reasons, ['INDICATOR'])
assert.deepEqual(deriveSensitivity({ indicatorCodes: [], urgentCodes: urgent, isMinor: true }).reasons, ['MINOR'])
const plain = { isSensitive: false, reasons: [] as ('INDICATOR' | 'MINOR' | 'AI' | 'ADMIN')[] }
assert.equal(applyAiSensitivity(plain, true, false).isSensitive, true)
assert.equal(applyAiSensitivity(plain, false, false).isSensitive, false)
assert.equal(applyAiSensitivity(plain, true, true).isSensitive, false) // 運営が下げたものを AI では戻さない

// ---- 見える範囲
const base: CaseForVisibility = {
  status: 'OPEN', visibility: 'LISTED', subject_type: 'PERSON', subject_organization_id: null,
  owner_user_id: 'owner', assignee_user_id: 'owner', is_sensitive: false, is_minor: false,
}
const org: SupporterFace = { kind: 'ORGANIZATION', userId: 'staff', organizationId: 'npo', organizationApproved: true, membershipActive: true, mfaVerified: false }
const person: SupporterFace = { kind: 'INDIVIDUAL', userId: 'helper', profileActive: true }
const opts = { involved: false, requireMfaForSensitive: true }
// 個人の相談は団体だけ
assert.equal(supporterCaseAccess(base, org, opts), 'FULL')
assert.equal(supporterCaseAccess(base, person, opts), 'NONE')
// 会社・地域の相談は個人の支え手にも。機微・18歳未満は出さない
const company = { ...base, subject_type: 'COMPANY' as const, subject_organization_id: 'corp' }
assert.equal(supporterCaseAccess(company, person, opts), 'FULL')
assert.equal(supporterCaseAccess({ ...company, is_sensitive: true }, person, opts), 'NONE')
assert.equal(supporterCaseAccess({ ...company, is_minor: true }, person, opts), 'NONE')
// 機微な相談は団体でも2つ目の確認がまだなら中身を見せない
assert.equal(supporterCaseAccess({ ...base, is_sensitive: true }, org, opts), 'LOCKED')
assert.equal(supporterCaseAccess({ ...base, is_sensitive: true }, { ...org, mfaVerified: true }, opts), 'FULL')
assert.equal(supporterCaseAccess({ ...base, is_minor: true }, org, { ...opts, requireMfaForSensitive: false }), 'FULL')
// 承認前の団体・所属が外れた人には何も見えない
assert.equal(supporterCaseAccess(base, { ...org, organizationApproved: false }, opts), 'NONE')
assert.equal(supporterCaseAccess(base, { ...org, membershipActive: false }, opts), 'NONE')
// 自分の相談・自分の団体の相談は支える側に出さない
assert.equal(supporterCaseAccess({ ...base, owner_user_id: 'staff' }, org, opts), 'NONE')
assert.equal(supporterCaseAccess({ ...company, subject_organization_id: 'npo' }, org, opts), 'NONE')
assert.equal(supporterCaseAccess({ ...company, owner_user_id: 'helper' }, person, opts), 'NONE')
// 受付が終わった相談は、関わった人だけ
assert.equal(supporterCaseAccess({ ...base, status: 'RESOLVED' }, org, opts), 'NONE')
assert.equal(supporterCaseAccess({ ...base, status: 'RESOLVED' }, org, { ...opts, involved: true }), 'FULL')
assert.equal(supporterCaseAccess({ ...base, visibility: 'UNLISTED' }, org, opts), 'NONE')
// 申し出: 個人は電話番号の確認が要る。申し出済み・受付終了は不可
assert.equal(canOffer(company, person, { alreadyOffered: false, phoneVerified: false, requireMfaForSensitive: true }), false)
assert.equal(canOffer(company, person, { alreadyOffered: false, phoneVerified: true, requireMfaForSensitive: true }), true)
assert.equal(canOffer(base, org, { alreadyOffered: true, requireMfaForSensitive: true }), false)
assert.equal(canOffer({ ...base, status: 'RESOLVED' }, org, { alreadyOffered: false, requireMfaForSensitive: true }), false)
assert.equal(canOffer({ ...base, is_sensitive: true }, org, { alreadyOffered: false, requireMfaForSensitive: true }), false)

// ---- 引き継ぎコード(10 字・XXXXX-XXXXX。240 以上のバイトは捨てて偏りを出さない)
const code = formatHandoverCode(new Uint8Array([0, 1, 2, 3, 4, 250, 29, 99, 5, 6, 7]))
assert.match(code, /^[2-9A-Z]{5}-[2-9A-Z]{5}$/)
assert.equal(code, '23456-ZB789')
assert.ok(![...'01OILU'].some((ch) => HANDOVER_ALPHABET.includes(ch)))
assert.equal(normalizeHandoverInput('23456 zb789'), '23456-ZB789')
assert.equal(normalizeHandoverInput('23456ZB789'), '23456-ZB789')
assert.equal(normalizeHandoverInput('23456-ZB78O'), null) // O は使っていない
assert.equal(normalizeHandoverInput('234-56Z'), null) // 6 字の古い形は受けない
assert.throws(() => formatHandoverCode(new Uint8Array(9)))
assert.throws(() => formatHandoverCode(new Uint8Array(20).fill(255))) // 使える値がない

console.log('domain: ok')

// ---- 相談の受付
import('../../src/lib/domain/intake').then(({ assessIntake, canConsultAs, optionsFor, provisionalTitle, sanitizeEntryCode, sanitizeSelection }) => {
  assert.equal(optionsFor('PERSON').length, 115)
  assert.ok(optionsFor('COMPANY').length > 0 && optionsFor('COMMUNITY').length > 0)
  // 主体の選択肢にない番号・重複は落とし、3つで切る
  assert.deepEqual(sanitizeSelection('PERSON', ['1.1.1', '1.1.1', 'x', '11.1.1', '2.1.1', '3.4.2']), ['1.1.1', '11.1.1', '2.1.1'])
  const companyFirst = optionsFor('COMPANY')[0].id
  assert.deepEqual(sanitizeSelection('PERSON', [companyFirst]).length <= 1, true)
  assert.deepEqual(sanitizeSelection('COMPANY', [companyFirst]), [companyFirst])
  // 緊急: 緊急の印のある選択肢か、本文の言葉
  assert.equal(assessIntake({ subject: 'PERSON', indicatorIds: ['3.4.2'], text: '…', personIsMinor: false, organizationPopulation: null }).urgency, 'High')
  assert.equal(assessIntake({ subject: 'PERSON', indicatorIds: [], text: 'もう死にたい', personIsMinor: false, organizationPopulation: null }).urgency, 'High')
  assert.equal(assessIntake({ subject: 'PERSON', indicatorIds: [], text: 'quiero morir', personIsMinor: false, organizationPopulation: null }).urgency, 'High')
  assert.equal(assessIntake({ subject: 'PERSON', indicatorIds: ['1.1.1'], text: 'お金がない', personIsMinor: false, organizationPopulation: null }).urgency, 'Medium')
  // 18歳未満は機微。会社の相談では担当者の年齢を使わない
  const minor = assessIntake({ subject: 'PERSON', indicatorIds: ['1.1.1'], text: 'x', personIsMinor: true, organizationPopulation: null })
  assert.equal(minor.isMinor, true)
  assert.equal(minor.isSensitive, true)
  const company = assessIntake({ subject: 'COMPANY', indicatorIds: [companyFirst], text: 'x', personIsMinor: true, organizationPopulation: 120 })
  assert.equal(company.isMinor, false)
  // 対象の人数: 個人は 1、団体は登録した人数(なければ 1)
  assert.equal(company.affectedPopulation, 120)
  assert.equal(assessIntake({ subject: 'COMMUNITY', indicatorIds: [], text: 'x', personIsMinor: false, organizationPopulation: null }).affectedPopulation, 1)
  assert.equal(assessIntake({ subject: 'PERSON', indicatorIds: [], text: 'x', personIsMinor: false, organizationPopulation: 999 }).affectedPopulation, 1)
  // 会社として相談できるのは会社、地域として相談できるのは自治体と地域団体
  assert.equal(canConsultAs('COMPANY', 'COMPANY'), true)
  assert.equal(canConsultAs('COMPANY', 'NPO'), false)
  assert.equal(canConsultAs('COMMUNITY', 'MUNICIPALITY'), true)
  assert.equal(canConsultAs('COMMUNITY', 'COMMUNITY'), true)
  assert.equal(canConsultAs('COMMUNITY', 'COMPANY'), false)
  // 仮の題
  assert.equal(provisionalTitle('PERSON', ['11.1.1'], '本文'), '安全に暮らせる住まいがない')
  assert.equal(provisionalTitle('PERSON', [], 'あ'.repeat(50)).length, 41)
  // 相談所コード
  assert.equal(sanitizeEntryCode('shop-01'), 'shop-01')
  assert.equal(sanitizeEntryCode('<script>'), null)
  console.log('domain intake: ok')
})
