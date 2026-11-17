// ログインのあとに戻る先。実行: npm run test:units
import assert from 'node:assert/strict'
import { loginPathFor, safeNext } from '../../src/lib/domain/safeNext'

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

// ログインへ送るとき、クエリを落とさない(地域として相談する → ログイン → 地域の入口に戻る)
assert.equal(loginPathFor('/consult/org', '?subject=COMMUNITY'), '/start?next=%2Fconsult%2Forg%3Fsubject%3DCOMMUNITY')
assert.equal(loginPathFor('/home'), '/start?next=%2Fhome')
assert.equal(loginPathFor('/home', ''), '/start?next=%2Fhome')
// 送った先で読み戻すと、元のパスとクエリになる
const back = new URLSearchParams(loginPathFor('/consult/org', '?subject=COMMUNITY&shop=ABC').split('?')[1]).get('next')
assert.equal(safeNext(back), '/consult/org?subject=COMMUNITY&shop=ABC')

console.log('safeNext: ok')
