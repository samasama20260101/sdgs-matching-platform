// お問い合わせの内容の種類。実行: npm run test:units
// 値(日本語が正本)と messages/ja の表示がそろい、en・es に訳があることを見る(#175)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CONTACT_CATEGORIES, knownContactCategory } from '../../src/lib/domain/contactCategories'

type Messages = { contact: { categories: Record<string, string> } }
const read = (locale: string) => JSON.parse(readFileSync(new URL(`../../messages/${locale}/app.json`, import.meta.url), 'utf8')) as Messages
const [ja, en, es] = ['ja', 'en', 'es'].map(read)

for (const c of [...CONTACT_CATEGORIES.guest, ...CONTACT_CATEGORIES.person]) {
  assert.equal(ja.contact.categories[c.id], c.ja, `ja の表示が値と違う: ${c.id}`)
  assert.ok(en.contact.categories[c.id], `en の訳がない: ${c.id}`)
  assert.ok(es.contact.categories[c.id], `es の訳がない: ${c.id}`)
}

// 使ってみての意見は、ログインしていてもいなくても選べる
assert.ok(CONTACT_CATEGORIES.guest.some((c) => c.id === 'feedback'))
assert.ok(CONTACT_CATEGORIES.person.some((c) => c.id === 'feedback'))
// 同じ一覧の中で id が重ならない
for (const list of [CONTACT_CATEGORIES.guest, CONTACT_CATEGORIES.person]) assert.equal(new Set(list.map((c) => c.id)).size, list.length)

// 一覧にある種類だけを名前として返す
assert.equal(knownContactCategory('アプリへの意見・要望'), 'アプリへの意見・要望')
assert.equal(knownContactCategory('使い方がわからない'), '使い方がわからない')
assert.equal(knownContactCategory('自由に書いた種類'), null)
assert.equal(knownContactCategory(''), null)

console.log('contactCategories: ok')
