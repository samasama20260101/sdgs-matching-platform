-- ============================================================
-- note 記事ワークフロー用の列(設計 docs/news_section_design.md §4.5)
-- ★ 未適用。src/lib/constants/news.ts の NOTE_ARTICLE_WORKFLOW_ENABLED を true にするときに先に流す。
--   2026-09-19: 機能は実装済みだが gemini-2.5-pro が使えないため無効化(ユーザー判断)。
--   Staging には同日いったん追加したあと DROP して本番とスキーマを揃えた。
-- rollback: ALTER TABLE news_posts DROP COLUMN interview_source, DROP COLUMN note_angle,
--           DROP COLUMN note_article, DROP COLUMN note_checklist;
-- ============================================================

ALTER TABLE news_posts
    ADD COLUMN IF NOT EXISTS interview_source text NOT NULL DEFAULT '',  -- 取材メモ・書き起こし
    ADD COLUMN IF NOT EXISTS note_angle       jsonb,                      -- 選んだ切り口 {title, audience, hook, why}
    ADD COLUMN IF NOT EXISTS note_article     text NOT NULL DEFAULT '',   -- note に貼る記事本文
    ADD COLUMN IF NOT EXISTS note_checklist   text NOT NULL DEFAULT '';   -- 取材相手への確認リスト
