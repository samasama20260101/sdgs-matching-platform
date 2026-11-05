// 久保さんの指標一覧(sama2/101_グローバル指標の研究所/【01_基礎資料-1】グローバル指標一覧.xlsx)の
// シート「AI教師データ用」から、会社・地域・国として相談するときの選択肢(列R〜T)と、
// 支える側に出す大項目の名前(列D〜F。相談した人の種類ごと)を取り出して TS に書く(v2.0 #72)。
//
//   npx tsx scripts/ledger/import-org-intake.ts <xlsx の写しのパス>
//
// - 読むのは画面に出す列だけ(許可した列の一覧 READ_COLUMNS)。AI の教師データ(曖昧表現・判定の事例)、
//   思考整理の列、人数の推計の列は読まない。公開リポジトリに入るのは画面に出す文言だけ(NDA と指標台帳の約束)
// - 個人の選択肢(列P)は書き換えない。正本は docs/intake_indicators.md と src/lib/constants/intakeIndicators.ts。
//   列P とのずれは一覧で出すだけにし、直すかは運営が決める
// - OneDrive の原本は開かずに、写しを渡す(sama2 は双方向同期で、書き込むと久保さんの側も変わる)
import ExcelJS from 'exceljs'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { INTAKE_INDICATORS } from '../../src/lib/constants/intakeIndicators'

const SHEET = 'AI教師データ用'
const FIRST_DATA_ROW = 5
// 列の番号(1 始まり)。見出し(4 行目)の文言で確かめてから読む
const READ_COLUMNS = {
  goal: { col: 1, header: 'SDGsゴール番号' },
  code: { col: 9, header: 'グローバル指標番号' },
  subjects: { col: 15, header: '【SOSユーザー】' },
  person: { col: 16, header: '相談フォームの選択肢\n（A:個人版' },
  urgent: { col: 17, header: '緊急フラグ' },
  company: { col: 18, header: '相談フォームの選択肢\n（B:団体代表者版' },
  community: { col: 19, header: '相談フォームの選択肢\n（C:地域代表者版' },
  nation: { col: 20, header: '相談フォームの選択肢\n（D:国版' },
  areaPerson: { col: 4, header: '大項目' },
  areaCompany: { col: 5, header: '大項目' },
  areaCommunity: { col: 6, header: '大項目' },
} as const

// 列D〜F の見出しは「大項目 (A:個人向け版の…)」の形。どの版かを見出しの中の文字で確かめる
const AREA_HEADER_MARK = { areaPerson: 'A:個人', areaCompany: 'B:団体代表者', areaCommunity: 'C:地域代表者' } as const

type Subject = 'COMPANY' | 'COMMUNITY' | 'NATION'
type OrgIndicator = { id: string; category: number; text: string }

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'richText' in value) return value.richText.map((r) => r.text).join('')
  if (typeof value === 'object' && 'result' in value) return String(value.result ?? '')
  return String(value)
}

function usable(text: string): string | null {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t || t === '-' || t === '—' || t === 'ー') return null
  return t
}

