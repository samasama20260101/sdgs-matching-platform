-- ============================================================
-- サポーター団体DB刷新: 基盤制約・監査性の強化
-- 実行場所: Supabase Dashboard -> SQL Editor (Staging first)
--
-- 方針:
-- - 履歴データを削除しない
-- - 不整合があれば制約追加時に停止し、個別確認する
-- - 通常運用では団体を物理削除せず ARCHIVED にする
-- ============================================================

BEGIN;

-- 1ユーザーが同時に所属できる団体は1件まで。
-- 将来複数所属を許可する場合は、操作中団体を選ぶUI/APIと合わせて外す。
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_memberships_user_current_unique
    ON organization_memberships(user_id)
    WHERE status IN ('ACTIVE', 'SUSPENDED');

-- 最後の有効OWNERを停止・解除・削除できないようにする。
CREATE OR REPLACE FUNCTION prevent_last_active_organization_owner_removal()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role = 'OWNER'
       AND OLD.status = 'ACTIVE'
       AND (
           TG_OP = 'DELETE'
           OR (
               TG_OP = 'UPDATE'
               AND (NEW.role <> 'OWNER' OR NEW.status <> 'ACTIVE')
           )
       )
    THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(OLD.organization_id::text, 0));

        IF NOT EXISTS (
            SELECT 1
            FROM organization_memberships om
            WHERE om.organization_id = OLD.organization_id
              AND om.id <> OLD.id
              AND om.role = 'OWNER'
              AND om.status = 'ACTIVE'
        ) THEN
            RAISE EXCEPTION 'organization must retain at least one active OWNER';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_last_active_organization_owner_removal
    ON organization_memberships;
CREATE TRIGGER prevent_last_active_organization_owner_removal
    BEFORE UPDATE OR DELETE ON organization_memberships
    FOR EACH ROW
    EXECUTE FUNCTION prevent_last_active_organization_owner_removal();

-- 団体は履歴の正本。関連データがある団体は物理削除させない。
-- 作成途中で失敗した空団体だけは清掃可能にする。
CREATE OR REPLACE FUNCTION prevent_nonempty_organization_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = OLD.id)
       OR EXISTS (SELECT 1 FROM organization_invitations WHERE organization_id = OLD.id)
       OR EXISTS (SELECT 1 FROM supporter_service_areas WHERE organization_id = OLD.id)
       OR EXISTS (SELECT 1 FROM offers WHERE supporter_organization_id = OLD.id)
       OR EXISTS (SELECT 1 FROM supporter_badges WHERE supporter_organization_id = OLD.id)
       OR EXISTS (SELECT 1 FROM messages WHERE sender_organization_id = OLD.id)
       OR EXISTS (SELECT 1 FROM audit_logs WHERE organization_id = OLD.id)
       OR EXISTS (SELECT 1 FROM case_internal_notes WHERE organization_id = OLD.id)
    THEN
        RAISE EXCEPTION 'organization has related history; set status to ARCHIVED instead of deleting';
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_nonempty_organization_deletion ON organizations;
CREATE TRIGGER prevent_nonempty_organization_deletion
    BEFORE DELETE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION prevent_nonempty_organization_deletion();

-- 活動地域の正規化と整合性制約。
UPDATE supporter_service_areas
SET country = 'JP'
WHERE country IS NULL;

ALTER TABLE supporter_service_areas
    ALTER COLUMN country SET DEFAULT 'JP',
    ALTER COLUMN country SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'supporter_service_areas_region_shape'
          AND conrelid = 'supporter_service_areas'::regclass
    ) THEN
        ALTER TABLE supporter_service_areas
            ADD CONSTRAINT supporter_service_areas_region_shape
            CHECK (
                (is_nationwide = true AND region_code IS NULL)
                OR
                (is_nationwide = false AND region_code IS NOT NULL)
            ) NOT VALID;
    END IF;
END;
$$;

ALTER TABLE supporter_service_areas
    VALIDATE CONSTRAINT supporter_service_areas_region_shape;

CREATE UNIQUE INDEX IF NOT EXISTS idx_supporter_service_areas_region_unique
    ON supporter_service_areas(organization_id, country, region_code)
    WHERE is_nationwide = false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_supporter_service_areas_nationwide_unique
    ON supporter_service_areas(organization_id, country)
    WHERE is_nationwide = true;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM supporter_service_areas nationwide
        JOIN supporter_service_areas regional
          ON regional.organization_id = nationwide.organization_id
         AND regional.country = nationwide.country
        WHERE nationwide.is_nationwide = true
          AND regional.is_nationwide = false
    ) THEN
        RAISE EXCEPTION 'supporter_service_areas contains nationwide and regional rows for the same organization and country';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_mixed_supporter_service_areas()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM supporter_service_areas ssa
        WHERE ssa.organization_id = NEW.organization_id
          AND ssa.country = NEW.country
          AND ssa.is_nationwide <> NEW.is_nationwide
          AND ssa.id <> COALESCE(NEW.id, gen_random_uuid())
    ) THEN
        RAISE EXCEPTION 'nationwide and regional service areas cannot coexist for the same organization and country';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_mixed_supporter_service_areas
    ON supporter_service_areas;
CREATE TRIGGER prevent_mixed_supporter_service_areas
    BEFORE INSERT OR UPDATE ON supporter_service_areas
    FOR EACH ROW
    EXECUTE FUNCTION prevent_mixed_supporter_service_areas();

