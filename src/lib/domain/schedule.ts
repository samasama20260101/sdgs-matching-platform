// 毎日の自動処理の締め切り(純粋関数)。日数は盤 05 の「解決の報告から14日で自動で確定」「30日動きがなければ終了」
// 「24時間申し出がなければ、地域のコーディネーターの一覧に回す」
export const AUTO_RESOLVE_DAYS = 14
export const INACTIVE_DAYS = 30
export const ESCALATE_HOURS = 24

const HOUR = 60 * 60 * 1000

export function autoCloseCutoffs(now: Date) {
  return {
    autoResolveBefore: new Date(now.getTime() - AUTO_RESOLVE_DAYS * 24 * HOUR).toISOString(),
    inactiveBefore: new Date(now.getTime() - INACTIVE_DAYS * 24 * HOUR).toISOString(),
    escalateBefore: new Date(now.getTime() - ESCALATE_HOURS * HOUR).toISOString(),
  }
}

// 支える側の札の「待っている時間」(画面の見直し 所見 3)。24 時間までは時間、それより長いと日数で出す。
// 長く待っている印(赤)は LONG_WAIT_HOURS を超えたものだけに付ける(ほぼ全部が赤だと目立たせる意味がない)
export const LONG_WAIT_HOURS = 72

export type WaitingLabel = { unit: 'hours' | 'days'; value: number; long: boolean }

export function waitingLabel(hours: number): WaitingLabel {
  const h = Math.max(0, Math.floor(hours))
  const long = h >= LONG_WAIT_HOURS
  return h < 24 ? { unit: 'hours', value: h, long } : { unit: 'days', value: Math.floor(h / 24), long }
}
