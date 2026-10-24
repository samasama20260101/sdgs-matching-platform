// お知らせ AI 下書きのプロンプトの回帰テスト(インタビューの締めの一文)。実行: npm run test:units
import assert from 'node:assert/strict'
import { buildNewsDraftPrompt, interviewClosing } from '../../src/lib/news/draftPrompt'

// note の記事なら「note の記事」、それ以外は置き場所の名前を出さない(新聞社・団体のブログなど)
assert.equal(interviewClosing('https://note.com/samasama/n/abc'), '「続きは note の記事でお読みください」で締める')
assert.equal(interviewClosing('https://www.kumanichi.com/article/123'), '「続きはリンク先の記事でお読みください」で締める')
assert.equal(interviewClosing('https://example-npo.jp/blog/interview'), '「続きはリンク先の記事でお読みください」で締める')
// 外部リンクが無い(全文をこのサイトに載せる)ときは「続きは」を書かせない
assert.equal(interviewClosing(undefined), '締めの一文は書かない(続きの記事へのリンクはない)')

// プロンプトに差し込まれ、置き換え用の印が残らない
const prompt = buildNewsDraftPrompt('INTERVIEW', { notes: '代表の○○さんに話を聞いた' }, 'https://example-npo.jp/blog/1') ?? ''
assert.ok(prompt.includes('続きはリンク先の記事でお読みください'))
assert.ok(!prompt.includes('note の記事'))
assert.ok(!prompt.includes('{{CLOSING}}'))
// 他の種別には影響しない
assert.ok(!(buildNewsDraftPrompt('NOTICE', { notes: 'メモ' }) ?? '').includes('{{CLOSING}}'))

console.log('newsDraftPrompt: ok')
