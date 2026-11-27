-- ============================================================================
-- v2_21_organization_photos.sql(#178、2026-11-28)
-- 目的: 支援団体の写真を 1 枚載せられるようにする。置き場所は Storage の公開バケット supporter-photos、
--   団体の行には置き場所(<団体の id>/<写真の id>.jpg)だけを持つ。書き込みはサーバー(service_role)だけ。
--   バケットにはポリシーを足さない(anon・authenticated からは書けない・一覧も取れない。公開のアドレスで読むだけ)。
--   個人の支え手の顔写真は、プライバシーポリシーの改定と一緒に別で扱う(ここでは足さない)。
-- 実行場所: Staging で確かめてから本番(本番は v2 の画面に切り替えるときに続けて流す)。列を足すだけなので、
--   画面を出す前に流してよい。何度流しても同じ結果になる。
-- 戻し方: ALTER TABLE organizations DROP COLUMN photo_path; バケットの中身を消してから DELETE FROM storage.buckets WHERE id = 'supporter-photos';
-- ============================================================================

BEGIN;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS photo_path text;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_photo_path_format;
ALTER TABLE organizations ADD CONSTRAINT organizations_photo_path_format CHECK (
  photo_path IS NULL
  OR (
    photo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
    AND split_part(photo_path, '/', 1) = id::text
  )
);

COMMENT ON COLUMN organizations.photo_path IS '支援団体の写真の置き場所(Storage の supporter-photos の中。<団体の id>/<写真の id>.jpg)。#178';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('supporter-photos', 'supporter-photos', true, 1000000, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
