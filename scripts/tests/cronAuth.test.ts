// cron の認証チェックの回帰テスト。実行: npm run test:units
import assert from 'node:assert/strict'
import { isValidCronAuthorization } from '../../src/lib/api/cronAuth'

const SECRET = 'a'.repeat(64)

assert.equal(isValidCronAuthorization(`Bearer ${SECRET}`, SECRET), true)
// 違う値・形式違い・ヘッダーなしは拒否
assert.equal(isValidCronAuthorization('Bearer wrong', SECRET), false)
assert.equal(isValidCronAuthorization(SECRET, SECRET), false)
assert.equal(isValidCronAuthorization(null, SECRET), false)
// CRON_SECRET が未設定・空なら、何を送っても拒否(以前は「Bearer undefined」で通っていた)
assert.equal(isValidCronAuthorization('Bearer undefined', undefined), false)
assert.equal(isValidCronAuthorization('Bearer ', ''), false)
assert.equal(isValidCronAuthorization('Bearer undefined', ''), false)

console.log('cronAuth: ok')
