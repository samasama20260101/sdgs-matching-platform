// 代理登録の引き継ぎコード(盤 23)。紙に書いて本人に渡すので、読み違えやすい字(0/O・1/I/L・U)を使わない。
// 形は XXXXX-XXXXX(30 種 × 10 字 ≒ 49 ビット)。6 字(約 29 ビット)では、アカウントを替えながら
// 同時に送れば総当たりで当てられた(セキュリティのレビュー 11/5)。回数の上限は API にもあるが、守りの本体は長さ
export const HANDOVER_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
export const HANDOVER_CODE_LENGTH = 10
export const HANDOVER_TTL_DAYS = 30
export const HANDOVER_MAX_FAILED_ATTEMPTS = 5

const GROUP = HANDOVER_CODE_LENGTH / 2
// 256 を 30 で割った余りの偏りを出さないため、240(= 30 × 8)以上の値は捨てる
const LIMIT = Math.floor(256 / HANDOVER_ALPHABET.length) * HANDOVER_ALPHABET.length

function group(raw: string): string {
  return `${raw.slice(0, GROUP)}-${raw.slice(GROUP)}`
}

export function formatHandoverCode(randomBytes: Uint8Array): string {
  let raw = ''
  for (const b of randomBytes) {
    if (b >= LIMIT) continue
    raw += HANDOVER_ALPHABET[b % HANDOVER_ALPHABET.length]
    if (raw.length === HANDOVER_CODE_LENGTH) return group(raw)
  }
  throw new Error('not enough random bytes')
}

// 入力のゆれを直す(小文字・空白・ハイフンのあるなし)。使っていない字(0・O・1・I・L・U)が入っていれば誤入力
export function normalizeHandoverInput(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[\s\-‐―ー_]/g, '')
  if (cleaned.length !== HANDOVER_CODE_LENGTH) return null
  if (![...cleaned].every((ch) => HANDOVER_ALPHABET.includes(ch))) return null
  return group(cleaned)
}
