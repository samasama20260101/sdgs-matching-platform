// 代理登録の引き継ぎコード(盤 23)。紙に書いて本人に渡すので、読み違えやすい字(0/O・1/I/L・U)を使わない。
// 形は XXX-XXX(6 字・30 ビット弱)。総当たりは API の回数制限と1コードあたりの失敗回数で止める。
export const HANDOVER_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
export const HANDOVER_CODE_LENGTH = 6
export const HANDOVER_TTL_DAYS = 30
export const HANDOVER_MAX_FAILED_ATTEMPTS = 5

export function formatHandoverCode(randomBytes: Uint8Array): string {
  if (randomBytes.length < HANDOVER_CODE_LENGTH) throw new Error('not enough random bytes')
  let raw = ''
  for (let i = 0; i < HANDOVER_CODE_LENGTH; i++) {
    raw += HANDOVER_ALPHABET[randomBytes[i] % HANDOVER_ALPHABET.length]
  }
  return `${raw.slice(0, 3)}-${raw.slice(3)}`
}

// 入力のゆれを直す(小文字・空白・ハイフンのあるなし)。使っていない字(0・O・1・I・L・U)が入っていれば誤入力
export function normalizeHandoverInput(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[\s\-‐―ー_]/g, '')
  if (cleaned.length !== HANDOVER_CODE_LENGTH) return null
  if (![...cleaned].every((ch) => HANDOVER_ALPHABET.includes(ch))) return null
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
}
