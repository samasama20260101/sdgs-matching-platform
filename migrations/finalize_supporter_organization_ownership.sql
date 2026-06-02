-- ============================================================
-- サポーター団体DB刷新: 団体IDを正本として必須化
-- 実行場所: Supabase Dashboard -> SQL Editor (Staging first)
--
-- 方針:
-- - 申し出、評価、活動地域は organizations.id を正本とする
-- - supporter_user_id は当時の担当者を追跡する監査情報として保持する
-- - 補完できない孤立レコードがあれば VALIDATE で停止し、履歴を勝手に削除しない
-- ============================================================

BEGIN;

-- 活動地域: 登録担当者の所属団体から補完する。
UPDATE supporter_service_areas ssa
SET organization_id = (
    SELECT om.organization_id
    FROM organization_memberships om
    WHERE om.user_id = ssa.supporter_user_id
    ORDER BY
        CASE om.status
            WHEN 'ACTIVE' THEN 1
            WHEN 'SUSPENDED' THEN 2
            WHEN 'LEFT' THEN 3
            ELSE 4
        END,
        om.created_at DESC
    LIMIT 1
)
WHERE ssa.organization_id IS NULL
  AND EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.user_id = ssa.supporter_user_id
  );

-- 申し出: 申し出を作成した担当者の所属団体から補完する。
UPDATE offers o
SET supporter_organization_id = (
    SELECT om.organization_id
    FROM organization_memberships om
    WHERE om.user_id = o.supporter_user_id
    ORDER BY
        CASE om.status
            WHEN 'ACTIVE' THEN 1
            WHEN 'SUSPENDED' THEN 2
            WHEN 'LEFT' THEN 3
            ELSE 4
        END,
        om.created_at DESC
    LIMIT 1
)
WHERE o.supporter_organization_id IS NULL
  AND EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.user_id = o.supporter_user_id
  );

-- 評価: まず案件の申し出から補完し、残りは担当者の所属団体から補完する。
UPDATE supporter_badges sb
SET supporter_organization_id = o.supporter_organization_id
FROM offers o
WHERE sb.supporter_organization_id IS NULL
  AND o.case_id = sb.case_id
  AND o.supporter_user_id = sb.supporter_user_id
  AND o.supporter_organization_id IS NOT NULL;

UPDATE supporter_badges sb
SET supporter_organization_id = (
    SELECT om.organization_id
    FROM organization_memberships om
    WHERE om.user_id = sb.supporter_user_id
    ORDER BY
        CASE om.status
            WHEN 'ACTIVE' THEN 1
            WHEN 'SUSPENDED' THEN 2
            WHEN 'LEFT' THEN 3
            ELSE 4
        END,
        om.created_at DESC
    LIMIT 1
)
WHERE sb.supporter_organization_id IS NULL
  AND EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.user_id = sb.supporter_user_id
  );

-- 同一団体の複数担当者に同じ評価が付いていた場合は1件へまとめる。
DELETE FROM supporter_badges newer
USING supporter_badges older
WHERE newer.supporter_organization_id = older.supporter_organization_id
  AND newer.case_id = older.case_id
  AND newer.badge_key = older.badge_key
  AND newer.ctid > older.ctid;

-- 以降は団体IDなしのレコードを作らせない。
ALTER TABLE supporter_service_areas
    ADD CONSTRAINT supporter_service_areas_organization_required
    CHECK (organization_id IS NOT NULL) NOT VALID;
ALTER TABLE offers
    ADD CONSTRAINT offers_supporter_organization_required
    CHECK (supporter_organization_id IS NOT NULL) NOT VALID;
ALTER TABLE supporter_badges
    ADD CONSTRAINT supporter_badges_organization_required
    CHECK (supporter_organization_id IS NOT NULL) NOT VALID;

ALTER TABLE supporter_service_areas
    VALIDATE CONSTRAINT supporter_service_areas_organization_required;
ALTER TABLE offers
    VALIDATE CONSTRAINT offers_supporter_organization_required;
ALTER TABLE supporter_badges
    VALIDATE CONSTRAINT supporter_badges_organization_required;

ALTER TABLE supporter_service_areas
    ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE offers
    ALTER COLUMN supporter_organization_id SET NOT NULL;
ALTER TABLE supporter_badges
    ALTER COLUMN supporter_organization_id SET NOT NULL;

ALTER TABLE supporter_badges
    ADD CONSTRAINT supporter_badges_organization_unique
    UNIQUE (case_id, supporter_organization_id, badge_key);

COMMIT;
