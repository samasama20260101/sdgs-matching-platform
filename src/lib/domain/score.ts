// 社会貢献のスコア(11/5 定例で当面の式に決めた)。
//   スコア = Σ(解決した相談に付いた指標の数 × 対象の人数)
//   個人の相談は人数 1、会社・地域の相談は団体が登録した対象の人数。
//   「ありがとう」の数はスコアに足さず、別に数えて見せる(SNS のいいねのような軽いもの)。
// 指標は運営が確定したものだけを数える。相談したこと・申し出の数・返信の速さは数えない。
// 複数の団体で解決したときの分け方は未決(今は関わった人それぞれに同じ点を付ける。個人には1件の参加として数える案あり)。

export type ContributionKind = 'RESOLVED' | 'THANKS' | 'CORRECTION'

export type ContributionRow = {
  kind: ContributionKind
  indicator_codes: string[]
  population: number
  points: number
  case_id: string | null
}

export function resolvedPoints(indicatorCount: number, population: number): number {
  if (!Number.isFinite(indicatorCount) || !Number.isFinite(population)) return 0
  const count = Math.max(0, Math.floor(indicatorCount))
  const people = Math.max(1, Math.floor(population))
  return count * people
}

export type ScoreSummary = {
  score: number
  resolvedCases: number
  thanks: number
  byIndicator: Record<string, number>
}

export function summarizeContributions(rows: ContributionRow[]): ScoreSummary {
  const summary: ScoreSummary = { score: 0, resolvedCases: 0, thanks: 0, byIndicator: {} }
  const resolved = new Set<string>()
  for (const row of rows) {
    if (row.kind === 'THANKS') {
      summary.thanks += 1
      continue
    }
    // 訂正の行は点の増減だけを持つ(負の値もある)
    summary.score += row.points
    if (row.kind === 'RESOLVED') {
      if (row.case_id) resolved.add(row.case_id)
      for (const code of row.indicator_codes) summary.byIndicator[code] = (summary.byIndicator[code] ?? 0) + 1
    }
  }
  summary.resolvedCases = resolved.size
  return summary
}

// 団体の値: 今いるメンバーの記録の合計(盤 31。人が抜けると下がる)
export function organizationScore(memberSummaries: ScoreSummary[]): number {
  return memberSummaries.reduce((sum, s) => sum + s.score, 0)
}
