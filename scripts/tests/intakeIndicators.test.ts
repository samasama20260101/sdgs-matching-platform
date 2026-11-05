// 相談フォームの選択肢(指標)の検査。実行: npm run test:units
// 正本の docs/intake_indicators.md・定数・messages/ja の文言がそろっていることを見る(選び方の決まりは domain.test.ts)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  INTAKE_CATEGORIES,
  INTAKE_INDICATORS,
  MAX_INDICATOR_SELECTIONS,
  NEIGHBOR_CATEGORY,
  indicatorMessageKey,
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

assert.equal(MAX_INDICATOR_SELECTIONS, 3)

console.log('intakeIndicators: ok')
