// 公開の団体一覧で使う決まり。実行: npm run test:units
import assert from 'node:assert/strict'
import { isSupporterPurpose, publicSupporterType } from '../../src/lib/domain/publicSupporter'

// v1 の種別があればそれを、なければ v2 の org_type を写す
assert.equal(publicSupporterType('CORPORATE', 'NPO'), 'CORPORATE')
assert.equal(publicSupporterType(null, 'NGO'), 'NPO')
assert.equal(publicSupporterType(null, 'COMPANY'), 'CORPORATE')
assert.equal(publicSupporterType(null, 'MUNICIPALITY'), 'GOVERNMENT')
assert.equal(publicSupporterType(null, 'PRO_BONO_LAWYER'), 'OTHER')
assert.equal(publicSupporterType(null, null), 'OTHER')
assert.equal(publicSupporterType('UNKNOWN', 'SCHOOL'), 'OTHER')

// 相談のために登録した団体は、支え手として載せない
assert.equal(isSupporterPurpose({ purpose: 'CONSULT' }), false)
assert.equal(isSupporterPurpose({ purpose: 'SUPPORT' }), true)
assert.equal(isSupporterPurpose(null), true) // v1 から移った団体
assert.equal(isSupporterPurpose({}), true)

console.log('publicSupporter: ok')
