// 解決した相談の要約。実行: npm run test:units
// 相談者と支え手のやりとり(チャット)は利用者どうしの通信なので、要約に使わない・AI に渡さない(通信の秘密、2026-11-27)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildKnowledgePrompt, parseKnowledge } from '../../src/lib/ai/prompts/caseKnowledge'

const prompt = buildKnowledgePrompt('<consultation>家賃が払えない</consultation>')
assert.ok(prompt.includes('<consultation>家賃が払えない</consultation>'))
assert.ok(!prompt.includes('やりとり(同じく'), 'やりとりの欄を戻さない')

assert.deepEqual(parseKnowledge({ content: '家賃の相談。https://example.com' }), { content: '家賃の相談。', actions: '', aftermath: '' })
assert.equal(parseKnowledge({ content: '' }), null)
assert.equal(parseKnowledge({}), null)

// 要約を作る処理が messages の表を読まないこと
const src = readFileSync(join(process.cwd(), 'src/lib/server/caseKnowledge.ts'), 'utf8')
assert.ok(!/from\(['"]messages['"]\)/.test(src), 'caseKnowledge.ts は messages を読まない')
console.log('caseKnowledge: ok')
