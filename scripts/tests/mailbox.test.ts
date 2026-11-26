// 知らせのメールの差出人の分解(#166)。実行: npm run test:units
import assert from 'node:assert/strict'
import { parseMailbox, senderForBinding } from '../../src/lib/domain/mailbox'

assert.deepEqual(parseMailbox('明日もsamasama <no-reply@samasama.site>'), { name: '明日もsamasama', email: 'no-reply@samasama.site' })
assert.deepEqual(parseMailbox('"明日も samasama" <no-reply@samasama.site>'), { name: '明日も samasama', email: 'no-reply@samasama.site' })
assert.deepEqual(parseMailbox(' no-reply@samasama.site '), { name: '', email: 'no-reply@samasama.site' })
assert.equal(parseMailbox('明日もsamasama'), null)
assert.equal(parseMailbox('明日もsamasama <>'), null)
assert.equal(parseMailbox(''), null)

assert.deepEqual(senderForBinding('明日もsamasama <no-reply@samasama.site>'), { name: '明日もsamasama', email: 'no-reply@samasama.site' })
assert.equal(senderForBinding('no-reply@samasama.site'), 'no-reply@samasama.site')
assert.equal(senderForBinding(undefined), null)
assert.equal(senderForBinding('壊れた設定'), null)

console.log('mailbox: ok')