-- APIが利用する採番関数をmigrationとして正式化する。
CREATE SEQUENCE IF NOT EXISTS users_sos_display_seq START 1;
CREATE SEQUENCE IF NOT EXISTS users_sup_display_seq START 1;
CREATE SEQUENCE IF NOT EXISTS users_admin_display_seq START 1;
CREATE SEQUENCE IF NOT EXISTS organizations_display_seq START 1;

SELECT setval(
    'users_sos_display_seq',
    GREATEST(
        COALESCE((
            SELECT MAX(SUBSTRING(display_id FROM 5)::bigint)
            FROM users
            WHERE display_id ~ '^SOS-[0-9]{5,}$'
        ), 0),
        1
    ),
    EXISTS (SELECT 1 FROM users WHERE display_id ~ '^SOS-[0-9]{5,}$')
);

SELECT setval(
    'users_sup_display_seq',
    GREATEST(
        COALESCE((
            SELECT MAX(SUBSTRING(display_id FROM 5)::bigint)
            FROM users
            WHERE display_id ~ '^SUP-[0-9]{5,}$'
        ), 0),
        1
    ),
    EXISTS (SELECT 1 FROM users WHERE display_id ~ '^SUP-[0-9]{5,}$')
);

SELECT setval(
    'users_admin_display_seq',
    GREATEST(
        COALESCE((
            SELECT MAX(SUBSTRING(display_id FROM 5)::bigint)
            FROM users
            WHERE display_id ~ '^ADM-[0-9]{5,}$'
        ), 0),
        1
    ),
    EXISTS (SELECT 1 FROM users WHERE display_id ~ '^ADM-[0-9]{5,}$')
);

CREATE OR REPLACE FUNCTION generate_display_id(p_role text)
RETURNS text AS $$
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
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION generate_display_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_display_id(text) TO service_role;

-- 団体の管理用IDと、将来の公開URL用slug。
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS display_id text,
    ADD COLUMN IF NOT EXISTS slug text;

WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS sequence_number
    FROM organizations
    WHERE display_id IS NULL OR display_id = ''
)
UPDATE organizations organization
SET display_id = 'ORG-' || LPAD(numbered.sequence_number::text, 5, '0')
FROM numbered
WHERE organization.id = numbered.id;

SELECT setval(
    'organizations_display_seq',
    GREATEST(
        COALESCE((
            SELECT MAX(SUBSTRING(display_id FROM 5)::bigint)
            FROM organizations
            WHERE display_id ~ '^ORG-[0-9]{5,}$'
        ), 0),
        1
    ),
    EXISTS (SELECT 1 FROM organizations)
);

CREATE OR REPLACE FUNCTION generate_organization_display_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_id IS NULL OR NEW.display_id = '' THEN
        NEW.display_id := 'ORG-' || LPAD(nextval('organizations_display_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_organization_display_id ON organizations;
CREATE TRIGGER set_organization_display_id
    BEFORE INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION generate_organization_display_id();

ALTER TABLE organizations
    ALTER COLUMN display_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'organizations_display_id_unique'
          AND conrelid = 'organizations'::regclass
    ) THEN
        ALTER TABLE organizations
            ADD CONSTRAINT organizations_display_id_unique UNIQUE (display_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'organizations_slug_shape'
          AND conrelid = 'organizations'::regclass
    ) THEN
        ALTER TABLE organizations
            ADD CONSTRAINT organizations_slug_shape
            CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug_unique
    ON organizations(lower(slug))
    WHERE slug IS NOT NULL;

-- メッセージをユーザー投稿とシステム投稿に分離する。
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'USER';

UPDATE messages
SET message_type = 'SYSTEM'
WHERE content LIKE '__SYSTEM__%';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'messages_message_type_allowed'
          AND conrelid = 'messages'::regclass
    ) THEN
        ALTER TABLE messages
            ADD CONSTRAINT messages_message_type_allowed
            CHECK (message_type IN ('USER', 'SYSTEM'));
    END IF;
END;
$$;

-- 現行アプリで利用するステータスをDBでも明示する。
-- 旧IN_PROGRESSは、承認済みサポーターが支援中であるMATCHEDへ統合する。
UPDATE cases
SET status = 'MATCHED'
WHERE status = 'IN_PROGRESS';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'cases_status_allowed'
          AND conrelid = 'cases'::regclass
    ) THEN
        ALTER TABLE cases
            ADD CONSTRAINT cases_status_allowed
            CHECK (status IN ('OPEN', 'MATCHED', 'RESOLVED', 'CLOSED', 'CANCELLED')) NOT VALID;
    END IF;
END;
$$;

ALTER TABLE cases
    VALIDATE CONSTRAINT cases_status_allowed;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'offers_status_allowed'
          AND conrelid = 'offers'::regclass
    ) THEN
        ALTER TABLE offers
            ADD CONSTRAINT offers_status_allowed
            CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN')) NOT VALID;
    END IF;
END;
$$;

ALTER TABLE offers
    VALIDATE CONSTRAINT offers_status_allowed;

-- 新設テーブルはサーバーAPI(service_role)経由のみで扱う。
-- anon/authenticated向けpolicyは意図的に作らない。
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

COMMIT;
