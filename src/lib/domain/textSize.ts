// 文字の大きさ(引き続き考えることの 19、11/12 定例)。「わたし」で選び、端末に覚える。
// 選んだ大きさは <html data-text-size="large"> で全画面に効く(倍率は globals.css の --text-scale)。
// 端末ごとの設定にした(スマホの文字の大きさの設定と同じ考え方。アカウントには持たない)。

export const TEXT_SIZES = ['normal', 'large'] as const
export type TextSize = (typeof TEXT_SIZES)[number]

export const TEXT_SIZE_KEY = 'samasama.textSize'
export const TEXT_SIZE_ATTR = 'data-text-size'

// 覚えた値を読む。知らない値・読めないときは「ふつう」
export function parseTextSize(value: string | null | undefined): TextSize {
  return value === 'large' ? 'large' : 'normal'
}

// <html> に付ける属性の値。「ふつう」は属性を付けない(既定の倍率 1)
export function textSizeAttr(size: TextSize): string | null {
  return size === 'large' ? 'large' : null
}

// 最初の描画の前に <html> へ属性を付ける小さなスクリプト(layout の <head> に入れる)。
// これがないと、「大きい」を選んだ人にも一瞬ふつうの大きさで出てから大きくなる
export function textSizeBootScript(): string {
  return `try{if(localStorage.getItem(${JSON.stringify(TEXT_SIZE_KEY)})==="large")document.documentElement.setAttribute(${JSON.stringify(TEXT_SIZE_ATTR)},"large")}catch(e){}`
}
