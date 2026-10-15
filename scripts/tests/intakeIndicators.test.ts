// 相談フォームの選択肢(指標)の検査。実行: npm run test:units
// 正本の docs/intake_indicators.md・定数・messages/ja の文言がそろっていること、選択と大項目の決め方を見る
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  INTAKE_CATEGORIES,
  INTAKE_INDICATORS,
  MAX_INDICATOR_SELECTIONS,
  NEIGHBOR_CATEGORY,
  buildIntakeTextForAi,
  categoriesFromIndicators,
  hasUrgentIndicator,
  indicatorMessageKey,
  sanitizeIndicatorIds,
} from '../../src/lib/constants/intakeIndicators'

// ID の重複なし・大項目が定義済み・18 には選択肢がない
const ids = INTAKE_INDICATORS.map((i) => i.id)
assert.equal(new Set(ids).size, ids.length, '指標 ID が重複している')
for (const i of INTAKE_INDICATORS) {
  assert.ok(INTAKE_CATEGORIES[i.category], `${i.id} の大項目 ${i.category} が未定義`)
  assert.ok(i.id.startsWith(`${i.category}.`), `${i.id} の大項目番号がずれている`)
}
assert.equal(INTAKE_INDICATORS.filter((i) => i.category === NEIGHBOR_CATEGORY).length, 0)

// docs の表と定数の文言・緊急フラグが一致する
const doc = readFileSync('docs/intake_indicators.md', 'utf8')
const docRows = [...doc.matchAll(/^\| (\d+) \| [^|]+? \| (\d+\.[0-9a-z]+\.\d+) \| ([^|]+?) \| (⚠?) *\|$/gm)]
assert.equal(docRows.length, INTAKE_INDICATORS.length, 'docs と定数の件数が違う')
for (const [, , id, text, urgent] of docRows) {
  const indicator = INTAKE_INDICATORS.find((i) => i.id === id)
  assert.ok(indicator, `docs の ${id} が定数にない`)
  assert.equal(indicator.text, text, `${id} の文言が docs と違う`)
  assert.equal(Boolean(indicator.urgent), urgent === '⚠', `${id} の緊急フラグが docs と違う`)
}

// messages/ja の文言が定数と一致する
const ja = JSON.parse(readFileSync('messages/ja/sdgs.json', 'utf8'))
for (const i of INTAKE_INDICATORS) {
  assert.equal(ja.indicator[indicatorMessageKey(i.id)], i.text, `messages/ja の ${i.id} が定数と違う`)
}
assert.equal(Object.keys(ja.indicator).length, INTAKE_INDICATORS.length)
for (const [category, label] of Object.entries(INTAKE_CATEGORIES)) {
  assert.equal(ja.category[category], label, `messages/ja の大項目 ${category} が定数と違う`)
}

// 選択の正規化: 不正 ID・重複を落とし、上限で切る
assert.deepEqual(sanitizeIndicatorIds(['1.1.1', 'x', '1.1.1', '3.4.2', '8.5.2', '11.1.1']), ['1.1.1', '3.4.2', '8.5.2'])
assert.equal(MAX_INDICATOR_SELECTIONS, 3)
assert.deepEqual(sanitizeIndicatorIds(null), [])

// 大項目: 重複なし・選んだ順。0 個なら 18
assert.deepEqual(categoriesFromIndicators(['11.1.1', '1.1.1', '1.2.1']), [11, 1])
assert.deepEqual(categoriesFromIndicators([]), [NEIGHBOR_CATEGORY])

// 緊急
assert.equal(hasUrgentIndicator(['1.1.1', '3.4.2']), true)
assert.equal(hasUrgentIndicator(['1.1.1']), false)

// AI に渡す文
assert.equal(buildIntakeTextForAi('選んだ困りごと', ['A', 'B'], ' 本文 '), '選んだ困りごと: A、B\n\n本文')
assert.equal(buildIntakeTextForAi('選んだ困りごと', [], '本文'), '本文')

console.log('intakeIndicators: ok')
