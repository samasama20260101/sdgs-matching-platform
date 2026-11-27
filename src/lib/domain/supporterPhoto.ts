// 支援団体の写真(#178、2026-11-28 岡本さん)。置き場所・大きさの決まりと、受け取った JPEG の検査と付帯情報の削除。
// 写真は画面(ブラウザ)で正方形に切り抜いて JPEG にしてから送る。サーバーでは画像を描き直さない(Workers で sharp を使えない)ので、
// ここで形を確かめ、撮った場所などが入る付帯情報(APP1 の Exif・XMP など)を外してから置く。
// 個人の支え手の顔写真は、プライバシーポリシーの改定と一緒に扱う(この決まりの外)

export const SUPPORTER_PHOTO_BUCKET = 'supporter-photos'
// 画面で作る写真の一辺(px)。表示は大きくても 64px なので、高精細の画面でも足りる
export const SUPPORTER_PHOTO_SIZE = 512
// 選んだ写真の一辺がこれより小さいと、引き伸ばしてぼやけるので断る
export const SUPPORTER_PHOTO_MIN_SOURCE = 128
// 受け取る大きさの上限(バケットの file_size_limit と同じ)
export const SUPPORTER_PHOTO_MAX_BYTES = 1_000_000
const MIN_SIDE = 128
const MAX_SIDE = 2048

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const PATH_RE = new RegExp(`^(${UUID})/(${UUID})\\.jpg$`)

// バケットの中の置き場所: <団体の id>/<写真ごとの id>.jpg。差し替えるたびに名前を変える(古い写真が見え続けないように)
export function supporterPhotoPath(organizationId: string, photoId: string): string {
  return `${organizationId}/${photoId}.jpg`
}

export function isSupporterPhotoPathOf(path: string | null | undefined, organizationId: string): boolean {
  const m = path ? PATH_RE.exec(path) : null
  return m !== null && m[1] === organizationId
}

// 公開のアドレス。置き場所がない・形が違うときは null(画面は頭文字を出す)
export function supporterPhotoUrl(supabaseUrl: string | undefined, path: string | null | undefined): string | null {
  if (!supabaseUrl || !path || !PATH_RE.test(path)) return null
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${SUPPORTER_PHOTO_BUCKET}/${path}`
}

// 選んだ写真の真ん中から正方形を切り出す範囲
export function centerSquareCrop(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height)
  return { sx: Math.floor((width - side) / 2), sy: Math.floor((height - side) / 2), side }
}

export type PhotoInspection =
  | { ok: true; width: number; height: number; bytes: Uint8Array }
  | { ok: false; reason: 'NOT_JPEG' | 'BROKEN' | 'NOT_SQUARE' | 'SIZE' }

// 長さを持たない印(SOI・EOI・RST0〜7・TEM)
const isStandalone = (m: number) => m === 0xd8 || m === 0xd9 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)
// 大きさが書かれている印(SOF0〜15 のうち DHT・JPG・DAC を除く)
const isStartOfFrame = (m: number) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc
const ICC = [0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00] // "ICC_PROFILE\0"

// 外す区切り: APP1〜APP15(Exif・XMP・撮影機の情報など。色の情報の ICC だけは残す)とコメント
function dropSegment(marker: number, bytes: Uint8Array, dataStart: number, dataEnd: number): boolean {
  if (marker === 0xfe) return true
  if (marker === 0xe2) return !ICC.every((b, i) => dataStart + i < dataEnd && bytes[dataStart + i] === b)
  return marker >= 0xe1 && marker <= 0xef
}

// JPEG を読み、正方形で一辺が 128〜2048px かを確かめ、付帯情報を外した写しを返す。読めないものは断る
export function inspectSupporterPhoto(bytes: Uint8Array): PhotoInspection {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return { ok: false, reason: 'NOT_JPEG' }
  const kept: Uint8Array[] = [bytes.subarray(0, 2)]
  let size: { width: number; height: number } | null = null
  let i = 2
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return { ok: false, reason: 'BROKEN' }
    // 印の前の詰め物(0xFF の連続)を飛ばす
    let j = i
    while (j < bytes.length && bytes[j] === 0xff) j++
    if (j >= bytes.length) return { ok: false, reason: 'BROKEN' }
    const marker = bytes[j]
    const segStart = j - 1
    if (isStandalone(marker)) {
      if (marker === 0xd9) return { ok: false, reason: 'BROKEN' } // 画像の中身より前に終わった
      kept.push(bytes.subarray(segStart, j + 1))
      i = j + 1
      continue
    }
    if (j + 2 >= bytes.length) return { ok: false, reason: 'BROKEN' }
    const len = (bytes[j + 1] << 8) | bytes[j + 2]
    const dataStart = j + 3
    const segEnd = j + 1 + len
    if (len < 2 || segEnd > bytes.length) return { ok: false, reason: 'BROKEN' }
    if (isStartOfFrame(marker)) {
      if (len < 7) return { ok: false, reason: 'BROKEN' }
      size = { height: (bytes[dataStart + 1] << 8) | bytes[dataStart + 2], width: (bytes[dataStart + 3] << 8) | bytes[dataStart + 4] }
    }
    if (marker === 0xda) {
      // 画像の中身(SOS から終わりまで)はそのまま写す
      if (!size) return { ok: false, reason: 'BROKEN' }
      kept.push(bytes.subarray(segStart))
      break
    }
    if (!dropSegment(marker, bytes, dataStart, segEnd)) kept.push(bytes.subarray(segStart, segEnd))
    i = segEnd
  }
  if (!size || kept.length < 2 || kept[kept.length - 1][1] !== 0xda) return { ok: false, reason: 'BROKEN' }
  if (size.width !== size.height) return { ok: false, reason: 'NOT_SQUARE' }
  if (size.width < MIN_SIDE || size.width > MAX_SIDE) return { ok: false, reason: 'SIZE' }
  const total = kept.reduce((n, k) => n + k.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const k of kept) {
    out.set(k, at)
    at += k.length
  }
  return { ok: true, width: size.width, height: size.height, bytes: out }
}
