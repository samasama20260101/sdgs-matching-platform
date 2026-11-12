// 静的ファイルの判定と proxy の matcher(#123)。実行: npm run test:units
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { STATIC_FILE_EXTENSIONS, isStaticFilePath } from '../../src/lib/domain/staticFile'

// 静的ファイル
for (const p of ['/favicon.ico', '/brand/LogoIcon-512px.png', '/images/a.SVG', '/manifest.webmanifest', '/robots.txt', '/fonts/x.woff2']) {
  assert.equal(isStaticFilePath(p), true, p)
}
// 画面と API(指標の番号の「.」は拡張子ではない)
for (const p of ['/support/contributions/4.3.1', '/ja/support/contributions/16.2.1', '/en/support/contributions/1.1.1', '/api/support/indicators/4.3.1', '/', '/support', '/cases/abc']) {
  assert.equal(isStaticFilePath(p), false, p)
}

// proxy の matcher は Next.js が静的に読むので文字列で書いてある。拡張子の一覧が staticFile.ts とずれていないか
const proxy = readFileSync('src/proxy.ts', 'utf8') // npm run test:units はリポの直下で動く
const literal = proxy.match(/matcher:\s*\[\s*'([^']+)'/)?.[1]
assert.ok(literal, 'matcher が見つからない')
const exts = literal.match(/\\\\\.\(\?:([a-z0-9|]+)\)\$/)?.[1]?.split('|')
assert.deepEqual(exts, [...STATIC_FILE_EXTENSIONS], 'matcher の拡張子が staticFile.ts と違う')

// matcher の正規表現として、画面は通し、静的ファイルは通さない(ソースの \\. は正規表現では \.)
const re = new RegExp(`^${literal.replace(/\\\\/g, '\\')}$`)
for (const p of ['/support/contributions/4.3.1', '/ja/support/contributions/4.3.1', '/api/support/indicators/4.3.1', '/', '/home', '/en/support/find']) {
  assert.equal(re.test(p), true, `matcher が通さない: ${p}`)
}
for (const p of ['/favicon.ico', '/brand/LogoIcon-512px.png', '/_next/static/chunks/a.js', '/_next/image', '/manifest.webmanifest']) {
  assert.equal(re.test(p), false, `matcher が通してしまう: ${p}`)
}

console.log('staticFile: ok')
