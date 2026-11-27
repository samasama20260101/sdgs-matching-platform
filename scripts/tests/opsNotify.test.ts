// 運営への知らせの行き先と文面。実行: npm run test:units
import assert from 'node:assert/strict'
import { formatOpsEvent, opsWebhookFor, type OpsEvent } from '../../src/lib/server/opsNotifyFormat'

const both = { DISCORD_OPS_WEBHOOK_URL: 'https://example.test/cases', DISCORD_OPS_APPLICATION_WEBHOOK_URL: 'https://example.test/apps' }

// 相談のことは「新着sos」、団体の申し込みは「サポーター申請」
assert.equal(opsWebhookFor('NEW_CASE', both), 'https://example.test/cases')
assert.equal(opsWebhookFor('REFERRAL_CONSENT', both), 'https://example.test/cases')
assert.equal(opsWebhookFor('UNMATCHED', both), 'https://example.test/cases')
assert.equal(opsWebhookFor('ORG_APPLICATION', both), 'https://example.test/apps')
// お問い合わせも「新着sos」(#175)
assert.equal(opsWebhookFor('NEW_INQUIRY', both), 'https://example.test/cases')

// 申し込み用がなければ相談のほうへ。どちらもなければ送らない(空白だけも未設定と同じ)
assert.equal(opsWebhookFor('ORG_APPLICATION', { DISCORD_OPS_WEBHOOK_URL: 'https://example.test/cases' }), 'https://example.test/cases')
assert.equal(opsWebhookFor('NEW_CASE', {}), null)
assert.equal(opsWebhookFor('ORG_APPLICATION', { DISCORD_OPS_WEBHOOK_URL: ' ', DISCORD_OPS_APPLICATION_WEBHOOK_URL: '' }), null)

// 新しい相談: 番号・主体・印・分野・AI が選んだ指標・入口・言語・国・運営の画面へのリンク。本文・呼び名・地域は載せない
const ORIGIN = 'https://app.example'
const base: Extract<OpsEvent, { kind: 'NEW_CASE' }> = { kind: 'NEW_CASE', displayId: 'CASE-00001', caseId: 'c-1', subjectType: 'PERSON', subjectName: null, urgent: false, sensitive: false, minor: false, indicators: ['11.1.1'], entryChannel: 'DIRECT', entryCode: null, proxyName: null, locale: 'ja', country: 'JP' }
const person = formatOpsEvent({ ...base, indicators: ['11.1.1'] }, ORIGIN)
assert.equal(person, ['新しい相談 CASE-00001(個人)', '分野: 住まい・地域', '指標(AI): 安全に暮らせる住まいがない', '入口: アプリ', 'https://app.example/admin/cases/c-1'].join('\n'))
// 指標のない相談は「SDGsの隣のお困りごと」
assert.ok(formatOpsEvent({ ...base, indicators: [] }, ORIGIN).includes('分野: SDGsの隣のお困りごと\n指標(AI): なし'))
// AI で分類できず機微として扱った相談は、運営が確かめられるように書き添える
const unavailable = formatOpsEvent({ ...base, indicators: [], sensitive: true, aiUnavailable: true }, ORIGIN)
assert.ok(unavailable.includes('\nAI で分類できなかったので、機微として扱っています。'))
assert.ok(!person.includes('AI で分類できなかった'))
// 機微・18歳未満は指標を載せない(分野まで)
const sensitive = formatOpsEvent({ ...base, indicators: ['11.1.1'], urgent: true, sensitive: true, minor: true }, ORIGIN)
assert.ok(sensitive.startsWith('新しい相談 CASE-00001(個人) 緊急・機微・18歳未満\n分野: 住まい・地域\n'))
assert.ok(!sensitive.includes('安全に暮らせる住まいがない'))
assert.ok(!formatOpsEvent({ ...base, indicators: ['11.1.1'], minor: true }, ORIGIN).includes('安全に暮らせる住まいがない'))
// 会社の相談: 会社の名前と、会社の分野の名前。入口・言語・国
const company = formatOpsEvent({ ...base, subjectType: 'COMPANY', subjectName: 'テスト株式会社', indicators: ['10.4.1'], entryChannel: 'SHOP_CODE', entryCode: 'shop-01', locale: 'en', country: 'US' }, ORIGIN)
assert.ok(company.startsWith('新しい相談 CASE-00001(会社「テスト株式会社」)\n分野: 賃金分配・金融\n指標(AI): 事業で生まれた利益を働く人の賃金に十分還元できていない\n'))
assert.ok(company.includes('入口: 相談所のコード(shop-01) ・ 言語: 英語 ・ 国: アメリカ合衆国'))
// 指標は 30 字で切る
assert.match(formatOpsEvent({ ...base, subjectType: 'COMPANY', indicators: ['8.7.1'] }, ORIGIN), /\n指標\(AI\): 自団体や取引先で.{22}…\n/u)
// 代理の登録
assert.ok(formatOpsEvent({ ...base, entryChannel: 'PROXY', proxyName: 'NPO テスト' }, ORIGIN).includes('入口: 支援団体の代理の登録(NPO テスト)'))

