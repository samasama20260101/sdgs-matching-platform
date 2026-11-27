// 相談がまだないときの画面に出すもの(#177)。実行: npm run test:units
import assert from 'node:assert/strict'
import { HOME_SUPPORTER_TILES, homeSupporterTiles, supporterInitial } from '../../src/lib/domain/emptyStates'

type S = { id: string; nationwide: boolean; areas: { region_code: string }[] }
const s = (id: string, nationwide: boolean, codes: string[] = []): S => ({ id, nationwide, areas: codes.map((region_code) => ({ region_code })) })
const list = [s('a', false, ['JP-13']), s('b', false, ['JP-14']), s('c', true), s('d', false, ['JP-12'])]

// 地域が分からない人には、元の並びの上から 2 つ
assert.deepEqual(homeSupporterTiles(list, null).map((x) => x.id), ['a', 'b'])
// 地域で受けている団体と全国の団体を先にする
assert.deepEqual(homeSupporterTiles(list, 'JP-12').map((x) => x.id), ['c', 'd'])
assert.deepEqual(homeSupporterTiles(list, 'JP-14').map((x) => x.id), ['b', 'c'])
// 数は 2 つまで。団体が少なければあるだけ、0 なら空
assert.equal(HOME_SUPPORTER_TILES, 2)
assert.deepEqual(homeSupporterTiles([s('x', false)], 'JP-13').map((x) => x.id), ['x'])
assert.deepEqual(homeSupporterTiles([], 'JP-13'), [])
// 元の配列を並べ替えない
const before = list.map((x) => x.id)
homeSupporterTiles(list, 'JP-12')
assert.deepEqual(list.map((x) => x.id), before)

// 頭文字: 法人の種類を飛ばす
assert.equal(supporterInitial('NPO法人ことさんち'), 'こ')
assert.equal(supporterInitial('特定非営利活動法人 ことさんち'), 'こ')
assert.equal(supporterInitial('認定NPO法人あおぞら'), 'あ')
assert.equal(supporterInitial('一般社団法人 ユニバーサル就労支援事務局'), 'ユ')
assert.equal(supporterInitial('興学社高等学院'), '興')
assert.equal(supporterInitial('ことさんち株式会社'), 'こ')
// 種類だけの名前は種類の頭を出す(空にしない)
assert.equal(supporterInitial('株式会社'), '株')
// ラテン文字は大文字、サロゲートペアは割らない
assert.equal(supporterInitial('samasama LLC'), 'S')
assert.equal(supporterInitial('𠮷野家の会'), '𠮷')
assert.equal(supporterInitial('  あいう'), 'あ')
assert.equal(supporterInitial(''), '')

console.log('emptyStates: ok')
