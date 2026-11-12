// 社会貢献の記録の見せ方(11/12 定例で決定。引き続き考えることの 3)。
// 画面では指標ごとに次の4つを並べる(代表の案では z・n・m・0 と書いていたもの。画面では記号を使わない)。
//   起こりうる最大       その課題が世界で最大限に広がったときの数(個人の課題なら世界の人口)          … z
//   いま困っている人     今の世界でその課題を抱えている人(国連などの公表値。worldCounts.generated.ts) … n
//   明日もsamasama で解決 明日もsamasama を通して解決した相談の数(人口は掛けない)                     … m
//   目標                 ゼロ(その課題が世界からなくなった状態)                                       … 0
// 個人の記録は、関わった解決した相談の数をいちばん大きく出し、指標ごとの数と「ありがとう」の数を別に見せる。
// 11/5 の「指標の数 × 人口」のスコアは見せない(DB の contributions.points は残るが、画面では使わない)。
// 指標は運営が確定したものだけを数える。相談したこと・申し出の数・返信の速さは数えない。
// 複数の団体・人で解決した相談は、世界全体の数では1回だけ数え、関わった人にはそれぞれ1件の参加として残る。

export type ContributionKind = 'RESOLVED' | 'THANKS' | 'CORRECTION'

export type ContributionRow = {
  kind: ContributionKind
  indicator_codes: string[]
  case_id: string | null
  created_at: string
}

export type RecordSummary = {
  resolvedCases: number                 // 関わった、解決した相談の数
  thanks: number                        // ありがとうの数(m には足さない)
  byIndicator: Record<string, number>   // 指標ごとの、関わった相談の数
  growth: { month: number; year: number } // この30日・この365日に解決した相談の数
}

const DAY_MS = 24 * 60 * 60 * 1000

// rows は新しい順に渡す(API は created_at の降順で読む)。指標の内訳は、相談ごとに最新の行(解決・訂正)の指標で数える
// (解決のときに未確定だった指標を、あとで運営が確定・入れ替えると訂正の行に入るため)
export function summarizeContributions(rows: ContributionRow[], now: Date): RecordSummary {
  const summary: RecordSummary = { resolvedCases: 0, thanks: 0, byIndicator: {}, growth: { month: 0, year: 0 } }
  const resolvedAt = new Map<string, number>()
  const latestCodes = new Map<string, string[]>()
  for (const row of rows) {
    if (row.kind === 'THANKS') {
      summary.thanks += 1
      continue
    }
    if (!row.case_id) continue
    if (row.kind === 'RESOLVED') resolvedAt.set(row.case_id, Date.parse(row.created_at))
    if (!latestCodes.has(row.case_id)) latestCodes.set(row.case_id, row.indicator_codes)
  }
  for (const [caseId, codes] of latestCodes) {
    if (!resolvedAt.has(caseId)) continue
    for (const code of new Set(codes)) summary.byIndicator[code] = (summary.byIndicator[code] ?? 0) + 1
  }
  summary.resolvedCases = resolvedAt.size
  summary.growth = growthSince([...resolvedAt.values()], now)
  return summary
}

// 解決した時刻の並びから、この30日・この365日に増えた数を数える(時刻が読めないものは数えない)
export function growthSince(resolvedTimes: number[], now: Date): { month: number; year: number } {
  const t = now.getTime()
  let month = 0
  let year = 0
  for (const at of resolvedTimes) {
    if (!Number.isFinite(at) || at > t) continue
    if (t - at <= 30 * DAY_MS) month += 1
    if (t - at <= 365 * DAY_MS) year += 1
  }
  return { month, year }
}

// 明日もsamasama 全体で、その指標が確定した解決済みの相談の数(相談ごとに1回だけ)
export function resolvedForIndicator(rows: { case_id: string; resolved_at: string | null }[], now: Date): { count: number; growth: { month: number; year: number } } {
  const times = new Map<string, number>()
  for (const row of rows) {
    if (times.has(row.case_id)) continue
    times.set(row.case_id, row.resolved_at ? Date.parse(row.resolved_at) : Number.NaN)
  }
  return { count: times.size, growth: growthSince([...times.values()], now) }
}
