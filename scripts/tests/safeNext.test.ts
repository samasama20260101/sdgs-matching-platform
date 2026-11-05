// ログインのあとに戻る先。実行: npm run test:units
import assert from 'node:assert/strict'
import { safeNext } from '../../src/lib/domain/safeNext'

assert.equal(safeNext('/cases/abc?sent=1'), '/cases/abc?sent=1')
assert.equal(safeNext('/support/find#x'), '/support/find#x')
assert.equal(safeNext(null), '/home')
assert.equal(safeNext(''), '/home')
// 外のサイトへは戻さない
assert.equal(safeNext('https://evil.example'), '/home')
assert.equal(safeNext('//evil.example'), '/home')
assert.equal(safeNext('/\\evil.example'), '/home') // ?next=/%5Cevil.example を URLSearchParams が戻した形
assert.equal(safeNext('/\tevil.example'), '/home')
assert.equal(safeNext('/%2F%2Fevil.example'), '/%2F%2Fevil.example') // 符号のままならパスとして扱う(同じサイトの中)
// ログインの画面へは戻さない(行ったり来たり)
assert.equal(safeNext('/start?next=/home'), '/home')

console.log('safeNext: ok')
