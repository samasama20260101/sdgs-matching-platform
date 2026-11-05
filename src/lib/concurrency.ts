// 外への呼び出し(AI・メール)を、同時に size 件ずつ並べて行う。結果は items と同じ順(純粋な組み立てだけ。テストする)
export async function mapInBatches<T, R>(items: readonly T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  const step = Math.max(1, Math.floor(size))
  for (let i = 0; i < items.length; i += step) {
    out.push(...(await Promise.all(items.slice(i, i + step).map(fn))))
  }
  return out
}
