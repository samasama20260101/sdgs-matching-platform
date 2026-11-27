// 支援団体の写真(#178)。実行: npm run test:units
import assert from 'node:assert/strict'
import {
  SUPPORTER_PHOTO_BUCKET, centerSquareCrop, inspectSupporterPhoto, isSupporterPhotoPathOf, supporterPhotoPath, supporterPhotoUrl,
} from '../../src/lib/domain/supporterPhoto'

const ORG = '11111111-2222-4333-8444-555555555555'
const PHOTO = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

// 置き場所とアドレス
const path = supporterPhotoPath(ORG, PHOTO)
assert.equal(path, `${ORG}/${PHOTO}.jpg`)
assert.ok(isSupporterPhotoPathOf(path, ORG))
assert.ok(!isSupporterPhotoPathOf(path, '99999999-2222-4333-8444-555555555555'), 'ほかの団体の置き場所は認めない')
assert.ok(!isSupporterPhotoPathOf(`${ORG}/../x.jpg`, ORG))
assert.ok(!isSupporterPhotoPathOf(null, ORG))
assert.equal(supporterPhotoUrl('https://x.supabase.co/', path), `https://x.supabase.co/storage/v1/object/public/${SUPPORTER_PHOTO_BUCKET}/${path}`)
assert.equal(supporterPhotoUrl('https://x.supabase.co', null), null)
assert.equal(supporterPhotoUrl(undefined, path), null)
assert.equal(supporterPhotoUrl('https://x.supabase.co', 'evil/path.jpg'), null)

// 真ん中の正方形
assert.deepEqual(centerSquareCrop(800, 600), { sx: 100, sy: 0, side: 600 })
assert.deepEqual(centerSquareCrop(600, 801), { sx: 0, sy: 100, side: 600 })
assert.deepEqual(centerSquareCrop(512, 512), { sx: 0, sy: 0, side: 512 })

// JPEG を組み立てる(区切りの形だけ。中身は検査に関係しない)
const seg = (marker: number, data: number[]) => [0xff, marker, ((data.length + 2) >> 8) & 0xff, (data.length + 2) & 0xff, ...data]
const ascii = (s: string) => [...Buffer.from(s, 'latin1')]
const sof = (w: number, h: number) => seg(0xc0, [8, h >> 8, h & 0xff, w >> 8, w & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1])
const scan = [...seg(0xda, [3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0]), 0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0xd9]
const jpeg = (w: number, h: number, extra: number[][] = []) => new Uint8Array([
  0xff, 0xd8,
  ...seg(0xe0, ascii('JFIF\0\x01\x01\0\0\x01\0\x01\0\0')),
  ...extra.flat(),
  ...seg(0xdb, [0, ...Array(64).fill(1)]),
  ...sof(w, h),
  ...seg(0xc4, [0, ...Array(16).fill(0)]),
  ...scan,
])
const exif = seg(0xe1, ascii('Exif\0\0GPS 35.6812N 139.7671E'))
const xmp = seg(0xe1, ascii('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>'))
const comment = seg(0xfe, ascii('made by phone'))
const icc = seg(0xe2, ascii('ICC_PROFILE\0\x01\x01profile'))
const mpf = seg(0xe2, ascii('MPF\0data'))
const has = (bytes: Uint8Array, text: string) => Buffer.from(bytes).includes(Buffer.from(text, 'latin1'))

const dirty = jpeg(512, 512, [exif, xmp, comment, icc, mpf])
assert.ok(has(dirty, 'GPS'))
const r = inspectSupporterPhoto(dirty)
assert.ok(r.ok)
if (r.ok) {
  assert.equal(r.width, 512)
  assert.equal(r.height, 512)
  assert.ok(!has(r.bytes, 'GPS'), '位置情報(Exif)を外す')
  assert.ok(!has(r.bytes, 'xmpmeta'), 'XMP を外す')
  assert.ok(!has(r.bytes, 'made by phone'), 'コメントを外す')
  assert.ok(!has(r.bytes, 'MPF'), 'ICC 以外の APP2 を外す')
  assert.ok(has(r.bytes, 'ICC_PROFILE'), '色の情報は残す')
  assert.ok(has(r.bytes, 'JFIF'), 'JFIF は残す')
  // 外したあとも同じ画像として読める(もう一度検査して同じ結果)
  const again = inspectSupporterPhoto(r.bytes)
  assert.ok(again.ok && Buffer.from(again.bytes).equals(Buffer.from(r.bytes)))
  // 画像の中身(SOS から終わり)はそのまま
  assert.ok(Buffer.from(r.bytes).subarray(r.bytes.length - scan.length).equals(Buffer.from(scan)))
}
// 付帯情報のない写真は形が変わらない
const clean = jpeg(256, 256)
const rc = inspectSupporterPhoto(clean)
assert.ok(rc.ok && Buffer.from(rc.bytes).equals(Buffer.from(clean)))
// 詰め物(0xFF の連続)があっても読める
const padded = new Uint8Array([0xff, 0xd8, 0xff, 0xff, ...sof(300, 300).slice(1), ...scan])
assert.ok(inspectSupporterPhoto(padded).ok)

// 断るもの
assert.deepEqual(inspectSupporterPhoto(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0])), { ok: false, reason: 'NOT_JPEG' })
assert.deepEqual(inspectSupporterPhoto(jpeg(512, 400)), { ok: false, reason: 'NOT_SQUARE' })
assert.deepEqual(inspectSupporterPhoto(jpeg(64, 64)), { ok: false, reason: 'SIZE' })
assert.deepEqual(inspectSupporterPhoto(jpeg(4096, 4096)), { ok: false, reason: 'SIZE' })
assert.deepEqual(inspectSupporterPhoto(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])), { ok: false, reason: 'BROKEN' }, '中身がない')
assert.deepEqual(inspectSupporterPhoto(dirty.subarray(0, 40)), { ok: false, reason: 'BROKEN' }, '途中で切れている')
const noFrame = new Uint8Array([0xff, 0xd8, ...seg(0xdb, [0, 1, 2]), ...scan])
assert.deepEqual(inspectSupporterPhoto(noFrame), { ok: false, reason: 'BROKEN' }, '大きさの印がない')
const badLength = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0, 0])
assert.deepEqual(inspectSupporterPhoto(badLength), { ok: false, reason: 'BROKEN' })
const garbage = new Uint8Array([0xff, 0xd8, 0x00, 0x01, 0x02])
assert.deepEqual(inspectSupporterPhoto(garbage), { ok: false, reason: 'BROKEN' })

console.log('supporterPhoto: ok')
