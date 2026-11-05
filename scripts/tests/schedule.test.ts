// 毎日の自動処理の締め切りと、支える側の札の「待っている時間」の見せ方。実行: npm run test:units
import assert from 'node:assert/strict'
import { autoCloseCutoffs, LONG_WAIT_HOURS, waitingLabel } from '../../src/lib/domain/schedule'

// 待っている時間: 24 時間までは時間、それより長いと日数。長く待っている印は 72 時間から(画面の見直し 所見 3)
assert.deepEqual(waitingLabel(5), { unit: 'hours', value: 5, long: false })
assert.deepEqual(waitingLabel(23.9), { unit: 'hours', value: 23, long: false })
assert.deepEqual(waitingLabel(24), { unit: 'days', value: 1, long: false })
assert.deepEqual(waitingLabel(LONG_WAIT_HOURS - 1), { unit: 'days', value: 2, long: false })
assert.deepEqual(waitingLabel(LONG_WAIT_HOURS), { unit: 'days', value: 3, long: true })
assert.deepEqual(waitingLabel(385), { unit: 'days', value: 16, long: true })
assert.deepEqual(waitingLabel(-3), { unit: 'hours', value: 0, long: false })

// 締め切り: 14 日・30 日・24 時間
const now = new Date('2026-11-05T00:00:00Z')
const c = autoCloseCutoffs(now)
assert.equal(c.autoResolveBefore, '2026-10-22T00:00:00.000Z')
assert.equal(c.inactiveBefore, '2026-10-06T00:00:00.000Z')
assert.equal(c.escalateBefore, '2026-11-04T00:00:00.000Z')

console.log('schedule: ok')
