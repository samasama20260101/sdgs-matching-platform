-- ============================================================
-- サポーター団体DB刷新: 団体・所属メンバー基盤
-- 実行場所: Supabase Dashboard → SQL Editor
--
-- 方針:
-- - organizations = サポーター団体
-- - users = ログインする個人
-- - organization_memberships = 個人が団体に所属する関係
-- - SOSに見せる主体は団体、操作履歴は個人として残す
--
-- 注意:
-- - このSQLは既存のSOS / cases / messagesを消さない
-- - Production適用前に必ず対象 project ref とバックアップを確認する
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL,
    supporter_type      text,
    bio                 text,
    public_email        text,
    phone               text,
    postal_code         text,
    prefecture          text,
    city                text,
    address_structured  jsonb,
    social_links        jsonb,
    reception_status    text NOT NULL DEFAULT 'CONSULT'
        CHECK (reception_status IN ('ACCEPTING', 'CONSULT', 'UNAVAILABLE')),
    status              text NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'PAUSED', 'ARCHIVED')),
    is_featured         boolean NOT NULL DEFAULT false,
    featured_order      integer NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_organizations_updated_at ON organizations;
CREATE TRIGGER set_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_organizations_updated_at();

CREATE TABLE IF NOT EXISTS organization_memberships (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                text NOT NULL DEFAULT 'MEMBER'
        CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
    status              text NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'LEFT')),
    invited_by_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
    joined_at           timestamptz,
    left_at             timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_organization_memberships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    IF NEW.status = 'ACTIVE' AND NEW.joined_at IS NULL THEN
        NEW.joined_at = now();
    END IF;
    IF NEW.status = 'LEFT' AND NEW.left_at IS NULL THEN
        NEW.left_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_organization_memberships_updated_at ON organization_memberships;
CREATE TRIGGER set_organization_memberships_updated_at
    BEFORE INSERT OR UPDATE ON organization_memberships
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_memberships_updated_at();

CREATE TABLE IF NOT EXISTS organization_invitations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email               text NOT NULL,
    role                text NOT NULL DEFAULT 'MEMBER'
        CHECK (role IN ('ADMIN', 'MEMBER')),
    token_hash          text UNIQUE,
    status              text NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED')),
    invited_by_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
    accepted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    expires_at          timestamptz,
    accepted_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_organization_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_organization_invitations_updated_at ON organization_invitations;
CREATE TRIGGER set_organization_invitations_updated_at
    BEFORE UPDATE ON organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_invitations_updated_at();

-- 既存環境では適用済み想定だが、団体公開設定の互換のため念のため補完する。
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS featured_order integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_legacy_supporter boolean NOT NULL DEFAULT false;

ALTER TABLE supporter_service_areas
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE offers
    ADD COLUMN IF NOT EXISTS supporter_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS accepted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS declined_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE supporter_badges
    ADD COLUMN IF NOT EXISTS supporter_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS given_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS sender_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sender_display_name_snapshot text,
    ADD COLUMN IF NOT EXISTS sender_role_snapshot text,
    ADD COLUMN IF NOT EXISTS sender_organization_name_snapshot text;

CREATE TABLE IF NOT EXISTS audit_logs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
    organization_id     uuid REFERENCES organizations(id) ON DELETE SET NULL,
    action              text NOT NULL,
    target_table        text,
    target_id           uuid,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- 既存サポーターは一旦「既存団体」として移行できる形にする。
-- 本番ではサポーター再登録前提だが、Dev検証と安全な段階移行のため削除はしない。
DO $$
DECLARE
    supporter_record RECORD;
    created_organization_id uuid;
BEGIN
    FOR supporter_record IN
        SELECT *
        FROM users u
        WHERE u.role = 'SUPPORTER'
          AND NOT EXISTS (
              SELECT 1
              FROM organization_memberships om
              WHERE om.user_id = u.id
                AND om.status IN ('INVITED', 'ACTIVE', 'SUSPENDED')
          )
        ORDER BY u.created_at ASC
    LOOP
        INSERT INTO organizations (
            name,
            supporter_type,
            bio,
            phone,
            postal_code,
            prefecture,
            city,
            address_structured,
            social_links,
            is_featured,
            featured_order
        )
        VALUES (
            COALESCE(NULLIF(supporter_record.organization_name, ''), supporter_record.display_name, supporter_record.real_name, '未設定の団体'),
            supporter_record.supporter_type,
            supporter_record.bio,
            supporter_record.phone,
            supporter_record.postal_code,
            supporter_record.prefecture,
            supporter_record.city,
            supporter_record.address_structured,
            supporter_record.social_links,
            COALESCE(supporter_record.is_featured, false),
            COALESCE(supporter_record.featured_order, 0)
        )
        RETURNING id INTO created_organization_id;

        INSERT INTO organization_memberships (
            organization_id,
            user_id,
            role,
            status,
            joined_at
        )
        VALUES (
            created_organization_id,
            supporter_record.id,
            'OWNER',
            'ACTIVE',
            COALESCE(supporter_record.created_at, now())
        );
    END LOOP;
END;
$$;

UPDATE supporter_service_areas ssa
SET organization_id = om.organization_id
FROM organization_memberships om
WHERE ssa.supporter_user_id = om.user_id
  AND ssa.organization_id IS NULL
  AND om.status = 'ACTIVE';

UPDATE offers o
SET
    supporter_organization_id = om.organization_id,
    created_by_user_id = COALESCE(o.created_by_user_id, o.supporter_user_id)
FROM organization_memberships om
WHERE o.supporter_user_id = om.user_id
  AND o.supporter_organization_id IS NULL
  AND om.status = 'ACTIVE';

UPDATE supporter_badges sb
SET supporter_organization_id = om.organization_id
FROM organization_memberships om
WHERE sb.supporter_user_id = om.user_id
  AND sb.supporter_organization_id IS NULL
  AND om.status = 'ACTIVE';

UPDATE messages m
SET
    sender_display_name_snapshot = COALESCE(m.sender_display_name_snapshot, u.display_name, u.real_name, '不明'),
    sender_role_snapshot = COALESCE(m.sender_role_snapshot, u.role),
    sender_organization_name_snapshot = COALESCE(m.sender_organization_name_snapshot, u.organization_name)
FROM users u
WHERE m.sender_user_id = u.id;

UPDATE messages m
SET sender_organization_id = om.organization_id
FROM organization_memberships om
WHERE m.sender_user_id = om.user_id
  AND m.sender_organization_id IS NULL
  AND om.status = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_memberships_current_unique
    ON organization_memberships(organization_id, user_id)
    WHERE status IN ('INVITED', 'ACTIVE', 'SUSPENDED');
CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_status
    ON organization_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_org_status
    ON organization_memberships(organization_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_invitations_pending_email
    ON organization_invitations(organization_id, lower(email))
    WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_organizations_status
    ON organizations(status, reception_status);
CREATE INDEX IF NOT EXISTS idx_organizations_featured
    ON organizations(is_featured, featured_order)
    WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_supporter_service_areas_organization_id
    ON supporter_service_areas(organization_id);
CREATE INDEX IF NOT EXISTS idx_offers_supporter_organization_id
    ON offers(supporter_organization_id);
CREATE INDEX IF NOT EXISTS idx_offers_created_by_user_id
    ON offers(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_supporter_badges_supporter_organization_id
    ON supporter_badges(supporter_organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_organization_id
    ON messages(sender_organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
    ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_created
    ON audit_logs(organization_id, created_at DESC);
