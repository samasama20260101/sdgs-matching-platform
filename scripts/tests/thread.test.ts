// やりとりの読み直しで新しい分だけを足す決まり。実行: npm run test:units
import assert from 'node:assert/strict'
import { mergeThread, parseThreadAfter, THREAD_POLL_OVERLAP_MS, threadPollAfter } from '../../src/lib/domain/thread'

const m = (id: string, at: string, extra: Record<string, unknown> = {}) => ({ id, createdAt: at, ...extra })

// 次に取るのは、最後の時刻より少し前から
assert.equal(threadPollAfter([]), null)
assert.equal(threadPollAfter([m('a', '2026-11-05T10:00:00.000Z'), m('b', '2026-11-05T10:05:00.000Z')]), new Date(Date.parse('2026-11-05T10:05:00.000Z') - THREAD_POLL_OVERLAP_MS).toISOString())
assert.equal(threadPollAfter([m('a', 'x')]), null)

// 足す: 重なった id は新しく取った方、古い順
const prev = [m('a', '2026-11-05T10:00:00.000Z'), m('b', '2026-11-05T10:05:00.000Z', { translation: null })]
const incoming = [m('b', '2026-11-05T10:05:00.000Z', { translation: '訳' }), m('c', '2026-11-05T10:04:30.000Z')]
const merged = mergeThread(prev, incoming)
assert.deepEqual(merged.map((x) => x.id), ['a', 'c', 'b']) // あとから見えた c も時刻の位置に入る
assert.equal((merged[2] as { translation?: string }).translation, '訳')
assert.deepEqual(mergeThread([], []), [])

// API の after
assert.equal(parseThreadAfter(null), null)
assert.equal(parseThreadAfter('not a date'), null)
assert.equal(parseThreadAfter('2026-11-05T10:00:00Z'), '2026-11-05T10:00:00.000Z')

console.log('thread: ok')
