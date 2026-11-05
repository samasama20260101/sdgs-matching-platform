import assert from 'node:assert/strict'
import { clientIpFrom } from '../../src/lib/rateLimitKey'

const h = (init: Record<string, string>) => new Headers(init)
// Cloudflare の値を先に使う
assert.equal(clientIpFrom(h({ 'cf-connecting-ip': '203.0.113.5', 'x-forwarded-for': '198.51.100.1' })), '203.0.113.5')
// x-forwarded-for は先頭(本人に近い方)
assert.equal(clientIpFrom(h({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' })), '198.51.100.1')
assert.equal(clientIpFrom(h({ 'x-real-ip': '2001:db8::1' })), '2001:db8::1')
// IP の形でないもの・長すぎるものは使わない(呼ぶ側で 1 つの枠にまとめる)
assert.equal(clientIpFrom(h({ 'x-forwarded-for': 'evil<script>' })), null)
assert.equal(clientIpFrom(h({ 'cf-connecting-ip': '1'.repeat(65) })), null)
assert.equal(clientIpFrom(h({})), null)
console.log('rateLimitKey: ok')
