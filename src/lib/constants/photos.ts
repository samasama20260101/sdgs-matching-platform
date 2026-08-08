// 案件写真の共通基盤。写真データは cases.intake_qna.photos(JSONB)に保存し、
// 画像本体は Supabase Storage の非公開バケット(case-photos)に置いて署名URLで配信する。
// 現在は災害SOS案件のみ解放(isCasePhotosEnabled)。通常案件へ展開するときはここを変える。

export const CASE_PHOTOS_BUCKET = 'case-photos'
export const MAX_CASE_PHOTOS = 3
export const CASE_PHOTO_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const CASE_PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60
export const CASE_PHOTO_ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export type CasePhoto = { id: string; path: string; created_at: string }

export function isCasePhotosEnabled(intakeQna: unknown): boolean {
  return Boolean((intakeQna as { disaster?: unknown } | null)?.disaster)
}

export function getCasePhotos(intakeQna: unknown): CasePhoto[] {
  const photos = (intakeQna as { photos?: unknown } | null)?.photos
  if (!Array.isArray(photos)) return []
  return photos.filter((p): p is CasePhoto =>
    Boolean(p && typeof p === 'object'
      && typeof (p as CasePhoto).id === 'string'
      && typeof (p as CasePhoto).path === 'string'))
}
