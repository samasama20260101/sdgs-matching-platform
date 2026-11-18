// 相談の下書き(ログインの往復で書いた内容を失わない)。実行: npm run test:units
import assert from 'node:assert/strict'
import { DRAFT_TTL_MS, parseDraft, serializeDraft, type ConsultDraft } from '../../src/lib/domain/consultDraft'

const NOW = Date.UTC(2026, 10, 17, 3, 0, 0)
const person: ConsultDraft = { subject: 'PERSON', words: '食べ物が足りない', since: '先月から', wish: '' }

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
// 前の形の下書き(困りごとを選ぶ段があった頃。選んだもの・近いものを持つ)も、書いた言葉だけを読む(#133)
const older = JSON.stringify({ v: 1, savedAt: NOW, ...person, selected: ['1.1.1'], suggested: ['1.1.1', 'x'] })
assert.deepEqual(parseDraft(older, 'PERSON', NOW), person)
// 会社の下書き
const company: ConsultDraft = { subject: 'COMPANY', words: '人手が足りない', since: '', wish: '' }
assert.deepEqual(parseDraft(serializeDraft(company, NOW), 'COMPANY', NOW), company)

console.log('consultDraft: ok')
