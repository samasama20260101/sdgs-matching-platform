// 機微な相談の決め方(盤 03・63 の 3、#133)。純粋関数。
//   下限(AI が何と言っても下げない):
//     - 書いた言葉に命・暴力にかかわる言葉がある(src/lib/urgency.ts の detectUrgency)
//     - 相談者が18歳未満
//   AI の分類は上げる方向にだけ効かせる:
//     - AI が選んだ指標に「機微」の印がある(命・暴力・性・虐待・依存・偏見を受けやすい病気)
//     - AI が「機微」と判定した
//   AI が使えない・時間切れ・壊れた応答のときは機微として扱う(AI_UNAVAILABLE。面談済みの支援団体の、2つ目の確認を通った人にだけ見える)。
//   運営はどちらにも直せる(ADMIN / ADMIN_CLEARED)。運営が決めたあとは、AI だけでは変えない。
// 機微な相談は、個人の支え手には出さない。支援団体のメンバーは2つ目の確認(認証アプリ)を通った人だけが中身を見られる(src/lib/domain/visibility.ts)。
// 印の一覧は運営(久保さん)に確かめてもらう前の案。緊急の印(14)は全部入れ、残りは相談の中身が人に知られると
// 本人が危うくなるものを足した。

// 緊急の印(src/lib/constants/intakeIndicators.ts の urgent)に加えて機微にするもの
export const EXTRA_SENSITIVE_INDICATORS: readonly string[] = [
  '3.3.1', // HIV
  '3.3.4', // B型肝炎
  '3.5.1', // 依存症
  '3.5.2', // 飲酒の問題
  '3.7.1', // 避妊・パートナー
  '3.7.2', // 10代の妊娠
  '10.3.1', // いじめ・嫌がらせ
  '10.7.4', // 迫害・紛争からの避難
  '16.2.1', // 家庭内の暴力
  '16.2.3', // 子どもの頃の性的暴力
  '16.3.1', // 暴力や性的被害の相談先
]

// 機微の理由。sensitive_reasons(DB の text[])にこの名前で残す
//   WORDS = 書いた言葉 / MINOR = 18歳未満 / INDICATOR = AI が選んだ指標の印(v2 の初めは本人が選んだ指標) / AI = AI の判定
//   AI_UNAVAILABLE = AI で分類できなかった(使えない・時間切れ・壊れた応答) / ADMIN = 運営が機微にした / ADMIN_CLEARED = 運営が機微を外した
export type SensitiveReason = 'WORDS' | 'MINOR' | 'INDICATOR' | 'AI' | 'AI_UNAVAILABLE' | 'ADMIN' | 'ADMIN_CLEARED'

export const SENSITIVE_REASONS: readonly SensitiveReason[] = ['WORDS', 'MINOR', 'INDICATOR', 'AI', 'AI_UNAVAILABLE', 'ADMIN', 'ADMIN_CLEARED']

// AI の分類の結果のうち、機微と緊急の判定に使うところ。ok: false は AI が使えなかったとき
export type AiJudgement = { ok: true; indicatorCodes: readonly string[]; sensitive: boolean } | { ok: false }

export function isSensitiveIndicator(code: string, urgentCodes: ReadonlySet<string>): boolean {
  return urgentCodes.has(code) || EXTRA_SENSITIVE_INDICATORS.includes(code)
}

// DB から読んだ理由の並びを、知っている名前だけに絞る(重なりも除く)
export function normalizeReasons(value: unknown): SensitiveReason[] {
  if (!Array.isArray(value)) return []
  return SENSITIVE_REASONS.filter((r) => value.includes(r))
}

// 理由の並びから、機微として扱うかを決める。運営の決め(ADMIN / ADMIN_CLEARED)があれば、それがほかの理由より先
export function isSensitiveByReasons(reasons: readonly SensitiveReason[]): boolean {
  if (reasons.includes('ADMIN_CLEARED')) return false
  return reasons.length > 0
}

function withReasons(reasons: SensitiveReason[]): { isSensitive: boolean; reasons: SensitiveReason[] } {
  const ordered = SENSITIVE_REASONS.filter((r) => reasons.includes(r))
  return { isSensitive: isSensitiveByReasons(ordered), reasons: ordered }
}

// 届いたときの機微の判定(下限 + AI は上げるだけ + AI が使えなければ機微)
export function deriveSensitivity(input: {
  urgentWords: boolean
  isMinor: boolean
  urgentCodes: ReadonlySet<string>
  ai: AiJudgement
}): { isSensitive: boolean; reasons: SensitiveReason[] } {
  const reasons: SensitiveReason[] = []
  if (input.urgentWords) reasons.push('WORDS')
  if (input.isMinor) reasons.push('MINOR')
  if (input.ai.ok) {
    if (input.ai.indicatorCodes.some((c) => isSensitiveIndicator(c, input.urgentCodes))) reasons.push('INDICATOR')
    if (input.ai.sensitive) reasons.push('AI')
  } else {
    reasons.push('AI_UNAVAILABLE')
  }
  return withReasons(reasons)
}

// あとから AI の分類を重ねるとき(届いたときに AI が使えず、毎日の処理で分類し直した相談)。
// 上げる方向だけで、今ある理由は消さない(AI_UNAVAILABLE も残り、外すのは運営)。運営が外した相談は AI だけでは戻さない
export function raiseSensitivityWithAi(
  current: readonly SensitiveReason[],
  ai: { indicatorCodes: readonly string[]; sensitive: boolean },
  urgentCodes: ReadonlySet<string>,
): { isSensitive: boolean; reasons: SensitiveReason[] } {
  const reasons = [...current]
  if (ai.indicatorCodes.some((c) => isSensitiveIndicator(c, urgentCodes)) && !reasons.includes('INDICATOR')) reasons.push('INDICATOR')
  if (ai.sensitive && !reasons.includes('AI')) reasons.push('AI')
  return withReasons(reasons)
}

// 運営が直すとき。自動の理由は記録として残し、運営の決めを1つだけ持つ
export function setSensitivityByAdmin(current: readonly SensitiveReason[], sensitive: boolean): { isSensitive: boolean; reasons: SensitiveReason[] } {
  const kept = current.filter((r) => r !== 'ADMIN' && r !== 'ADMIN_CLEARED')
  return withReasons([...kept, sensitive ? 'ADMIN' : 'ADMIN_CLEARED'])
}
