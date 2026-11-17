// 相談の下書き(ログインの往復で書いた内容を失わない)。実行: npm run test:units
import assert from 'node:assert/strict'
import { DRAFT_TTL_MS, parseDraft, serializeDraft, type ConsultDraft } from '../../src/lib/domain/consultDraft'
import { INTAKE_INDICATORS } from '../../src/lib/constants/intakeIndicators'
import { COMPANY_INTAKE_INDICATORS } from '../../src/lib/constants/orgIntakeIndicators.generated'

const NOW = Date.UTC(2026, 10, 17, 3, 0, 0)
const p1 = INTAKE_INDICATORS[0].id
const p2 = INTAKE_INDICATORS[1].id
const c1 = COMPANY_INTAKE_INDICATORS[0].id
const person: ConsultDraft = { subject: 'PERSON', words: '食べ物が足りない', since: '先月から', wish: '', selected: [p1], suggested: [p1, p2] }

// 書いたものがそのまま戻る
assert.deepEqual(parseDraft(serializeDraft(person, NOW), 'PERSON', NOW + 60_000), person)
// 主体が違う下書きは使わない(個人で書いたものを会社の入口に出さない)
assert.equal(parseDraft(serializeDraft(person, NOW), 'COMPANY', NOW), null)
// 古いもの・未来の時刻のものは捨てる
assert.equal(parseDraft(serializeDraft(person, NOW), 'PERSON', NOW + DRAFT_TTL_MS + 1), null)
assert.equal(parseDraft(serializeDraft(person, NOW + 5 * 60_000), 'PERSON', NOW), null)
// 壊れたもの・空のもの
assert.equal(parseDraft(null, 'PERSON', NOW), null)
assert.equal(parseDraft('{', 'PERSON', NOW), null)
assert.equal(parseDraft('"text"', 'PERSON', NOW), null)
assert.equal(parseDraft(serializeDraft({ ...person, words: '   ' }, NOW), 'PERSON', NOW), null)
assert.equal(parseDraft(JSON.stringify({ v: 2, savedAt: NOW, ...person }), 'PERSON', NOW), null)
assert.equal(parseDraft(serializeDraft({ ...person, words: 'あ'.repeat(2001) }, NOW), 'PERSON', NOW), null)
// その主体の選択肢にないもの・重なり・上限を超えたものは落とす
const messy = JSON.stringify({ v: 1, savedAt: NOW, ...person, selected: [p1, p1, 'x.y.z', c1, p2], suggested: [p1, 7, 'nope'] })
assert.deepEqual(parseDraft(messy, 'PERSON', NOW)?.selected, [p1, p2])
assert.deepEqual(parseDraft(messy, 'PERSON', NOW)?.suggested, [p1])
// 会社の下書きは会社の選択肢で確かめる
const company: ConsultDraft = { subject: 'COMPANY', words: '人手が足りない', since: '', wish: '', selected: [c1], suggested: [] }
assert.deepEqual(parseDraft(serializeDraft(company, NOW), 'COMPANY', NOW), company)

console.log('consultDraft: ok')
