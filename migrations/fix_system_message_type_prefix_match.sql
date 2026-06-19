-- ============================================================
-- システムメッセージ判定の接頭辞補正
-- 実行場所: Supabase Dashboard -> SQL Editor (Staging first)
--
-- 方針:
-- - PostgreSQL LIKE の "_" ワイルドカード誤判定を避ける
-- - "__SYSTEM__" で始まるメッセージだけを SYSTEM として扱う
-- - 既存メッセージは削除しない
-- ============================================================

BEGIN;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'USER';

UPDATE messages
SET message_type = 'USER'
WHERE message_type = 'SYSTEM'
  AND content NOT LIKE '\_\_SYSTEM\_\_%' ESCAPE '\';

UPDATE messages
SET message_type = 'SYSTEM'
WHERE content LIKE '\_\_SYSTEM\_\_%' ESCAPE '\';

COMMIT;
