import 'server-only'

// 支援団体の写真(#178)を置く・外す。団体の管理の人の API と、運営の API の両方から使う。
// 置く前に src/lib/domain/supporterPhoto.ts の inspectSupporterPhoto で形を確かめ、付帯情報を外した写しを置く。
// 差し替えは「今の置き場所が読んだときのまま」のときだけ書く(同時に 2 つ送られても、どちらかの写真が宙に浮かないように)
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/server'
import { SUPPORTER_PHOTO_BUCKET, inspectSupporterPhoto, supporterPhotoPath, supporterPhotoUrl, type PhotoInspection } from '@/lib/domain/supporterPhoto'

export function photoUrlOf(path: string | null | undefined): string | null {
  return supporterPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, path)
}

export type SavePhotoResult =
  | { ok: true; photoUrl: string }
  | { ok: false; code: 'INVALID_IMAGE'; reason: Extract<PhotoInspection, { ok: false }>['reason'] }
  | { ok: false; code: 'NOT_FOUND' | 'CONFLICT' | 'FAILED' }

async function currentPath(organizationId: string): Promise<{ found: boolean; path: string | null; failed: boolean }> {
  const { data, error } = await supabaseAdmin.from('organizations').select('photo_path').eq('id', organizationId).maybeSingle()
  if (error) return { found: false, path: null, failed: true }
  return { found: data !== null, path: (data?.photo_path as string | null) ?? null, failed: false }
}

// 古い写真は消せなくても失敗にしない(公開のアドレスは団体の行から外れるので、もう画面には出ない)
async function removeObject(path: string | null) {
  if (!path) return
  const { error } = await supabaseAdmin.storage.from(SUPPORTER_PHOTO_BUCKET).remove([path])
  if (error) console.error('[supporterPhotos] remove', error)
}

export async function saveSupporterPhoto(organizationId: string, raw: Uint8Array): Promise<SavePhotoResult> {
  const inspected = inspectSupporterPhoto(raw)
  if (!inspected.ok) return { ok: false, code: 'INVALID_IMAGE', reason: inspected.reason }
  const before = await currentPath(organizationId)
  if (before.failed) return { ok: false, code: 'FAILED' }
  if (!before.found) return { ok: false, code: 'NOT_FOUND' }

  const path = supporterPhotoPath(organizationId, randomUUID())
  const { error: uploadError } = await supabaseAdmin.storage.from(SUPPORTER_PHOTO_BUCKET).upload(path, inspected.bytes, {
    contentType: 'image/jpeg',
    // 名前は差し替えるたびに変わるが、外した写真が配信の途中の保存(CDN)に長く残らないよう 1 時間にする
    // (運営が合わない写真を外したとき。2026-11-28 に Staging で、消したあとも保存の期間は公開のアドレスで見えることを確かめた)
    cacheControl: '3600',
    upsert: false,
  })
  if (uploadError) {
    console.error('[supporterPhotos] upload', uploadError)
    return { ok: false, code: 'FAILED' }
  }
  const update = supabaseAdmin.from('organizations').update({ photo_path: path }).eq('id', organizationId)
  const { data: updated, error: updateError } = await (before.path === null ? update.is('photo_path', null) : update.eq('photo_path', before.path)).select('id')
  if (updateError || !updated || updated.length === 0) {
    if (updateError) console.error('[supporterPhotos] update', updateError)
    await removeObject(path)
    return { ok: false, code: updateError ? 'FAILED' : 'CONFLICT' }
  }
  await removeObject(before.path)
  return { ok: true, photoUrl: photoUrlOf(path) ?? '' }
}

export async function removeSupporterPhoto(organizationId: string): Promise<{ ok: true; removed: boolean } | { ok: false; code: 'NOT_FOUND' | 'CONFLICT' | 'FAILED' }> {
  const before = await currentPath(organizationId)
  if (before.failed) return { ok: false, code: 'FAILED' }
  if (!before.found) return { ok: false, code: 'NOT_FOUND' }
  if (before.path === null) return { ok: true, removed: false }
  const { data: updated, error } = await supabaseAdmin.from('organizations').update({ photo_path: null }).eq('id', organizationId).eq('photo_path', before.path).select('id')
  if (error) {
    console.error('[supporterPhotos] clear', error)
    return { ok: false, code: 'FAILED' }
  }
  if (!updated || updated.length === 0) return { ok: false, code: 'CONFLICT' }
  await removeObject(before.path)
  return { ok: true, removed: true }
}
