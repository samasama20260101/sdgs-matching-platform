// 運営への知らせの行き先と文面。実行: npm run test:units
import assert from 'node:assert/strict'
import { formatOpsEvent, opsWebhookFor } from '../../src/lib/server/opsNotifyFormat'

const both = { DISCORD_OPS_WEBHOOK_URL: 'https://example.test/cases', DISCORD_OPS_APPLICATION_WEBHOOK_URL: 'https://example.test/apps' }

// 相談のことは「新着sos」、団体の申し込みは「サポーター申請」
assert.equal(opsWebhookFor('NEW_CASE', both), 'https://example.test/cases')
assert.equal(opsWebhookFor('REFERRAL_CONSENT', both), 'https://example.test/cases')
assert.equal(opsWebhookFor('UNMATCHED', both), 'https://example.test/cases')
assert.equal(opsWebhookFor('ORG_APPLICATION', both), 'https://example.test/apps')

// 申し込み用がなければ相談のほうへ。どちらもなければ送らない(空白だけも未設定と同じ)
assert.equal(opsWebhookFor('ORG_APPLICATION', { DISCORD_OPS_WEBHOOK_URL: 'https://example.test/cases' }), 'https://example.test/cases')
assert.equal(opsWebhookFor('NEW_CASE', {}), null)
assert.equal(opsWebhookFor('ORG_APPLICATION', { DISCORD_OPS_WEBHOOK_URL: ' ', DISCORD_OPS_APPLICATION_WEBHOOK_URL: '' }), null)

// 文面に中身を載せない(番号と種類と印だけ)
assert.equal(formatOpsEvent({ kind: 'NEW_CASE', displayId: 'CASE-00001', subjectType: 'PERSON', urgent: true, sensitive: true }), '新しい相談 CASE-00001(個人) 緊急・機微')
assert.equal(formatOpsEvent({ kind: 'ORG_APPLICATION', organizationDisplayId: 'ORG-0001' }), '支え手の団体の申し込みが届きました ORG-0001')
assert.equal(formatOpsEvent({ kind: 'UNMATCHED', count: 3 }), '24時間申し出のない相談が 3 件あります')

console.log('opsNotify: ok')
