// 団体の用途と審査の決まり(#131)。実行: npm run test:units
import assert from 'node:assert/strict'
import {
  canApplyAsSupporter,
  canConsultAsOrganization,
  initialVettingStatus,
  isSupporterFace,
  isVettingStatus,
  newApplication,
  supporterApplication,
  vettingTargets,
} from '../../src/lib/domain/orgVetting'
import { isListedSupporter } from '../../src/lib/domain/publicSupporter'

// 相談のための団体は審査に並べない。支え手の団体は申し込みから
assert.equal(initialVettingStatus('CONSULT'), 'NOT_APPLIED')
assert.equal(initialVettingStatus('SUPPORT'), 'APPLIED')
assert.equal(isVettingStatus('NOT_APPLIED'), true)
assert.equal(isVettingStatus('PENDING'), false)

// 運営が変えられる先: 相談のための団体は止める・解くだけ。支え手の団体(v1 から移った団体も)は申し込み前に戻さない
assert.deepEqual([...vettingTargets({ purpose: 'CONSULT' })], ['NOT_APPLIED', 'SUSPENDED'])
assert.equal(vettingTargets({ purpose: 'CONSULT' }).includes('APPROVED'), false)
assert.equal(vettingTargets({ purpose: 'SUPPORT' }).includes('NOT_APPLIED'), false)
assert.equal(vettingTargets({ purpose: 'SUPPORT' }).includes('APPROVED'), true)
assert.equal(vettingTargets(null).includes('NOT_APPLIED'), false)

// 団体として相談できないのは停止だけ(見送りは支え手の申し込みを断っただけ)
assert.equal(canConsultAsOrganization('NOT_APPLIED'), true)
assert.equal(canConsultAsOrganization('APPLIED'), true)
assert.equal(canConsultAsOrganization('REJECTED'), true)
assert.equal(canConsultAsOrganization('SUSPENDED'), false)

// 支え手の申し込みができるのは、相談のための団体の、申し込み前で止めていない団体の管理の人だけ
const consult = { application: { purpose: 'CONSULT' }, vettingStatus: 'NOT_APPLIED', status: 'ACTIVE', role: 'OWNER' }
assert.equal(canApplyAsSupporter(consult), true)
assert.equal(canApplyAsSupporter({ ...consult, role: 'MEMBER' }), false)
assert.equal(canApplyAsSupporter({ ...consult, vettingStatus: 'SUSPENDED' }), false)
assert.equal(canApplyAsSupporter({ ...consult, status: 'ARCHIVED' }), false)
assert.equal(canApplyAsSupporter({ ...consult, application: { purpose: 'SUPPORT' }, vettingStatus: 'APPLIED' }), false)
assert.equal(canApplyAsSupporter({ ...consult, application: null }), false) // v1 から移った団体はもう支え手

// 登録の中身: 送られてきた purpose で上書きさせない
assert.deepEqual(newApplication('CONSULT', { purpose: 'SUPPORT', staff: '3人' }), { purpose: 'CONSULT', staff: '3人' })
assert.deepEqual(newApplication('SUPPORT', undefined), { purpose: 'SUPPORT' })

// 支え手の申し込み: 前の中身に答えを足し、用途を SUPPORT にする(答えに purpose があっても SUPPORT)
assert.deepEqual(supporterApplication({ purpose: 'CONSULT' }, { staff: '3人', purpose: 'CONSULT' }), { purpose: 'SUPPORT', staff: '3人' })
assert.deepEqual(supporterApplication(null, { staff: '3人' }), { staff: '3人', purpose: 'SUPPORT' })

// 一覧に載り招ける団体: 承認済み・止めていない・支え手の団体だけ
const org = { application: { purpose: 'SUPPORT' }, vetting_status: 'APPROVED', status: 'ACTIVE' }
assert.equal(isListedSupporter(org), true)
assert.equal(isListedSupporter({ ...org, application: null }), true) // v1 から移った団体
assert.equal(isListedSupporter({ ...org, application: { purpose: 'CONSULT' } }), false)
assert.equal(isListedSupporter({ ...org, vetting_status: 'APPLIED' }), false)
assert.equal(isListedSupporter({ ...org, status: 'ARCHIVED' }), false)

// 支える側の顔: 支え手の団体の、見送り・停止でないものだけ。相談のための団体は出さない
assert.equal(isSupporterFace({ supporter: true, vettingStatus: 'APPLIED' }), true)
assert.equal(isSupporterFace({ supporter: true, vettingStatus: 'APPROVED' }), true)
assert.equal(isSupporterFace({ supporter: true, vettingStatus: 'REJECTED' }), false)
assert.equal(isSupporterFace({ supporter: true, vettingStatus: 'SUSPENDED' }), false)
assert.equal(isSupporterFace({ supporter: false, vettingStatus: 'NOT_APPLIED' }), false)

console.log('orgVetting: ok')
