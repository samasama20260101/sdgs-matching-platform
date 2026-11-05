// やりとりの読み直し(20 秒ごと)で、新しい分だけを取って足す決まり(純粋関数。テストする)。
// 書き込みが同時に起きると、先に時刻を取った行があとから見えることがある。取りこぼさないよう、
// 最後に見た時刻より少し前から取り直し、同じ id は新しく取った方で置き換える
export const THREAD_POLL_OVERLAP_MS = 60_000

type Stamped = { id: string; createdAt: string }

// 次の読み直しで使う「この時刻より後」。まだ 1 件もなければ null(全部を取る)
export function threadPollAfter(messages: readonly Stamped[]): string | null {
  let latest = Number.NEGATIVE_INFINITY
  for (const m of messages) {
    const t = Date.parse(m.createdAt)
    if (Number.isFinite(t) && t > latest) latest = t
  }
  return Number.isFinite(latest) ? new Date(latest - THREAD_POLL_OVERLAP_MS).toISOString() : null
}

// 取った分を足す。同じ id は新しく取った方(訳が増えているかもしれない)。古い順に並べる
export function mergeThread<T extends Stamped>(prev: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map<string, T>()
  for (const m of prev) byId.set(m.id, m)
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))
}

// API が受け取る after。日時として読めないものは無視する(全部を返す)
export function parseThreadAfter(value: string | null): string | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}
