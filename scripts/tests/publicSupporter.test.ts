// 公開の団体一覧で使う決まり。実行: npm run test:units
import assert from 'node:assert/strict'
import { isSupporterPurpose, publicSocialLinks, publicSupporterType, regionFirst } from '../../src/lib/domain/publicSupporter'

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

// SNS などのリンク: http(s) とアカウント名だけ。javascript: などは出さない
assert.deepEqual(publicSocialLinks({ website: 'https://npo.example/', twitter: '@npo_x', instagram: 'https://instagram.com/npo', facebook: 'javascript:alert(1)', line: '@npo-line' }), [
  { kind: 'website', href: 'https://npo.example/', label: '' },
  { kind: 'x', href: 'https://x.com/npo_x', label: '@npo_x' },
  { kind: 'instagram', href: 'https://instagram.com/npo', label: '' },
  { kind: 'line', href: null, label: '@npo-line' },
])
assert.deepEqual(publicSocialLinks({ website: 'javascript:alert(1)', twitter: 'javascript:alert(1)', instagram: 'a b' }), [])
assert.deepEqual(publicSocialLinks({ website: ' http://npo.example ' }), [{ kind: 'website', href: 'http://npo.example/', label: '' }])
assert.deepEqual(publicSocialLinks(null), [])
assert.deepEqual(publicSocialLinks({ line: 'x'.repeat(41) }), [])

// 見ている人の地域(全国を含む)を先に。それ以外の並びは変えない
const a = { id: 'a', nationwide: false, areas: [{ region_code: '13' }] }
const b = { id: 'b', nationwide: false, areas: [{ region_code: '43' }] }
const c = { id: 'c', nationwide: true, areas: [] }
const d = { id: 'd', nationwide: false, areas: [] }
const r = regionFirst([a, b, c, d], '43')
assert.deepEqual(r.items.map((s) => s.id), ['b', 'c', 'a', 'd'])
assert.equal(r.matched.size, 2)
assert.deepEqual(regionFirst([a, b], null).items.map((s) => s.id), ['a', 'b'])

console.log('publicSupporter: ok')
