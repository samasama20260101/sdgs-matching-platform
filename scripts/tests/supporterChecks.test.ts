// 支え手の団体の申し込みの6つの点(面談チェックリスト v0)。実行: npm run test:units
import assert from 'node:assert/strict'
import { SUPPORTER_CHECKS, checkAnswers, missingChecks, parseCheckKey } from '../../src/lib/domain/supporterChecks'

// 6つすべてに選んだものがあれば足りない点はない
const all = Object.fromEntries(SUPPORTER_CHECKS.map((c) => [c, 'yes' as const]))
assert.deepEqual(missingChecks(checkAnswers(all, {})), [])

// 選んでいない点と、知らない値は足りないと数える。並びは決まった順
assert.deepEqual(missingChecks({ check_care: 'yes', check_imagine: 'maybe', check_activity: 'discuss' }), ['imagine', 'consulteeFirst', 'direct', 'barriers'])
assert.deepEqual(missingChecks(null), [...SUPPORTER_CHECKS])

// 一言は前後の空白を落とし、空なら載せない。選んでいない点の一言だけでも載せる
const answers = checkAnswers({ care: 'discuss' }, { care: '  考え中です \n', imagine: '   ', direct: '食事を届けます' })
assert.deepEqual(answers, { check_care: 'discuss', check_care_note: '考え中です', check_direct_note: '食事を届けます' })

// 長すぎる一言は切る
assert.equal(checkAnswers({}, { barriers: 'あ'.repeat(2100) }).check_barriers_note.length, 2000)

// 審査の画面での読み替え
assert.deepEqual(parseCheckKey('check_consulteeFirst'), { check: 'consulteeFirst', part: 'choice' })
assert.deepEqual(parseCheckKey('check_consulteeFirst_note'), { check: 'consulteeFirst', part: 'note' })
assert.equal(parseCheckKey('staff'), null)
assert.equal(parseCheckKey('check_unknown'), null)

console.log('supporterChecks: ok')