// つなぎ先の同意: 伝える先と、運営の画面へのリンク
assert.equal(formatOpsEvent({ kind: 'REFERRAL_CONSENT', displayId: 'CASE-00002', caseId: 'c-2', entryName: '熊本県よろず支援拠点', entryPhone: '0963113100' }, ORIGIN),
  'つなぎ先に伝えてよいと選ばれた相談があります CASE-00002\n伝える先: 熊本県よろず支援拠点(0963113100)\nhttps://app.example/admin/cases/c-2')
// 団体の申し込み: 名前・種類・地域と、審査の画面へのリンク
assert.equal(formatOpsEvent({ kind: 'ORG_APPLICATION', organizationId: 'o-1', organizationDisplayId: 'ORG-0001', name: 'NPO テスト', orgType: 'NPO', country: 'JP', regionName: '熊本県' }, ORIGIN),
  '支援団体の申し込みが届きました ORG-0001\nNPO テスト(NPO・熊本県)\nhttps://app.example/admin/vetting#ORG-0001')
// 申し出のない相談: 件数と、10 件までの番号とリンク
const many = Array.from({ length: 12 }, (_, i) => ({ displayId: `CASE-${i}`, caseId: `c${i}` }))
const unmatched = formatOpsEvent({ kind: 'UNMATCHED', cases: many }, ORIGIN).split('\n')
assert.equal(unmatched[0], '24時間申し出のない相談が 12 件あります')
assert.equal(unmatched[1], 'CASE-0 https://app.example/admin/cases/c0')
assert.equal(unmatched.at(-1), 'ほか 2 件')
assert.equal(unmatched.length, 12)

// お問い合わせ: 番号・一覧にある種類・ログインした人からか・運営の画面へのリンク。本文・名前・メールは載せない(#175)
assert.equal(formatOpsEvent({ kind: 'NEW_INQUIRY', displayId: 'INQ-0001', category: 'アプリへの意見・要望', member: true }, ORIGIN),
  'お問い合わせが届きました INQ-0001\n種類: アプリへの意見・要望(ログインした人から)\nhttps://app.example/admin/inquiries')
assert.ok(formatOpsEvent({ kind: 'NEW_INQUIRY', displayId: 'INQ-0002', category: '取材・メディア', member: false }, ORIGIN).includes('種類: 取材・メディア(ログインしていない人から)'))
// 一覧にない種類(API は自由な文字で受ける)は、送られた文字を外へ出さない
const unknownCategory = formatOpsEvent({ kind: 'NEW_INQUIRY', displayId: 'INQ-0003', category: '090-1234-5678 に電話して', member: false }, ORIGIN)
assert.ok(unknownCategory.includes('種類: 一覧にない種類('))
assert.ok(!unknownCategory.includes('090-1234-5678'))

console.log('opsNotify: ok')
