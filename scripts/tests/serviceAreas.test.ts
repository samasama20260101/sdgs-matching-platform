import assert from 'node:assert/strict'
import { effectiveServiceAreas, normalizeServiceAreaInput, regionLevelFor, SERVICE_AREAS_MAX } from '../../src/lib/domain/serviceAreas'

// 登録した活動地域があれば、それだけを使う(所在地の都道府県は足さない)
assert.deepEqual(effectiveServiceAreas([{ region_code: 'JP-13', is_nationwide: false }, { region_code: 'JP-14', is_nationwide: false }, { region_code: 'JP-13', is_nationwide: false }], 'JP-27'),
  { registered: true, nationwide: false, regionCodes: ['JP-13', 'JP-14'] })
assert.deepEqual(effectiveServiceAreas([{ region_code: null, is_nationwide: true }], 'JP-27'), { registered: true, nationwide: true, regionCodes: [] })
// 登録がなければ、申し込みのときの都道府県。形の合わない値は使わない
assert.deepEqual(effectiveServiceAreas([], 'JP-27'), { registered: false, nationwide: false, regionCodes: ['JP-27'] })
assert.deepEqual(effectiveServiceAreas([], '大阪府'), { registered: false, nationwide: false, regionCodes: [] })
assert.deepEqual(effectiveServiceAreas([], null), { registered: false, nationwide: false, regionCodes: [] })

const JP = ['JP-01', 'JP-13', 'JP-14', 'JP-27']
// 全国なら地域は持たない
assert.deepEqual(normalizeServiceAreaInput({ nationwide: true, regionCodes: ['JP-13'] }, JP), { ok: true, value: { nationwide: true, regionCodes: [] } })
// 地域は重複を除き、地域の並び順にそろえる
assert.deepEqual(normalizeServiceAreaInput({ nationwide: false, regionCodes: ['JP-27', 'JP-13', 'JP-27'] }, JP), { ok: true, value: { nationwide: false, regionCodes: ['JP-13', 'JP-27'] } })
// 0 件・ほかの国の地域・多すぎるものは断る
assert.deepEqual(normalizeServiceAreaInput({ nationwide: false, regionCodes: [] }, JP), { ok: false, reason: 'EMPTY' })
assert.deepEqual(normalizeServiceAreaInput({ nationwide: false, regionCodes: ['JP-13', 'ID-JK'] }, JP), { ok: false, reason: 'UNKNOWN_REGION' })
const many = Array.from({ length: SERVICE_AREAS_MAX + 1 }, (_, i) => `XX-${i}`)
assert.deepEqual(normalizeServiceAreaInput({ nationwide: false, regionCodes: many }, many), { ok: false, reason: 'TOO_MANY' })

assert.equal(regionLevelFor('JP'), 'prefecture')
assert.equal(regionLevelFor('ID'), 'province')
console.log('serviceAreas: ok')
