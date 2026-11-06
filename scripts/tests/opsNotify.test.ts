// 運営への知らせの行き先と文面。実行: npm run test:units
import assert from 'node:assert/strict'
import { formatOpsEvent, opsWebhookFor, type OpsEvent } from '../../src/lib/server/opsNotifyFormat'

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

// 新しい相談: 番号・主体・印・分野・選んだもの・入口・言語・国・運営の画面へのリンク。本文・呼び名・地域は載せない
const ORIGIN = 'https://app.example'
const base: Extract<OpsEvent, { kind: 'NEW_CASE' }> = { kind: 'NEW_CASE', displayId: 'CASE-00001', caseId: 'c-1', subjectType: 'PERSON', subjectName: null, urgent: false, sensitive: false, minor: false, indicators: ['11.1.1'], entryChannel: 'DIRECT', entryCode: null, proxyName: null, locale: 'ja', country: 'JP' }
const person = formatOpsEvent({ ...base, indicators: ['11.1.1'] }, ORIGIN)
assert.equal(person, ['新しい相談 CASE-00001(個人)', '分野: 住まい・地域', '選んだもの: 安全に暮らせる住まいがない', '入口: アプリ', 'https://app.example/admin/cases/c-1'].join('\n'))
// 何も選ばずに届いた相談は「SDGsの隣のお困りごと」
assert.ok(formatOpsEvent({ ...base, indicators: [] }, ORIGIN).includes('分野: SDGsの隣のお困りごと\n選んだもの: なし(自分の言葉だけ)'))
// 機微・18歳未満は選んだものを載せない(分野まで)
const sensitive = formatOpsEvent({ ...base, indicators: ['11.1.1'], urgent: true, sensitive: true, minor: true }, ORIGIN)
assert.ok(sensitive.startsWith('新しい相談 CASE-00001(個人) 緊急・機微・18歳未満\n分野: 住まい・地域\n'))
assert.ok(!sensitive.includes('安全に暮らせる住まいがない'))
assert.ok(!formatOpsEvent({ ...base, indicators: ['11.1.1'], minor: true }, ORIGIN).includes('安全に暮らせる住まいがない'))
// 会社の相談: 団体名と、会社の分野の名前。入口・言語・国
const company = formatOpsEvent({ ...base, subjectType: 'COMPANY', subjectName: 'テスト株式会社', indicators: ['10.4.1'], entryChannel: 'SHOP_CODE', entryCode: 'shop-01', locale: 'en', country: 'US' }, ORIGIN)
assert.ok(company.startsWith('新しい相談 CASE-00001(会社「テスト株式会社」)\n分野: 賃金分配・金融\n選んだもの: 事業で生まれた利益を働く人の賃金に十分還元できていない\n'))
assert.ok(company.includes('入口: 相談所のコード(shop-01) ・ 言語: 英語 ・ 国: アメリカ合衆国'))
// 選んだものは 30 字で切る
assert.match(formatOpsEvent({ ...base, subjectType: 'COMPANY', indicators: ['8.7.1'] }, ORIGIN), /\n選んだもの: 自団体や取引先で.{22}…\n/u)
// 代理の登録
assert.ok(formatOpsEvent({ ...base, entryChannel: 'PROXY', proxyName: 'NPO テスト' }, ORIGIN).includes('入口: 団体の代理の登録(NPO テスト)'))

// つなぎ先の同意: 伝える先と、運営の画面へのリンク
assert.equal(formatOpsEvent({ kind: 'REFERRAL_CONSENT', displayId: 'CASE-00002', caseId: 'c-2', entryName: '熊本県よろず支援拠点', entryPhone: '0963113100' }, ORIGIN),
  'つなぎ先に伝えてよいと選ばれた相談があります CASE-00002\n伝える先: 熊本県よろず支援拠点(0963113100)\nhttps://app.example/admin/cases/c-2')
// 団体の申し込み: 名前・種類・地域と、審査の画面へのリンク
assert.equal(formatOpsEvent({ kind: 'ORG_APPLICATION', organizationId: 'o-1', organizationDisplayId: 'ORG-0001', name: 'NPO テスト', orgType: 'NPO', country: 'JP', regionName: '熊本県' }, ORIGIN),
  '支え手の団体の申し込みが届きました ORG-0001\nNPO テスト(NPO・熊本県)\nhttps://app.example/admin/vetting#ORG-0001')
// 申し出のない相談: 件数と、10 件までの番号とリンク
const many = Array.from({ length: 12 }, (_, i) => ({ displayId: `CASE-${i}`, caseId: `c${i}` }))
const unmatched = formatOpsEvent({ kind: 'UNMATCHED', cases: many }, ORIGIN).split('\n')
assert.equal(unmatched[0], '24時間申し出のない相談が 12 件あります')
assert.equal(unmatched[1], 'CASE-0 https://app.example/admin/cases/c0')
assert.equal(unmatched.at(-1), 'ほか 2 件')
assert.equal(unmatched.length, 12)

console.log('opsNotify: ok')
