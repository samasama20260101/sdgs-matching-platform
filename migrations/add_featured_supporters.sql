-- ============================================================
-- トップページ掲載設定用カラム追加
-- 実行場所: Supabase Dashboard → SQL Editor
-- ============================================================

-- usersテーブルにフィーチャー関連カラムを追加
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_order integer NOT NULL DEFAULT 0;

-- インデックス（フィーチャード一覧取得を高速化）
CREATE INDEX IF NOT EXISTS idx_users_is_featured
  ON users (is_featured, featured_order)
  WHERE is_featured = true;
