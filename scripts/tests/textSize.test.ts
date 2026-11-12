// 文字の大きさの設定(引き続き考えることの 19)。実行: npm run test:units
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseTextSize, textSizeAttr, textSizeBootScript, TEXT_SIZE_KEY } from '../../src/lib/domain/textSize'

// 覚えた値の読み方: 知らない値や読めないときは「ふつう」
assert.equal(parseTextSize('large'), 'large')
assert.equal(parseTextSize('normal'), 'normal')
assert.equal(parseTextSize(null), 'normal')
assert.equal(parseTextSize(undefined), 'normal')
assert.equal(parseTextSize('LARGE'), 'normal')

// 「ふつう」は属性を付けない
assert.equal(textSizeAttr('normal'), null)
assert.equal(textSizeAttr('large'), 'large')

// 最初の描画の前のスクリプト: 覚えた値が large のときだけ属性を付ける。localStorage が使えなくても落ちない
function run(stored: string | null, throws = false) {
  const attrs: Record<string, string> = {}
  const localStorage = { getItem: (k: string) => { if (throws) throw new Error('blocked'); return k === TEXT_SIZE_KEY ? stored : null } }
  const document = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v } } }
  new Function('localStorage', 'document', textSizeBootScript())(localStorage, document)
  return attrs
}
assert.deepEqual(run('large'), { 'data-text-size': 'large' })
assert.deepEqual(run('normal'), {})
assert.deepEqual(run(null), {})
assert.deepEqual(run('large', true), {})

console.log('textSize: ok')

// 画面の文字の大きさは text-t13 のような名前で書く。text-[13px] と書くと「わたし」の文字の大きさが効かない
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.tsx') ? [path] : []
  })
}
const offenders = walk(join(process.cwd(), 'src')).filter((f) => /text-\[\d+(\.\d+)?px\]/.test(readFileSync(f, 'utf8')))
assert.deepEqual(offenders, [], `text-[Npx] を使っている: ${offenders.join(', ')}`)
console.log('textSize (px の文字の大きさなし): ok')
