// HTML の文字参照を文字に戻す(リンク先の題・説明・本文の取り出しで共用)。
// 1 回の走査で置き換えるので「&amp;nbsp;」は「&nbsp;」のまま残る。範囲外の番号(&#99999999; など)は投げずにそのまま残す
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function fromCode(code: number, original: string) {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : original
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') return fromCode(body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : Number(body.slice(1)), match)
    return NAMED[body.toLowerCase()] ?? match
  })
}
