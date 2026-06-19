-- ============================================================
-- 管理画面検索の基盤: 案件番号・メール一意性
-- 実行場所: Supabase Dashboard -> SQL Editor (Staging first)
--
-- 方針:
-- - 管理画面から人が案件を検索・共有できる CASE-00001 形式の番号を付ける
-- - public.users のメールアドレスは大文字小文字と前後空白を無視して一意にする
-- - 既存データを削除しない
-- ============================================================

BEGIN;

ALTER TABLE cases
    ADD COLUMN IF NOT EXISTS display_id text;

CREATE SEQUENCE IF NOT EXISTS cases_display_seq START 1;

SELECT setval(
    'cases_display_seq',
    GREATEST(
        COALESCE((
            SELECT MAX(SUBSTRING(display_id FROM 6)::bigint)
            FROM cases
            WHERE display_id ~ '^CASE-[0-9]{5,}$'
        ), 0),
        1
    ),
    EXISTS (SELECT 1 FROM cases WHERE display_id ~ '^CASE-[0-9]{5,}$')
);

UPDATE cases
SET display_id = 'CASE-' || LPAD(nextval('cases_display_seq')::text, 5, '0')
WHERE display_id IS NULL OR display_id = '';

CREATE OR REPLACE FUNCTION generate_case_display_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_id IS NULL OR NEW.display_id = '' THEN
        NEW.display_id := 'CASE-' || LPAD(nextval('cases_display_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_case_display_id ON cases;
CREATE TRIGGER set_case_display_id
    BEFORE INSERT ON cases
    FOR EACH ROW
    EXECUTE FUNCTION generate_case_display_id();

ALTER TABLE cases
    ALTER COLUMN display_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'cases_display_id_unique'
          AND conrelid = 'cases'::regclass
    ) THEN
        ALTER TABLE cases
            ADD CONSTRAINT cases_display_id_unique UNIQUE (display_id);
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_normalized_unique
    ON users(lower(btrim(email)))
    WHERE email IS NOT NULL;

COMMIT;
