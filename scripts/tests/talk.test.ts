// やりとりの一覧の「だれの番か」と並べ方。実行: npm run test:units
import assert from 'node:assert/strict'
import { previewText, sortTalks, talkTurn, type LastMessage } from '../../src/lib/domain/talk'

const fromSupporter: LastMessage = { at: '2026-11-05T10:00:00Z', preview: 'こんにちは', side: 'SUPPORTER', senderName: 'NPO' }
const fromConsultee: LastMessage = { at: '2026-11-05T09:00:00Z', preview: 'お願いします', side: 'CONSULTEE', senderName: 'すず' }

// 相手が最後に書いていたら、こちらの番
assert.equal(talkTurn(fromSupporter, 'CONSULTEE'), 'mine')
assert.equal(talkTurn(fromSupporter, 'SUPPORTER'), 'theirs')
assert.equal(talkTurn(fromConsultee, 'SUPPORTER'), 'mine')
assert.equal(talkTurn(null, 'CONSULTEE'), 'none')

// こちらの番を先に、あとは新しい順。メッセージのないものは最後
const items = [
  { id: 'a', createdAt: '2026-11-01', lastMessage: null },
  { id: 'b', createdAt: '2026-11-02', lastMessage: fromConsultee },
  { id: 'c', createdAt: '2026-11-03', lastMessage: fromSupporter },
  { id: 'd', createdAt: '2026-11-04', lastMessage: { ...fromConsultee, at: '2026-11-05T11:00:00Z' } },
]
assert.deepEqual(sortTalks(items, 'CONSULTEE').map((i) => i.id), ['c', 'd', 'b', 'a'])
assert.deepEqual(sortTalks(items, 'SUPPORTER').map((i) => i.id), ['d', 'b', 'c', 'a'])

// 一覧の一文
assert.equal(previewText('一行目\n\n二行目'), '一行目 二行目')
assert.equal(previewText('あ'.repeat(70)).length, 61)

console.log('talk: ok')
