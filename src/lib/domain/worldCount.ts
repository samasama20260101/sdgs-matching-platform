// 世界の数(n と z)の読み替え(11/12 定例。引き続き考えることの 3)。
// n は国連 SDG データベースの世界全体(地域コード 1)の値から作る。作り方は3つで、どれで作ったかを画面に出す。
//   count   人数の系列をそのまま使う
//   share   困っている人の割合の系列に、同じ年の世界の人口を掛ける
//   lacking 行き届いている人の割合の系列(安全な水・電気など)から、行き届いていない割合を出して世界の人口を掛ける
// z(個人の課題が世界で最大限に広がったときの数)は世界の人口。

export type CountMethod = 'count' | 'share' | 'lacking'

export type WorldCount = {
  value: number      // 人数(四捨五入した整数)
  year: number       // 元の値の年
  series: string     // 国連 SDG データベースの系列コード
  source: string     // 元の値を出した機関(国連 SDG データベースの source の欄)
  method: CountMethod
}

export type WorldPopulation = { value: number; year: number; source: string }

// 国連 SDG データベースの単位の欄(Units)から、人数への倍率を返す。読めない単位は null(載せない)
export function unitMultiplier(unit: string | null | undefined): number | null {
  switch (unit) {
    case 'NUMBER':
      return 1
    case 'NUM_TH':
      return 1_000
    case 'NUM_M':
      return 1_000_000
    default:
      return null
  }
}

// 元の値を人数にする。割合は世界の人口を掛ける。読めない値・単位・範囲外は null
export function toPeople(method: CountMethod, value: number, unit: string | null | undefined, worldPopulation: number): number | null {
  if (!Number.isFinite(value) || value < 0) return null
  if (method === 'share' || method === 'lacking') {
    if (unit !== 'PERCENT' || value > 100 || !(worldPopulation > 0)) return null
    const share = method === 'share' ? value : 100 - value
    return Math.round((share / 100) * worldPopulation)
  }
  const k = unitMultiplier(unit)
  return k === null ? null : Math.round(value * k)
}
