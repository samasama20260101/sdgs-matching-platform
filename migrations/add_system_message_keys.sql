-- ============================================================
-- システムメッセージのID＋パラメータ化（多言語対応 Phase 2）
-- 設計: docs/i18n_multilingual_design.md §5.5
-- 実行場所: Supabase Dashboard -> SQL Editor (Staging first)
--
-- 方針:
-- - 訳文をDBに焼き込まず、メッセージIDと変数だけを保存する
-- - content には従来どおり日本語文（__SYSTEM__ 接頭辞付き）を併記し、
--   旧クライアント・過去データとの互換、および監査可読性を保つ
-- - 過去データのバックフィルは不要（表示側が content にフォールバック）
--
-- rollback:
--   ALTER TABLE messages DROP COLUMN IF EXISTS system_key;
--   ALTER TABLE messages DROP COLUMN IF EXISTS system_params;
-- ============================================================

BEGIN;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS system_key text NULL,
  ADD COLUMN IF NOT EXISTS system_params jsonb NULL;

COMMENT ON COLUMN messages.system_key IS
  'SYSTEMメッセージの種別ID（messages/*/system.json のキー）。NULL=通常メッセージまたは旧形式';
COMMENT ON COLUMN messages.system_params IS
  'システムメッセージの変数（団体名・理由文など）。自由文はユーザー生成のため翻訳しない';

COMMIT;
