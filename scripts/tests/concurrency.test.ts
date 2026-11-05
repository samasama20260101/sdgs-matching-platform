// 同時に数件ずつ並べる。実行: npm run test:units
import assert from 'node:assert/strict'
import { mapInBatches } from '../../src/lib/concurrency'

async function main() {
  let running = 0
  let peak = 0
  const out = await mapInBatches([1, 2, 3, 4, 5], 2, async (n) => {
    running++
    peak = Math.max(peak, running)
    await new Promise((r) => setTimeout(r, 5 * (6 - n))) // あとのものほど早く終わっても、順は items のまま
    running--
    return n * 10
  })
  assert.deepEqual(out, [10, 20, 30, 40, 50])
  assert.equal(peak, 2)
  assert.deepEqual(await mapInBatches([], 3, async (n: number) => n), [])
  assert.deepEqual(await mapInBatches([1, 2], 0, async (n) => n), [1, 2]) // 0 以下は 1 件ずつ
  console.log('concurrency: ok')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
