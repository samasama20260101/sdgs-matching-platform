// 申し出の決まり(盤 14・15)。1件の相談に支え手は3者まで。最初に選んだ1者が中心になって進める。
// 中心の支え手は、相談した人の同意を得て、ほかの支え手を招ける(招かれた側は INVITED → 相談した人が同意すると ACCEPTED)
export const MAX_SUPPORTERS_PER_CASE = 3
export const OFFER_MESSAGE_MAX = 1000

// ありがとう(相談した人が解決を確定するときに贈る言葉。いくつ選んでも1回のありがとうとして数える、11/5)
export const THANKS_WORDS = ['very_satisfied', 'quick_response', 'sincere_support', 'problem_solved', 'grateful_partner'] as const
export type ThanksWord = (typeof THANKS_WORDS)[number]

export function sanitizeThanks(value: unknown): ThanksWord[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((v): v is ThanksWord => typeof v === 'string' && (THANKS_WORDS as readonly string[]).includes(v)))]
}
