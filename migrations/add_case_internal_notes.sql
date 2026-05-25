-- ============================================================
-- 案件内部メモ: サポーター・運営向け非公開メモ基盤
-- 実行場所: Supabase Dashboard → SQL Editor
--
-- 方針:
-- - SOSユーザーには表示しない
-- - 承認済みサポーター間共有、自団体内メモ、運営メモを同じテーブルで扱う
-- - 監査性のため物理削除ではなく deleted_at で非表示にする
-- - 読み書き権限はサーバーサイドAPIで制御する
-- ============================================================

CREATE TABLE IF NOT EXISTS case_internal_notes (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    organization_id     uuid REFERENCES organizations(id) ON DELETE SET NULL,
    author_user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
    deleted_by_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
    visibility          text NOT NULL
        CHECK (visibility IN ('ORGANIZATION_ONLY', 'APPROVED_SUPPORTERS', 'ADMIN_ONLY')),
    body                text NOT NULL CHECK (char_length(trim(body)) > 0),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz,
    CHECK (
        visibility = 'ADMIN_ONLY'
        OR organization_id IS NOT NULL
    )
);

CREATE OR REPLACE FUNCTION update_case_internal_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_case_internal_notes_updated_at ON case_internal_notes;
CREATE TRIGGER set_case_internal_notes_updated_at
    BEFORE UPDATE ON case_internal_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_case_internal_notes_updated_at();

CREATE INDEX IF NOT EXISTS idx_case_internal_notes_case_visibility_active
    ON case_internal_notes(case_id, visibility, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_case_internal_notes_organization_case_active
    ON case_internal_notes(organization_id, case_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_case_internal_notes_author_created
    ON case_internal_notes(author_user_id, created_at DESC);

ALTER TABLE case_internal_notes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE case_internal_notes IS
    'SOSには表示しない案件内部メモ。承認済みサポーター間共有、自団体内メモ、運営メモを保持する。';
COMMENT ON COLUMN case_internal_notes.visibility IS
    'ORGANIZATION_ONLY=自団体内, APPROVED_SUPPORTERS=承認済みサポーター間共有, ADMIN_ONLY=運営のみ';
