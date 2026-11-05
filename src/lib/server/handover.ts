import 'server-only'

// 引き継ぎコードの発行と照合。コードは紙で本人に渡し、DB には sha256 だけを置く
import { createHash, randomBytes } from 'node:crypto'
import { formatHandoverCode, HANDOVER_TTL_DAYS } from '@/lib/domain/handover'

export function newHandoverCode(): { code: string; hash: string; expiresAt: string } {
  const code = formatHandoverCode(new Uint8Array(randomBytes(8)))
  return { code, hash: hashHandoverCode(code), expiresAt: new Date(Date.now() + HANDOVER_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString() }
}

export function hashHandoverCode(normalized: string): string {
  return createHash('sha256').update(`samasama-handover:${normalized}`).digest('hex')
}
