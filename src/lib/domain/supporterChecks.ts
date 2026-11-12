// 支え手の団体の申し込みで答えてもらう6つの点(面談チェックリスト v0 の No.1〜6。11/9 代表、11/12 定例)。
// 申し込みでは自己採点として「当てはまる/面談で相談したい」を選び、書けるところは一言そえてもらう。
// 面談では、この答えをもとに質問例で確かめる。面談前の自己採点はこれ1回にまとめた(11/12)。
// 答えは organizations.application に `check_<key>`(選んだもの)と `check_<key>_note`(一言)で入る。

export const SUPPORTER_CHECKS = ['care', 'imagine', 'consulteeFirst', 'activity', 'direct', 'barriers'] as const
export type SupporterCheck = (typeof SUPPORTER_CHECKS)[number]

export const SELF_CHECKS = ['yes', 'discuss'] as const
export type SelfCheck = (typeof SELF_CHECKS)[number]

export const NOTE_MAX = 2000

export function choiceKey(check: SupporterCheck): string {
  return `check_${check}`
}

export function noteKey(check: SupporterCheck): string {
  return `check_${check}_note`
}

export function isSelfCheck(value: unknown): value is SelfCheck {
  return typeof value === 'string' && (SELF_CHECKS as readonly string[]).includes(value)
}

// 6つすべてに選んだものがあるか。足りない点を返す(並びは SUPPORTER_CHECKS の順)
export function missingChecks(application: Record<string, string> | null | undefined): SupporterCheck[] {
  return SUPPORTER_CHECKS.filter((check) => !isSelfCheck(application?.[choiceKey(check)]))
}

// 画面の入力から、申し込みに載せる答えを作る。一言は前後の空白を落とし、空なら載せない
export function checkAnswers(
  choices: Partial<Record<SupporterCheck, SelfCheck>>,
  notes: Partial<Record<SupporterCheck, string>>,
): Record<string, string> {
  const answers: Record<string, string> = {}
  for (const check of SUPPORTER_CHECKS) {
    const choice = choices[check]
    if (isSelfCheck(choice)) answers[choiceKey(check)] = choice
    const note = notes[check]?.trim()
    if (note) answers[noteKey(check)] = note.slice(0, NOTE_MAX)
  }
  return answers
}

// 運営の審査の画面で、申し込みの答えのキーを6つの点に読み替える(それ以外のキーは null)
export function parseCheckKey(key: string): { check: SupporterCheck; part: 'choice' | 'note' } | null {
  for (const check of SUPPORTER_CHECKS) {
    if (key === choiceKey(check)) return { check, part: 'choice' }
    if (key === noteKey(check)) return { check, part: 'note' }
  }
  return null
}
