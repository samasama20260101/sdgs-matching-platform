// 世界の数(いま困っている人・世界の人口)を取り直して src/lib/constants/worldCounts.generated.ts に書き出す。
// 実行: npx tsx scripts/fetch-world-counts.ts(国連 SDG API と世界銀行の API。鍵は要らない)
// 国連の値は年に数回更新される。取り直したら差分を見て、急に変わった値は元の資料で確かめてからコミットする。
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { WORLD_COUNT_SOURCES } from '../src/lib/constants/worldCountSources'
import { toPeople, type WorldCount, type WorldPopulation } from '../src/lib/domain/worldCount'

type UnRow = { timePeriodStart: number; value: string; dimensions?: Record<string, string>; attributes?: Record<string, string>; source?: string }

async function getJson<T>(url: string): Promise<T> {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'samasama-world-counts/1.0' } })
    if (res.ok) return (await res.json()) as T
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
  }
  throw new Error(`取得できませんでした: ${url}`)
}

// 世界全体・男女計・全年齢・都市と農村の計だけを使う
function isTotal(row: UnRow): boolean {
  const dims = row.dimensions ?? {}
  if ((dims['Reporting Type'] ?? 'G') !== 'G') return false
  return Object.entries(dims).every(([k, v]) => k === 'Reporting Type' || ['_T', 'ALLAGE', 'BOTHSEX', 'ALLAREA', '_Z'].includes(v))
}

async function main() {
  // 世界の人口(世界銀行 SP.POP.TOTL、国連の人口推計をもとにした値)。年ごとに持ち、割合の系列は同じ年の人口を掛ける
  const wb = await getJson<[unknown, { date: string; value: number | null }[]]>('https://api.worldbank.org/v2/country/WLD/indicator/SP.POP.TOTL?format=json&date=2010:2030&per_page=100')
  const popByYear = new Map(wb[1].filter((r) => r.value).map((r) => [Number(r.date), r.value as number]))
  const latestYear = Math.max(...popByYear.keys())
  const population: WorldPopulation = { value: popByYear.get(latestYear)!, year: latestYear, source: 'World Bank (SP.POP.TOTL)' }

  const counts: Record<string, WorldCount> = {}
  for (const [code, src] of Object.entries(WORLD_COUNT_SOURCES)) {
    const data = await getJson<{ data: UnRow[] }>(`https://unstats.un.org/sdgapi/v1/sdg/Series/Data?seriesCode=${src.series}&areaCode=1&pageSize=500`)
    const rows = data.data.filter((r) => isTotal(r) && r.value !== '' && r.value !== 'NaN').sort((a, b) => a.timePeriodStart - b.timePeriodStart)
    const last = rows.at(-1)
    if (!last) {
      console.warn(`${code} ${src.series}: 世界全体の値がない(載せない)`)
      continue
    }
    const year = Math.round(last.timePeriodStart)
    const pop = popByYear.get(year) ?? population.value
    const value = toPeople(src.method, Number(last.value), last.attributes?.Units, pop)
    if (value === null) {
      console.warn(`${code} ${src.series}: 単位 ${last.attributes?.Units} を読めない(載せない)`)
      continue
    }
    counts[code] = { value, year, series: src.series, source: (last.source ?? '').trim(), method: src.method }
    console.log(`${code} ${src.series} ${year} ${last.value} ${last.attributes?.Units} → ${value.toLocaleString('en')}`)
  }

  const body = `// このファイルは scripts/fetch-world-counts.ts が作る。手で直さない(対応表は worldCountSources.ts)。
// 取得: ${new Date().toISOString().slice(0, 10)}  国連 SDG データベース(unstats.un.org/sdgapi)・世界銀行
import type { WorldCount, WorldPopulation } from '@/lib/domain/worldCount'

export const WORLD_POPULATION: WorldPopulation = ${JSON.stringify(population)}

export const WORLD_COUNTS: Record<string, WorldCount> = ${JSON.stringify(counts, null, 2)}
`
  writeFileSync(join(process.cwd(), 'src/lib/constants/worldCounts.generated.ts'), body)
  console.log(`世界の人口 ${population.year} ${population.value.toLocaleString('en')}、n ${Object.keys(counts).length} 件を書き出した`)
}

void main()
