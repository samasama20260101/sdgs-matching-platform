// 機微な相談の決め方(盤 03・63 の 3)。
//   - 指標に「機微」の印がある(命・暴力・性・虐待・依存・偏見を受けやすい病気)
//   - 相談した人が18歳未満
//   - AI の判定は機微に上げる方向にだけ効かせ、下げない。運営はどちらにも直せる(ADMIN の理由で持つ)
// 機微な相談は、個人の支え手には出さない。団体のメンバーは2つ目の確認(認証アプリ)を通った人だけが中身を見られる。
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

export type SensitiveReason = 'INDICATOR' | 'MINOR' | 'AI' | 'ADMIN'

export function isSensitiveIndicator(code: string, urgentCodes: ReadonlySet<string>): boolean {
  return urgentCodes.has(code) || EXTRA_SENSITIVE_INDICATORS.includes(code)
}

export function deriveSensitivity(input: {
  indicatorCodes: readonly string[]
  urgentCodes: ReadonlySet<string>
  isMinor: boolean
  aiSaysSensitive?: boolean
}): { isSensitive: boolean; reasons: SensitiveReason[] } {
  const reasons: SensitiveReason[] = []
  if (input.indicatorCodes.some((c) => isSensitiveIndicator(c, input.urgentCodes))) reasons.push('INDICATOR')
  if (input.isMinor) reasons.push('MINOR')
  if (input.aiSaysSensitive) reasons.push('AI')
  return { isSensitive: reasons.length > 0, reasons }
}

// AI の判定をあとから重ねるとき: 上げる方向だけ。運営が下げた(ADMIN の理由を外した)相談でも、AI だけでは戻さない
export function applyAiSensitivity(current: { isSensitive: boolean; reasons: SensitiveReason[] }, aiSaysSensitive: boolean, adminCleared: boolean) {
  if (!aiSaysSensitive || adminCleared || current.reasons.includes('AI')) return current
  return { isSensitive: true, reasons: [...current.reasons, 'AI' as const] }
}
