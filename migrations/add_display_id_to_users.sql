-- usersテーブルにdisplay_id追加（SOS-00001 / SUP-00001形式）
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_id text UNIQUE;

-- SOS用シーケンス
CREATE SEQUENCE IF NOT EXISTS users_sos_display_seq START 1;
-- SUPPORTER用シーケンス
CREATE SEQUENCE IF NOT EXISTS users_sup_display_seq START 1;

-- display_id自動生成関数
CREATE OR REPLACE FUNCTION generate_user_display_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_id IS NULL OR NEW.display_id = '' THEN
        IF NEW.role = 'SOS' THEN
            NEW.display_id := 'SOS-' || LPAD(nextval('users_sos_display_seq')::text, 5, '0');
        ELSIF NEW.role = 'SUPPORTER' THEN
            NEW.display_id := 'SUP-' || LPAD(nextval('users_sup_display_seq')::text, 5, '0');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_display_id ON users;
CREATE TRIGGER set_user_display_id
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION generate_user_display_id();

-- 既存ユーザーへのdisplay_id付与
DO $$
DECLARE
    r RECORD;
    seq_val bigint;
BEGIN
    FOR r IN SELECT id, role FROM users WHERE display_id IS NULL ORDER BY created_at ASC
    LOOP
        IF r.role = 'SOS' THEN
            seq_val := nextval('users_sos_display_seq');
            UPDATE users SET display_id = 'SOS-' || LPAD(seq_val::text, 5, '0') WHERE id = r.id;
        ELSIF r.role = 'SUPPORTER' THEN
            seq_val := nextval('users_sup_display_seq');
            UPDATE users SET display_id = 'SUP-' || LPAD(seq_val::text, 5, '0') WHERE id = r.id;
        END IF;
    END LOOP;
END;
$$;
