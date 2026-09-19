-- ============================================================
-- トップページお知らせ欄: news_posts テーブル
-- 設計: docs/news_section_design.md §3.1
-- 実行場所: Staging は Management API、本番は Supabase Dashboard → SQL Editor(ユーザー実行)
-- rollback: DROP TABLE news_posts;(他テーブルから参照されない)
-- ============================================================

CREATE TABLE IF NOT EXISTS news_posts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category      text NOT NULL
                  CHECK (category IN ('NOTICE', 'MAINTENANCE', 'SUPPORTER_JOINED', 'INTERVIEW')),
    title         text NOT NULL,
    body          text NOT NULL DEFAULT '',   -- プレーンテキスト(空行=段落 / 行頭「## 」=小見出し / URL自動リンク)
    external_url  text,                       -- あればトップ・一覧から直接外部へ(note など)
    status        text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
    published_at  timestamptz,                -- 表示日・並び順。公開時に未設定なら API が now() を入れる
    created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
    -- INTERVIEW 用: note 記事ワークフロー(設計 §4.5)。取材メモ → 切り口 → 記事本文 → 確認リスト
    interview_source text NOT NULL DEFAULT '',  -- 取材メモ・書き起こし(AI の材料。オフレコは「非公開」と付ければ AI が無視する)
    note_angle       jsonb,                      -- 選んだ切り口 {title, audience, hook, why}
    note_article     text NOT NULL DEFAULT '',   -- note に貼る記事本文(## 見出し / > 引用 / 空行=段落)
    note_checklist   text NOT NULL DEFAULT '',   -- 取材相手に確認する項目(見直し AI の出力を人が直したもの)
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
-- Staging には 2026-09-17 に上の4列なしで作成し、2026-09-19 に ALTER TABLE ... ADD COLUMN で追加済み。本番はこのファイルを一度流せばよい

-- RLS 有効・ポリシーなし = anon / authenticated は読めない。service_role(API)だけが触る
ALTER TABLE news_posts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_news_posts_published
    ON news_posts (published_at DESC) WHERE status = 'PUBLISHED';

-- updated_at 自動更新(inquiries と同じ形)
CREATE OR REPLACE FUNCTION update_news_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_news_posts_updated_at ON news_posts;
CREATE TRIGGER set_news_posts_updated_at
    BEFORE UPDATE ON news_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_news_posts_updated_at();
