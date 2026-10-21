// 個人情報マスク(層1)の回帰テスト。実行: npm run test:units
// 検出すべきもの(電話・メール・住所…)と、残すべきもの(予定日・金額・普通の文)を両方見る
import assert from 'node:assert/strict'
import { detectPiiSpans, maskPii, maskPiiDetailed } from '../../src/lib/pii'
const cases: Array<[string, string]> = [
  ['電話は090-1234-5678です', '電話は【電話番号】です'],
  ['連絡先 ０９０１２３４５６７８ まで', '連絡先 【電話番号】 まで'],
  ['メール test.user+1@example.co.jp へ', 'メール 【メールアドレス】 へ'],
  ['LINEのID: tanaka_123 です', '【SNSのID】 です'],
  ['〒862-0950 熊本市中央区水前寺1丁目2-3 ハイツ水前寺203号室に住んでいます', '【郵便番号】 【住所】 【住所】に住んでいます'],
  ['1985年4月1日生まれです', '【生年月日】です'],
  ['2026年10月1日に退去と言われた', '【日付】に退去と言われた'],
  ['借金が1000000円あります', '借金が1000000円あります'],
  ['口座番号 1234567890 に', '口座番号 【番号】 に'],
  ['https://example.com/abc を見て', '【URL】 を見て'],
  ['家賃を2か月滞納していて、来月には出ていくように言われている', '家賃を2か月滞納していて、来月には出ていくように言われている'],
  ['来週の3月2日に面談があります。生活費は月10万円です', '来週の3月2日に面談があります。生活費は月10万円です'],
  ['', ''],
]
for (const [input, expected] of cases) {
  assert.equal(maskPii(input), expected, input)
}
const d = maskPiiDetailed('090-1234-5678 と a@b.com と 090-0000-1111')
assert.deepEqual(d.counts, { phone: 2, email: 1 })
// 位置は原文上のもの(全角でもずれない)。体験ページの色付けが依存する
const src = '電話は０９０－１２３４－５６７８、メールは a@b.com'
assert.deepEqual(
  detectPiiSpans(src).map((s) => [s.cat, src.slice(s.start, s.end)]),
  [['phone', '０９０－１２３４－５６７８'], ['email', 'a@b.com']],
)
assert.deepEqual(detectPiiSpans(''), [])
console.log('pii: all assertions passed')
