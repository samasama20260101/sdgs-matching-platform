// 世界の数(n)の読み替え。実行: npm run test:units
import assert from 'node:assert/strict'
import { toPeople, unitMultiplier } from '../../src/lib/domain/worldCount'
import { WORLD_COUNTS, WORLD_POPULATION } from '../../src/lib/constants/worldCounts.generated'
import { WORLD_COUNT_SOURCES } from '../../src/lib/constants/worldCountSources'

assert.equal(unitMultiplier('NUM_M'), 1_000_000)
assert.equal(unitMultiplier('NUM_TH'), 1_000)
assert.equal(unitMultiplier('NUMBER'), 1)
assert.equal(unitMultiplier('PERCENT'), null)
assert.equal(unitMultiplier(undefined), null)

// 人数の系列: 単位の倍率を掛ける
assert.equal(toPeople('count', 644.6, 'NUM_M', 8_000_000_000), 644_600_000)
assert.equal(toPeople('count', 148.1, 'NUM_TH', 0), 148_100)
assert.equal(toPeople('count', 12, 'PERCENT', 8_000_000_000), null) // 人数の系列なのに割合の単位は載せない
// 割合の系列: 世界の人口を掛ける
assert.equal(toPeople('share', 10.4, 'PERCENT', 8_215_424_893), 854_404_189)
assert.equal(toPeople('share', 10.4, 'NUMBER', 8_215_424_893), null)
// 行き届いていない割合: 100 から引いて人口を掛ける(電気が使える人 91.9% → 使えない人 8.1%)
assert.equal(toPeople('lacking', 91.9, 'PERCENT', 8_000_000_000), 648_000_000)
assert.equal(toPeople('lacking', 100, 'PERCENT', 8_000_000_000), 0)
assert.equal(toPeople('share', 120, 'PERCENT', 8_000_000_000), null)
assert.equal(toPeople('count', -1, 'NUMBER', 1), null)
assert.equal(toPeople('count', Number.NaN, 'NUMBER', 1), null)

// 作った値の形: 世界の人口は 70 億〜100 億、n は z を超えない、載せた指標はすべて対応表にある
assert.ok(WORLD_POPULATION.value > 7e9 && WORLD_POPULATION.value < 1e10)
for (const [code, n] of Object.entries(WORLD_COUNTS)) {
  assert.ok(WORLD_COUNT_SOURCES[code], `${code} が対応表にない`)
  assert.equal(n.series, WORLD_COUNT_SOURCES[code].series, code)
  assert.ok(n.value >= 0 && n.value <= WORLD_POPULATION.value, `${code} の n が範囲外`)
  assert.ok(n.year >= 2000 && n.year <= 2100, `${code} の年`)
}

console.log('worldCount: ok')
