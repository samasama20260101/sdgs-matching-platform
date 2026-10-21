// お知らせ本文の段落分けと「[要確認]」の検出の回帰テスト。実行: npm run test:units
import assert from 'node:assert/strict'
import { parseNewsBody, hasUnresolvedPlaceholder } from '../../src/lib/news/bodyBlocks'

// 見出しの次の行に本文が続く(AI の下書きの形)→ 見出しは 1 行目だけ
assert.deepEqual(parseNewsBody('## 活動拠点\n千葉市を拠点に活動されています。'), [
  { kind: 'heading', text: '活動拠点' },
  { kind: 'paragraph', lines: ['千葉市を拠点に活動されています。'] },
])
// 見出しだけの段落・普通の段落・改行入りの段落
assert.deepEqual(parseNewsBody('はじめに\n2行目\n\n## まとめ\n\n最後の段落'), [
  { kind: 'paragraph', lines: ['はじめに', '2行目'] },
  { kind: 'heading', text: 'まとめ' },
  { kind: 'paragraph', lines: ['最後の段落'] },
])
// 「##」だけで中身がない行は見出しにしない
assert.deepEqual(parseNewsBody('## \n本文'), [{ kind: 'paragraph', lines: ['本文'] }])
assert.deepEqual(parseNewsBody(''), [])

assert.equal(hasUnresolvedPlaceholder('ABC団体は[要確認: 団体の種別]です'), true)
assert.equal(hasUnresolvedPlaceholder('タイトル', '［要確認：日時］'), true)
assert.equal(hasUnresolvedPlaceholder('確認済みの文章です', '要確認という言葉だけ'), false)

console.log('newsBody: ok')
