// 画面の枠の立場を開いている画面から決める。実行: npm run test:units
import assert from 'node:assert/strict'
import { modeForPath } from '../../src/lib/client/appMode'

// 支える側の画面は、前に選んだ立場にかかわらず「支える」(知らせのメールから直接開いたとき)
assert.equal(modeForPath('/support', 'consult'), 'support')
assert.equal(modeForPath('/support/find', 'consult'), 'support')
assert.equal(modeForPath('/support/cases/abc', 'consult'), 'support')

// 相談する側だけの画面は「相談する」
for (const p of ['/home', '/talk', '/learn', '/consult/new', '/consult/org', '/cases/abc', '/handover', '/trial']) {
  assert.equal(modeForPath(p, 'support'), 'consult', p)
}

// 両方で使う画面と入口は、前に選んだ立場のまま
assert.equal(modeForPath('/me', 'support'), 'support')
assert.equal(modeForPath('/me', 'consult'), 'consult')
assert.equal(modeForPath('/', 'support'), 'support')

// 名前が前だけ同じ別の画面を取り違えない
assert.equal(modeForPath('/supporters', 'consult'), 'consult')
assert.equal(modeForPath('/supporters', 'support'), 'support')
assert.equal(modeForPath('/homework', 'support'), 'support')

console.log('appMode: ok')
