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
