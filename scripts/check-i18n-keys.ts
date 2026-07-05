// scripts/check-i18n-keys.ts
// ja を正本として、全ロケールのメッセージキー集合が一致するかを検証する。
// 使い方: npx tsx scripts/check-i18n-keys.ts
// 不一致があれば一覧を表示して exit code 1 で終了する（CI・pre-push 用）。

import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const MESSAGES_DIR = join(process.cwd(), 'messages')
const SOURCE_LOCALE = 'ja'

type Json = Record<string, unknown>

function flattenKeys(obj: Json, prefix = ''): string[] {
    const keys: string[] = []
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            keys.push(...flattenKeys(value as Json, path))
        } else {
            keys.push(path)
        }
    }
    return keys
}

function loadNamespace(locale: string, namespace: string): Json {
    const raw = readFileSync(join(MESSAGES_DIR, locale, namespace), 'utf8')
    return JSON.parse(raw) as Json
}

const locales = readdirSync(MESSAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

if (!locales.includes(SOURCE_LOCALE)) {
    console.error(`正本ロケール ${SOURCE_LOCALE} が見つかりません`)
    process.exit(1)
}

const namespaces = readdirSync(join(MESSAGES_DIR, SOURCE_LOCALE)).filter((f) => f.endsWith('.json'))

let hasError = false

for (const namespace of namespaces) {
    const sourceKeys = new Set(flattenKeys(loadNamespace(SOURCE_LOCALE, namespace)))

    for (const locale of locales) {
        if (locale === SOURCE_LOCALE) continue

        let targetKeys: Set<string>
        try {
            targetKeys = new Set(flattenKeys(loadNamespace(locale, namespace)))
        } catch {
            console.error(`✗ ${locale}/${namespace}: ファイルがないか JSON が壊れています`)
            hasError = true
            continue
        }

        const missing = [...sourceKeys].filter((k) => !targetKeys.has(k))
        const extra = [...targetKeys].filter((k) => !sourceKeys.has(k))

        if (missing.length > 0) {
            hasError = true
            console.error(`✗ ${locale}/${namespace}: ${SOURCE_LOCALE} にあるキーが欠落 (${missing.length}件)`)
            for (const k of missing.slice(0, 10)) console.error(`    - ${k}`)
            if (missing.length > 10) console.error(`    ... 他${missing.length - 10}件`)
        }
        if (extra.length > 0) {
            hasError = true
            console.error(`✗ ${locale}/${namespace}: ${SOURCE_LOCALE} にないキーが存在 (${extra.length}件)`)
            for (const k of extra.slice(0, 10)) console.error(`    + ${k}`)
            if (extra.length > 10) console.error(`    ... 他${extra.length - 10}件`)
        }
    }
}

if (hasError) {
    console.error('\ni18nキーの不一致があります。messages/ja/ を正本として揃えてください。')
    process.exit(1)
}

console.log(`✓ i18nキー整合OK（${locales.length}ロケール × ${namespaces.length} namespace）`)
