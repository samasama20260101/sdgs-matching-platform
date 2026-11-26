// 「電話する」のリンク。実行: npm run test:units
import assert from 'node:assert/strict'
import { telHref } from '../../src/lib/domain/tel'

// 短縮番号の # は %23 にする(tel:#8008 だと番号がフラグメントに入って消える)
assert.equal(telHref('#8008'), 'tel:%238008')
assert.equal(telHref('#8778'), 'tel:%238778')
assert.equal(new URL(telHref('#8008')!).hash, '')
// ふつうの番号・緊急通報・国番号つき
assert.equal(telHref('0570003110'), 'tel:0570003110')
assert.equal(telHref('110'), 'tel:110')
assert.equal(telHref('+81-3-1234-5678'), 'tel:+81312345678')
// 空白・ハイフン・括弧・全角は落とすかそろえる
assert.equal(telHref('0120 (279) 889'), 'tel:0120279889')
assert.equal(telHref('０１２０－２７９－８８９'), 'tel:0120279889')
// 番号でないものはリンクにしない
assert.equal(telHref(null), null)
assert.equal(telHref(''), null)
assert.equal(telHref('24時間受付'), null)
assert.equal(telHref('javascript:alert(1)'), null)
console.log('tel: ok')
