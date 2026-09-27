// お困りごとラベル定数とヘルパーの回帰テスト。実行: npm run test:units
import assert from 'node:assert/strict'
import {
  CONCERN_ITEMS, CONCERN_GROUP_IDS, CONCERN_LABEL_IDS, labelsFromItems, sdgsHintFromLabels,
  getCaseConcerns, getAiLabels, getCaseLabelSet, describeConcernsJa, getItemsForGroup,
} from '../../src/lib/constants/concerns'

// 33 項目・5 括り・8 ラベル、id 重複なし、全項目の group/labels が定数表にある
assert.equal(CONCERN_ITEMS.length, 29)
assert.equal(new Set(CONCERN_ITEMS.map(i => i.id)).size, 29)
assert.equal(CONCERN_GROUP_IDS.length, 5)
assert.equal(CONCERN_LABEL_IDS.length, 8)
for (const item of CONCERN_ITEMS) {
  assert.ok(CONCERN_GROUP_IDS.includes(item.group), item.id)
  assert.ok(item.labels.length >= 1, item.id)
  for (const l of item.labels) assert.ok(CONCERN_LABEL_IDS.includes(l), `${item.id}:${l}`)
}
// 括りごとの項目数(仕様 §3.3: 13 / 4 / 8 / 4 / 4)
assert.deepEqual(CONCERN_GROUP_IDS.map(g => getItemsForGroup(g).length), [9, 4, 8, 4, 4])

// §4.2 の例: 2 括り・3 項目 → 4 ラベル(固定順)
const labels = labelsFromItems(['rent_utility', 'dv', 'childcare'])
assert.deepEqual(labels, ['money', 'housing', 'violence', 'family'])
// 不正 id は無視、重複は畳む
assert.deepEqual(labelsFromItems(['food', 'debt', 'nope', 'food']), ['money'])
assert.deepEqual(labelsFromItems([]), [])

// SDGs ヒント和集合(順序は最初に出た順)
assert.deepEqual(sdgsHintFromLabels(['money', 'housing']), [1, 8, 10, 11, 6, 7])

// 保存形式の読み出し: 旧フォーム/null/壊れた値は null
assert.equal(getCaseConcerns(null), null)
assert.equal(getCaseConcerns({ qa: { 1: ['x'] } }), null)
assert.equal(getCaseConcerns({ concerns: 'bad' }), null)
const c = getCaseConcerns({ form_version: 2, concerns: { groups: ['living', 'zzz'], items: ['rent_utility', 'bogus'], labels: ['alone'] } })
assert.deepEqual(c, { groups: ['living'], items: ['rent_utility'], labels: ['money', 'housing'] }) // labels は項目から引き直す

// AI ラベル: 8 id 以外を捨て、本人分を除き、上限 3
assert.deepEqual(getAiLabels({ labels_ai: ['work', 'money', 'xxx', 'alone', 'health', 'family'] }, ['money']), ['work', 'health', 'family'])
assert.deepEqual(getAiLabels(null), [])
assert.deepEqual(getAiLabels({ labels_ai: 'work' }), [])
const set = getCaseLabelSet({ concerns: { groups: ['living'], items: ['food'] } }, { labels_ai: ['money', 'work'] })
assert.deepEqual(set, { own: ['money'], ai: ['work'] })

// AI へ渡す日本語文
const text = describeConcernsJa({ concerns: { groups: ['safety'], items: ['dv'] }, help_wanted: ['listen'], danger: true })
assert.ok(text.includes('暴力・家族・子ども') && text.includes('- 家族やパートナーから暴力を受けている') && text.includes('話を聞いてほしい') && text.includes('身の危険'))
assert.equal(describeConcernsJa({ qa: {} }), '')
console.log('concerns.ts: all assertions passed')
import { getItemSectionsForGroup } from '../../src/lib/constants/concerns'
const living = getItemSectionsForGroup('living')
assert.deepEqual(living.map(s => [s.subgroup, s.items.length]), [['money', 3], ['housing', 3], ['work', 3]])
assert.deepEqual(getItemSectionsForGroup('health').map(s => [s.subgroup, s.items.length]), [[null, 4]])
console.log('sections ok')
