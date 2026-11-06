// AI の提供元とモデルの決め方、返事から JSON を取り出す処理。実行: npm run test:units
import assert from 'node:assert/strict'
import { resolveAiTarget } from '../../src/lib/ai/config'
import { parseJsonObject } from '../../src/lib/ai/json'

// 鍵がなければ AI を使わない
assert.equal(resolveAiTarget('consultation', {}), null)

// 今の本番: Gemini の鍵だけ → Gemini、モデルは今と同じ既定
assert.deepEqual(resolveAiTarget('consultation', { GOOGLE_GEMINI_API_KEY: 'g' }), {
  provider: 'gemini', model: 'gemini-2.5-flash', apiKey: 'g', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', reasoningEffort: null,
})
assert.equal(resolveAiTarget('consultation', { GEMINI_API_KEY: 'g2' })?.apiKey, 'g2')

// OpenAI はモデルを書かないと使わない(推測で既定を置かない)
assert.equal(resolveAiTarget('consultation', { OPENAI_API_KEY: 'o' }), null)
assert.equal(resolveAiTarget('consultation', { OPENAI_API_KEY: 'o', AI_OPENAI_MODEL: 'm-o' })?.model, 'm-o')

// 全体の提供元を指定すると、他の鍵があってもそれを使う
const both = { GOOGLE_GEMINI_API_KEY: 'g', OPENAI_API_KEY: 'o', AI_OPENAI_MODEL: 'm-o', AI_PROVIDER: 'openai' }
assert.equal(resolveAiTarget('consultation', both)?.provider, 'openai')
// 指定した提供元の鍵がなければ使わない(黙って別の会社へ送らない)
assert.equal(resolveAiTarget('consultation', { GOOGLE_GEMINI_API_KEY: 'g', AI_PROVIDER: 'openai', AI_OPENAI_MODEL: 'm' }), null)

// 翻訳は xAI の鍵があれば xAI を先に選ぶ。ほかの用途は Gemini のまま
const withXai = { GOOGLE_GEMINI_API_KEY: 'g', XAI_API_KEY: 'x', AI_XAI_MODEL: 'grok-m' }
assert.equal(resolveAiTarget('translation', withXai)?.provider, 'xai')
assert.equal(resolveAiTarget('translation', withXai)?.baseUrl, 'https://api.x.ai/v1')
assert.equal(resolveAiTarget('consultation', withXai)?.provider, 'gemini')
// xAI の鍵はあるがモデルがない → 翻訳は使えない(Gemini に黙って切り替えない)
assert.equal(resolveAiTarget('translation', { GOOGLE_GEMINI_API_KEY: 'g', XAI_API_KEY: 'x' }), null)

// 用途ごとの上書き。用途のモデルは用途の提供元を指定したときだけ効く
const perTask = { GOOGLE_GEMINI_API_KEY: 'g', OPENAI_API_KEY: 'o', AI_NEWS_PROVIDER: 'openai', AI_NEWS_MODEL: 'news-m' }
assert.equal(resolveAiTarget('news', perTask)?.provider, 'openai')
assert.equal(resolveAiTarget('news', perTask)?.model, 'news-m')
assert.equal(resolveAiTarget('consultation', perTask)?.provider, 'gemini')
assert.equal(resolveAiTarget('consultation', { GOOGLE_GEMINI_API_KEY: 'g', AI_CONSULTATION_MODEL: 'ignored' })?.model, 'gemini-2.5-flash')

// 知らない提供元の名前は無視する。base URL は上書きでき、末尾の / を落とす
assert.equal(resolveAiTarget('consultation', { GOOGLE_GEMINI_API_KEY: 'g', AI_PROVIDER: 'claude' })?.provider, 'gemini')
assert.equal(resolveAiTarget('consultation', { OPENAI_API_KEY: 'o', AI_OPENAI_MODEL: 'm', AI_OPENAI_BASE_URL: 'https://proxy.example/v1/' })?.baseUrl, 'https://proxy.example/v1')

// 考える量は提供元ごとに書いたときだけ。大文字でもよく、知らない値と Gemini には付けない
const luna = { OPENAI_API_KEY: 'o', AI_OPENAI_MODEL: 'gpt-6-luna', AI_OPENAI_REASONING_EFFORT: 'Low', XAI_API_KEY: 'x', AI_XAI_MODEL: 'grok-4.20-0309-non-reasoning' }
assert.equal(resolveAiTarget('consultation', luna)?.reasoningEffort, 'low')
assert.equal(resolveAiTarget('translation', luna)?.provider, 'xai')
assert.equal(resolveAiTarget('translation', luna)?.reasoningEffort, null)
assert.equal(resolveAiTarget('consultation', { OPENAI_API_KEY: 'o', AI_OPENAI_MODEL: 'm', AI_OPENAI_REASONING_EFFORT: 'lowest' })?.reasoningEffort, null)
assert.equal(resolveAiTarget('consultation', { GOOGLE_GEMINI_API_KEY: 'g', AI_GEMINI_REASONING_EFFORT: 'low' })?.reasoningEffort, null)

// JSON の取り出し
assert.deepEqual(parseJsonObject('{"a":1}'), { a: 1 })
assert.deepEqual(parseJsonObject('```json\n{"a":1}\n```'), { a: 1 })
assert.deepEqual(parseJsonObject('はい。\n{"a":{"b":2}}\n以上です'), { a: { b: 2 } })
assert.equal(parseJsonObject('[1,2]'), null)
assert.equal(parseJsonObject('{"a":'), null)
assert.equal(parseJsonObject(''), null)

console.log('aiConfig: ok')
