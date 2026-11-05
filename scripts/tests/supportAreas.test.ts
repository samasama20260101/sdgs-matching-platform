// 支える側の大項目(相談した人の種類ごとの名前)。実行: npm run test:units
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SUPPORT_AREA_LABELS_JA } from '../../src/lib/constants/supportAreas.generated'
import { optionsFor } from '../../src/lib/domain/intake'
import {
  AREA_GOALS,
  AREA_SUBJECTS,
  areaKey,
  areaSubjectsForFace,
  caseAreaGoals,
  parseAreaKey,
  sanitizeSkillAreas,
} from '../../src/lib/domain/supportAreas'

// 名前のあるゴール = その種類の相談に選択肢のあるゴール(表の列D〜F と、選択肢の列P・R・S がそろっている)
for (const subject of AREA_SUBJECTS) {
  const optionGoals = [...new Set(optionsFor(subject).map((o) => o.category))].sort((a, b) => a - b)
  assert.deepEqual(AREA_GOALS[subject], optionGoals, `${subject} の大項目と選択肢のゴールがずれている`)
}

// 画面の文言: ja は表と同じ、en・es は同じ組み合わせがそろっている
const ja = JSON.parse(readFileSync('messages/ja/sdgs.json', 'utf8')).area
assert.deepEqual(ja, SUPPORT_AREA_LABELS_JA, 'messages/ja の area が表と違う')
for (const locale of ['en', 'es']) {
  const area = JSON.parse(readFileSync(`messages/${locale}/sdgs.json`, 'utf8')).area
  for (const subject of AREA_SUBJECTS) {
    assert.deepEqual(Object.keys(area[subject]).sort(), Object.keys(ja[subject]).sort(), `messages/${locale} の area.${subject} の組み合わせが違う`)
  }
}

// 例: ゴール 1 は、個人なら「お金・生活」、会社なら「貧困・生活支援」、地域なら「気候・災害」
assert.equal(SUPPORT_AREA_LABELS_JA.PERSON['1'], 'お金・生活')
assert.equal(SUPPORT_AREA_LABELS_JA.COMPANY['1'], '貧困・生活支援')
assert.equal(SUPPORT_AREA_LABELS_JA.COMMUNITY['1'], '気候・災害')

// 保存の形
assert.equal(areaKey('COMPANY', 1), 'COMPANY:1')
assert.deepEqual(parseAreaKey('COMMUNITY:15'), { subject: 'COMMUNITY', goal: 15 })
assert.equal(parseAreaKey('PERSON:15'), null, '個人の相談にゴール 15 の指標はない')
assert.equal(parseAreaKey('COMPANY:4'), null, '会社の相談にゴール 4 の指標はない')
assert.equal(parseAreaKey('NATION:1'), null)
assert.equal(parseAreaKey('COMPANY:1 '), null)

// 個人の支え手は会社と地域だけ。知らない組み合わせ・個人の相談の分・重なりを捨て、表の順にそろえる
assert.deepEqual(areaSubjectsForFace('INDIVIDUAL'), ['COMPANY', 'COMMUNITY'])
assert.deepEqual(areaSubjectsForFace('ORGANIZATION'), ['PERSON', 'COMPANY', 'COMMUNITY'])
assert.deepEqual(
  sanitizeSkillAreas(['COMMUNITY:2', 'PERSON:1', 'COMPANY:3', 'COMPANY:4', 'COMPANY:3', 'x', 'COMPANY:1'], areaSubjectsForFace('INDIVIDUAL')),
  ['COMPANY:1', 'COMPANY:3', 'COMMUNITY:2'],
)

// 相談の指標から大項目を出す(名前のないゴールは出さない・表の順)
assert.deepEqual(caseAreaGoals('COMMUNITY', ['11.6.1', '1.5.2', '11.7.1']), [1, 11])
assert.deepEqual(caseAreaGoals('PERSON', ['15.1.1', '3.1.1']), [3])
assert.deepEqual(caseAreaGoals('COMPANY', []), [])

// migration の写し方の表が、名前のあるゴールと同じ(表が変わったら v2_07 の写し方も見直す)
const sql = readFileSync('migrations/v2_07_supporter_skill_areas.sql', 'utf8')
const lists = [...sql.matchAll(/WHERE c = ANY \(ARRAY\[([0-9, ]+)\]\)/g)].map((m) => m[1].split(',').map((x) => Number(x.trim())))
assert.deepEqual(lists, [AREA_GOALS.COMPANY, AREA_GOALS.COMMUNITY], 'v2_07 の写し方の表と大項目がずれている')

console.log('supportAreas: ok')