async function main() {
  const path = process.argv[2]
  if (!path) throw new Error('usage: import-org-intake.ts <xlsx>')
  const book = new ExcelJS.Workbook()
  await book.xlsx.readFile(path)
  const sheet = book.getWorksheet(SHEET)
  if (!sheet) throw new Error(`シート「${SHEET}」がありません`)

  const headerRow = sheet.getRow(FIRST_DATA_ROW - 1)
  for (const [name, { col, header }] of Object.entries(READ_COLUMNS)) {
    const actual = cellText(headerRow.getCell(col).value)
    if (!actual.startsWith(header)) throw new Error(`列 ${name}(${col})の見出しが違います: ${JSON.stringify(actual.slice(0, 30))}`)
    const mark = AREA_HEADER_MARK[name as keyof typeof AREA_HEADER_MARK]
    if (mark && !actual.replace(/\s+/g, '').includes(mark)) throw new Error(`列 ${name}(${col})が ${mark} の版ではありません`)
  }

  const sets: Record<Subject, OrgIndicator[]> = { COMPANY: [], COMMUNITY: [], NATION: [] }
  // 支える側の大項目の名前: 種類 → ゴール → 名前(出てきた順、重ならないように)
  type AreaSubject = 'PERSON' | 'COMPANY' | 'COMMUNITY'
  const areas: Record<AreaSubject, Map<number, string[]>> = { PERSON: new Map(), COMPANY: new Map(), COMMUNITY: new Map() }
  const personInSheet = new Map<string, string>()
  const urgentInSheet = new Set<string>()
  for (let r = FIRST_DATA_ROW; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const code = usable(cellText(row.getCell(READ_COLUMNS.code.col).value))
    const goal = Number(cellText(row.getCell(READ_COLUMNS.goal.col).value))
    if (!code || !/^\d{1,2}\.[0-9a-z]{1,2}\.\d{1,2}$/.test(code) || !Number.isInteger(goal) || goal < 1 || goal > 17) continue
    const areaPairs: [AreaSubject, keyof typeof READ_COLUMNS][] = [['PERSON', 'areaPerson'], ['COMPANY', 'areaCompany'], ['COMMUNITY', 'areaCommunity']]
    for (const [subject, key] of areaPairs) {
      const label = usable(cellText(row.getCell(READ_COLUMNS[key].col).value))
      if (!label || label === 'N/A') continue
      const list = areas[subject].get(goal) ?? []
      if (!list.includes(label)) list.push(label)
      areas[subject].set(goal, list)
    }
    const person = usable(cellText(row.getCell(READ_COLUMNS.person.col).value))
    if (person) personInSheet.set(code, person)
    if (usable(cellText(row.getCell(READ_COLUMNS.urgent.col).value))) urgentInSheet.add(code)
    const pairs: [Subject, keyof typeof READ_COLUMNS][] = [['COMPANY', 'company'], ['COMMUNITY', 'community'], ['NATION', 'nation']]
    for (const [subject, key] of pairs) {
      const text = usable(cellText(row.getCell(READ_COLUMNS[key].col).value))
      if (text) sets[subject].push({ id: code, category: goal, text })
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const body = `// 自動生成(scripts/ledger/import-org-intake.ts)。手で直さない。
// 元: 指標一覧のシート「${SHEET}」の相談フォームの選択肢(B:団体代表者版・C:地域代表者版・D:国版)。${today} に取り込んだ。
// 会社・地域・国として相談するときの選択肢。個人の選択肢は intakeIndicators.ts(正本 docs/intake_indicators.md)。
export type OrgIntakeIndicator = { id: string; category: number; text: string }

export const COMPANY_INTAKE_INDICATORS: OrgIntakeIndicator[] = ${JSON.stringify(sets.COMPANY, null, 2)}

export const COMMUNITY_INTAKE_INDICATORS: OrgIntakeIndicator[] = ${JSON.stringify(sets.COMMUNITY, null, 2)}

export const NATION_INTAKE_INDICATORS: OrgIntakeIndicator[] = ${JSON.stringify(sets.NATION, null, 2)}
`
  // リポジトリの根から動かす前提(npx tsx scripts/ledger/...)
  const out = join(process.cwd(), 'src/lib/constants/orgIntakeIndicators.generated.ts')
  writeFileSync(out, body)
  console.log(`書いた: ${out}`)
  console.log(`会社 ${sets.COMPANY.length} / 地域 ${sets.COMMUNITY.length} / 国 ${sets.NATION.length}`)

  // 支える側の大項目の名前。1 つのゴールに名前が 2 つあるときは「／」でつなぐ(表がそうなっているところだけ)
  const areaLabels = Object.fromEntries(
    (Object.keys(areas) as AreaSubject[]).map((subject) => [
      subject,
      Object.fromEntries([...areas[subject].entries()].sort(([a], [b]) => a - b).map(([goal, labels]) => [goal, labels.join('／')])),
    ]),
  )
  const areaOut = join(process.cwd(), 'src/lib/constants/supportAreas.generated.ts')
  writeFileSync(areaOut, `// 自動生成(scripts/ledger/import-org-intake.ts)。手で直さない。
// 元: 指標一覧のシート「${SHEET}」の列D〜F「大項目(A:個人 / B:団体代表者 / C:地域代表者 向け版のサポーター側の表示)」。${today} に取り込んだ。
// 支える側の画面で、相談した人の種類ごとに大項目(SDGs のゴール)に付ける名前。ない組み合わせは、その種類の相談にそのゴールの指標がない。
// 画面の文言は messages/<言語>/sdgs.json の area(ja はこの表と同じ。scripts/tests/supportAreas.test.ts が確かめる)
export const SUPPORT_AREA_LABELS_JA = ${JSON.stringify(areaLabels, null, 2)} as const satisfies Record<'PERSON' | 'COMPANY' | 'COMMUNITY', Record<string, string>>
`)
  console.log(`書いた: ${areaOut}`)
  for (const subject of Object.keys(areas) as AreaSubject[]) {
    const multi = [...areas[subject].entries()].filter(([, l]) => l.length > 1)
    console.log(`大項目 ${subject}: ${areas[subject].size} ゴール${multi.length ? `(名前が 2 つ: ${multi.map(([g, l]) => `${g}=${l.join('／')}`).join(', ')})` : ''}`)
  }

  // 個人の選択肢(列P)とアプリのずれ。直さず一覧だけ出す
  const app = new Map(INTAKE_INDICATORS.map((i) => [i.id, i]))
  const changed = [...personInSheet].filter(([id, text]) => app.has(id) && app.get(id)!.text !== text)
  const onlySheet = [...personInSheet.keys()].filter((id) => !app.has(id))
  const onlyApp = [...app.keys()].filter((id) => !personInSheet.has(id))
  const urgentDiff = [...app.values()].filter((i) => Boolean(i.urgent) !== urgentInSheet.has(i.id)).map((i) => i.id)
  console.log(`\n個人の選択肢(列P)とアプリのずれ: 文言 ${changed.length} / 表だけ ${onlySheet.length} / アプリだけ ${onlyApp.length} / 緊急の印 ${urgentDiff.length}`)
  for (const [id, text] of changed) console.log(`  文言 ${id}: アプリ「${app.get(id)!.text}」→ 表「${text}」`)
  for (const id of onlySheet) console.log(`  表だけ ${id}: 「${personInSheet.get(id)}」`)
  for (const id of onlyApp) console.log(`  アプリだけ ${id}`)
  for (const id of urgentDiff) console.log(`  緊急の印が違う ${id}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
