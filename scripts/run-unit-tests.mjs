// scripts/tests/*.test.ts を1本ずつ tsx で動かす。1本でも落ちたら止める。
// テストを足したら package.json を直さなくてよいように、ファイルの一覧から拾う。
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const dir = join(import.meta.dirname, 'tests')
const files = readdirSync(dir).filter((f) => f.endsWith('.test.ts')).sort()
for (const file of files) {
  const result = spawnSync('npx', ['tsx', join(dir, file)], { stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`失敗: ${file}`)
    process.exit(result.status ?? 1)
  }
}
console.log(`単体テスト ${files.length} 本すべて通過`)
