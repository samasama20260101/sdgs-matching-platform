// 団体の中で相談を受け持つメンバー(#118)。実行: npm run test:units
import assert from 'node:assert/strict'
import { canChangeCaseMember, isMemberChangeableOffer, isValidNextMember, offerMemberUserId } from '../../src/lib/domain/caseMember'

// 替えられる申し出: 申し出中と選ばれたあと。招かれたまま・取り下げ・断られたは替えない
assert.equal(isMemberChangeableOffer('PENDING'), true)
assert.equal(isMemberChangeableOffer('ACCEPTED'), true)
assert.equal(isMemberChangeableOffer('INVITED'), false)
assert.equal(isMemberChangeableOffer('WITHDRAWN'), false)
assert.equal(isMemberChangeableOffer('DECLINED'), false)

// 替えられる人: 管理の人と、いま受け持っている本人
assert.equal(canChangeCaseMember({ userId: 'a', role: 'OWNER' }, 'b'), true)
assert.equal(canChangeCaseMember({ userId: 'a', role: 'OWNER' }, null), true)
assert.equal(canChangeCaseMember({ userId: 'b', role: 'MEMBER' }, 'b'), true)
assert.equal(canChangeCaseMember({ userId: 'c', role: 'MEMBER' }, 'b'), false)
assert.equal(canChangeCaseMember({ userId: 'c', role: 'MEMBER' }, null), false)

// 替える相手: 今いるメンバーで、いまの人と違う
assert.equal(isValidNextMember('c', ['a', 'b', 'c'], 'b'), true)
assert.equal(isValidNextMember('b', ['a', 'b', 'c'], 'b'), false) // 同じ人
assert.equal(isValidNextMember('x', ['a', 'b', 'c'], 'b'), false) // 抜けた人・ほかの団体の人
assert.equal(isValidNextMember('a', ['a'], null), true)

// 知らせとありがとうの宛先: 受け持つメンバー。空なら申し出た人
assert.equal(offerMemberUserId({ supporter_user_id: 'now', created_by_user_id: 'first' }), 'now')
assert.equal(offerMemberUserId({ supporter_user_id: null, created_by_user_id: 'first' }), 'first')
assert.equal(offerMemberUserId({ supporter_user_id: null, created_by_user_id: null }), null)

console.log('caseMember: ok')
