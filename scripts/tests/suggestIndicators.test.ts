// 相談を書いたあとの「近いもの」。実行: npm run test:units
import assert from 'node:assert/strict'
import { buildSuggestPrompt, MAX_SUGGESTIONS, parseSuggestions, suggestByOverlap } from '../../src/lib/ai/prompts/suggestIndicators'
import { optionsFor } from '../../src/lib/domain/intake'

const options = optionsFor('PERSON').map((o) => ({ id: o.id, text: o.text }))
const allowed = new Set(options.map((o) => o.id))

// 返事の読み取り: 一覧にない番号・重なり・6つ目以降を捨てる
assert.deepEqual(parseSuggestions({ ids: ['11.1.1', '99.9.9', '11.1.1', '1.3.1', 3] }, allowed), ['11.1.1', '1.3.1'])
assert.deepEqual(parseSuggestions({ ids: options.slice(0, 8).map((o) => o.id) }, allowed).length, MAX_SUGGESTIONS)
assert.deepEqual(parseSuggestions({}, allowed), [])

// 頼み方: 相談文は囲いの中、一覧の番号と文が入る
const prompt = buildSuggestPrompt({ fencedText: '<consultation>\n家賃\n</consultation>', options: options.slice(0, 2) })
assert.ok(prompt.includes('<consultation>'))
assert.ok(prompt.includes(`${options[0].id}: ${options[0].text}`))

// AI がないとき: 文字の重なりで近いものを出す
const housing = suggestByOverlap('安全に暮らせる住まいがなくて困っています', options)
assert.ok(housing.includes('11.1.1'), `住まいの相談に 11.1.1 が出ない: ${housing.join(',')}`)
assert.ok(housing.length <= MAX_SUGGESTIONS)
assert.deepEqual(suggestByOverlap('あ', options), [])
assert.deepEqual(suggestByOverlap('qwerty zxcv', options), [])

console.log('suggestIndicators: ok')
