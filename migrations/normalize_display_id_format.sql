-- ============================================================
-- display_id の形式統一とスキーマドリフト解消
-- 実行場所: Supabase Dashboard → SQL Editor(Staging → 確認後に Production)
--
-- 背景:
-- - 初期ユーザーは手動採番の旧形式(A-000002 / S-000005 / P-000004 など)、
--   以降は RPC generate_display_id による新形式(SOS-00001 / SUP-00001 / ADM-00001)で混在していた
-- - generate_display_id 関数は本番DBにのみ存在しリポジトリ未記録だった(本ファイルで正本化)
-- - display_id の UNIQUE が migration 記載に反して本番未適用だった
-- - 旧世代の孤児シーケンス seq_display_id_*(参照なし)が残存していた
--
-- 方針:
-- - 新形式(^(SOS|SUP|ADM)-\d{5}$)に合わない display_id を、現行シーケンスで
--   created_at 順に採番し直す(ユーザー了承済み 2026-08-16)
-- - 旧→新の対応は display_id_backup_20260816 に保存(rollback 用)
-- - rollback: UPDATE users u SET display_id = b.display_id
--             FROM display_id_backup_20260816 b WHERE b.id = u.id;
-- ============================================================

-- 0. 前提オブジェクト(環境差があっても収束するよう IF NOT EXISTS / OR REPLACE)
CREATE SEQUENCE IF NOT EXISTS users_sos_display_seq START 1;
CREATE SEQUENCE IF NOT EXISTS users_sup_display_seq START 1;
CREATE SEQUENCE IF NOT EXISTS users_admin_display_seq START 1;

-- 現行の採番関数を正本化(本番の実装と同一。改行コードのみ正規化)
CREATE OR REPLACE FUNCTION public.generate_display_id(p_role text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
    CASE p_role
        WHEN 'SOS' THEN
            RETURN 'SOS-' || LPAD(nextval('users_sos_display_seq')::text, 5, '0');
        WHEN 'SUPPORTER' THEN
            RETURN 'SUP-' || LPAD(nextval('users_sup_display_seq')::text, 5, '0');
        WHEN 'ADMIN' THEN
            RETURN 'ADM-' || LPAD(nextval('users_admin_display_seq')::text, 5, '0');
        ELSE
            RAISE EXCEPTION 'unsupported display id role: %', p_role;
    END CASE;
END;
$$;

-- 旧トリガー方式の残骸を除去(現行は各APIが generate_display_id を明示的に呼ぶ)
DROP TRIGGER IF EXISTS set_user_display_id ON users;
DROP FUNCTION IF EXISTS generate_user_display_id();

-- 1. 旧→新の対応を保存(rollback 用)
CREATE TABLE IF NOT EXISTS display_id_backup_20260816 AS
SELECT id, role, display_id, created_at
FROM users
WHERE display_id IS NULL OR display_id !~ '^(SOS|SUP|ADM)-\d{5}$';

-- 2. 旧形式・未採番の display_id を created_at 順に再採番
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT id, role FROM users
        WHERE display_id IS NULL OR display_id !~ '^(SOS|SUP|ADM)-\d{5}$'
        ORDER BY created_at ASC
    LOOP
        UPDATE users SET display_id = generate_display_id(r.role) WHERE id = r.id;
    END LOOP;
END;
$$;

-- 3. 一意性を保証(全員が新形式になった後に付与)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_id_unique
    ON users(display_id)
    WHERE display_id IS NOT NULL;

-- 4. 孤児シーケンスの削除(pg_proc 全文検索で参照ゼロを確認済み 2026-08-16)
DROP SEQUENCE IF EXISTS seq_display_id_sos;
DROP SEQUENCE IF EXISTS seq_display_id_supporter;
DROP SEQUENCE IF EXISTS seq_display_id_admin;

-- 確認用:
-- SELECT role, display_id FROM users ORDER BY created_at;
-- SELECT display_id, count(*) FROM users GROUP BY 1 HAVING count(*) > 1;  -- 0件であること
