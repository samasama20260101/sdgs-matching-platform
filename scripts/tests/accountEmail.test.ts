// ログインのメールアドレスの変更(#155)。実行: npm run test:units
import assert from 'node:assert/strict'
import { adminEmailChangeBlocker, emailChangeError, normalizeEmail, normalizePhone, phoneChangeError } from '../../src/lib/domain/accountEmail'

// メールアドレス
assert.equal(normalizeEmail('  Taro@Example.JP '), 'taro@example.jp')
assert.equal(normalizeEmail('taro@example'), null)
assert.equal(normalizeEmail('taro example@example.jp'), null)
assert.equal(normalizeEmail(''), null)
assert.equal(normalizeEmail(`${'a'.repeat(250)}@x.jp`), null)

// 電話番号: 日本の番号は 0 から書いても +81 に直す
assert.equal(normalizePhone('090-1234-5678'), '+819012345678')
assert.equal(normalizePhone('09012345678'), '+819012345678')
assert.equal(normalizePhone('０９０－１２３４－５６７８'), '+819012345678')
assert.equal(normalizePhone('０９０１２３４５６７８'), '+819012345678')
assert.equal(normalizePhone('03-1234-5678'), '+81312345678')
assert.equal(normalizePhone('(03) 1234 5678'), '+81312345678')
// 国番号のあとに 0 を残した書き方
assert.equal(normalizePhone('+81 090-1234-5678'), '+819012345678')
assert.equal(normalizePhone('+819012345678'), '+819012345678')
assert.equal(normalizePhone('819012345678'), '+819012345678')
// 日本の外の番号はそのまま
assert.equal(normalizePhone('+1 415 555 2671'), '+14155552671')
assert.equal(normalizePhone('+880 1712-345678'), '+8801712345678')
// 形が違う
assert.equal(normalizePhone('+81'), null)
assert.equal(normalizePhone('1234'), null)
assert.equal(normalizePhone('abc'), null)
assert.equal(normalizePhone(''), null)

// 運営の画面で変えてよい人: 支援団体の今いるメンバーだけ
const member = { role: 'PERSON', isSuspended: false }
const supportOrg = { application: { purpose: 'SUPPORT' }, status: 'ACTIVE' }
assert.equal(adminEmailChangeBlocker({ user: member, organization: supportOrg, membershipStatus: 'ACTIVE' }), null)
// v1 から移った団体は purpose を持たない(支え手の団体として扱う)
assert.equal(adminEmailChangeBlocker({ user: member, organization: { application: null, status: 'ACTIVE' }, membershipStatus: 'ACTIVE' }), null)
// 相談者の会社・地域だけの人は変えない(本人と確かめる相手がいない)
assert.equal(adminEmailChangeBlocker({ user: member, organization: { application: { purpose: 'CONSULT' }, status: 'ACTIVE' }, membershipStatus: 'ACTIVE' }), 'NOT_SUPPORT_ORGANIZATION')
// 抜けた・招待中のメンバーは変えない
assert.equal(adminEmailChangeBlocker({ user: member, organization: supportOrg, membershipStatus: 'LEFT' }), 'NOT_MEMBER')
assert.equal(adminEmailChangeBlocker({ user: member, organization: supportOrg, membershipStatus: 'INVITED' }), 'NOT_MEMBER')
assert.equal(adminEmailChangeBlocker({ user: member, organization: supportOrg, membershipStatus: null }), 'NOT_MEMBER')
// 消した団体
assert.equal(adminEmailChangeBlocker({ user: member, organization: { ...supportOrg, status: 'ARCHIVED' }, membershipStatus: 'ACTIVE' }), 'NO_ORGANIZATION')
assert.equal(adminEmailChangeBlocker({ user: member, organization: null, membershipStatus: 'ACTIVE' }), 'NO_ORGANIZATION')
// 運営のアカウント・止めた人・いない人
assert.equal(adminEmailChangeBlocker({ user: { role: 'ADMIN', isSuspended: false }, organization: supportOrg, membershipStatus: 'ACTIVE' }), 'ADMIN_ACCOUNT')
assert.equal(adminEmailChangeBlocker({ user: { role: 'PERSON', isSuspended: true }, organization: supportOrg, membershipStatus: 'ACTIVE' }), 'SUSPENDED')
assert.equal(adminEmailChangeBlocker({ user: null, organization: supportOrg, membershipStatus: 'ACTIVE' }), 'NO_USER')

// Auth が断ったときの言葉
assert.equal(emailChangeError({ code: 'email_exists', status: 422 }), 'TAKEN')
assert.equal(emailChangeError({ code: 'over_email_send_rate_limit', status: 429 }), 'TOO_MANY')
assert.equal(emailChangeError({ status: 429 }), 'TOO_MANY')
assert.equal(emailChangeError({ code: 'insufficient_aal', status: 403 }), 'NEEDS_MFA')
assert.equal(emailChangeError({ code: 'email_address_invalid', status: 400 }), 'INVALID')
assert.equal(emailChangeError({ status: 500 }), 'FAILED')
assert.equal(emailChangeError({}), 'FAILED')

// 電話番号の確認で Auth が断ったときの言葉
assert.equal(phoneChangeError({ code: 'phone_exists', status: 422 }), 'TAKEN')
assert.equal(phoneChangeError({ code: 'over_sms_send_rate_limit', status: 429 }), 'TOO_MANY')
assert.equal(phoneChangeError({ status: 429 }), 'TOO_MANY')
assert.equal(phoneChangeError({ code: 'validation_failed', status: 400, message: 'Invalid phone number format (E.164 required)' }), 'INVALID')
// Twilio が番号の形を断った(60200)
assert.equal(phoneChangeError({
  code: 'sms_send_failed',
  status: 422,
  message: 'Error sending phone_change OTP to provider: Invalid parameter `To`: +810000000000 More information: https://www.twilio.com/docs/errors/60200',
}), 'INVALID')
// Twilio の審査が済んでいない(21608)など、番号のせいではない断り
assert.equal(phoneChangeError({
  code: 'sms_send_failed',
  status: 422,
  message: 'Error sending phone_change OTP to provider: To send messages or make calls to unverified numbers, you must have an approved Primary Compliance Profile. More information: https://www.twilio.com/docs/errors/21608',
}), 'SEND_FAILED')
assert.equal(phoneChangeError({ code: 'sms_send_failed', status: 422 }), 'SEND_FAILED')
// ログインが切れた・つながらないなど
assert.equal(phoneChangeError({ status: 401 }), 'FAILED')
assert.equal(phoneChangeError({}), 'FAILED')

console.log('accountEmail: ok')
