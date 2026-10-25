// 流出パスワード(漏洩パスワードのチェック)のエラー判定の回帰テスト。実行: npm run test:units
import assert from 'node:assert/strict'
import { isPwnedPasswordError } from '../../src/lib/authErrors'

const PWNED_MSG = 'Password is known to be weak and easy to guess, please choose a different one.'

// supabase-js の AuthWeakPasswordError の形
assert.equal(isPwnedPasswordError({ code: 'weak_password', reasons: ['pwned'], message: PWNED_MSG }), true)
// GoTrue の生の JSON 応答(/auth/v1/user)の形
assert.equal(isPwnedPasswordError({ code: 422, error_code: 'weak_password', msg: PWNED_MSG, weak_password: { reasons: ['pwned'] } }), true)
// reasons が取れなくても、コードと文で判定できる
assert.equal(isPwnedPasswordError({ code: 'weak_password', message: PWNED_MSG }), true)

// 流出以外の弱いパスワード(短すぎる等)は対象外
assert.equal(isPwnedPasswordError({ code: 'weak_password', reasons: ['length'], message: 'Password should be at least 8 characters.' }), false)
// 同じパスワードへの変更は対象外
assert.equal(isPwnedPasswordError({ code: 'same_password', message: 'New password should be different from the old password.' }), false)
assert.equal(isPwnedPasswordError(null), false)
assert.equal(isPwnedPasswordError(new Error('network')), false)

console.log('authErrors: ok')
