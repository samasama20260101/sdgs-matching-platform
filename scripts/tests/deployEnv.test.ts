// 動いている環境の判定(Cloudflare の APP_ENV と Vercel の VERCEL_ENV)。実行: npm run test:units
import assert from 'node:assert/strict'
import { resolveDeployEnv } from '../../src/lib/deployEnv'

// Cloudflare Workers: wrangler.jsonc の vars
assert.equal(resolveDeployEnv({ APP_ENV: 'production' }), 'production')
assert.equal(resolveDeployEnv({ APP_ENV: 'staging' }), 'staging')
// Vercel: 載せ替えのあいだは今までどおり
assert.equal(resolveDeployEnv({ VERCEL_ENV: 'production' }), 'production')
assert.equal(resolveDeployEnv({ VERCEL_ENV: 'preview' }), 'staging')
// APP_ENV が優先(両方あるときは Workers の値)
assert.equal(resolveDeployEnv({ APP_ENV: 'staging', VERCEL_ENV: 'production' }), 'staging')
// 知らない値・未設定は手元の開発扱い(本番だけの上限を掛けない)
assert.equal(resolveDeployEnv({ APP_ENV: 'prod' }), 'development')
assert.equal(resolveDeployEnv({}), 'development')
assert.equal(resolveDeployEnv({ NODE_ENV: 'production' }), 'development')

console.log('deployEnv: ok')
