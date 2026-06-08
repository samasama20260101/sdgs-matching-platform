-- ============================================================
-- サポーター団体DB刷新: 所属停止とアカウント停止の分離
-- 実行場所: Supabase Dashboard -> SQL Editor (Staging first)
--
-- 方針:
-- - organization_memberships.status = SUSPENDED は団体内の所属停止。
-- - users.is_suspended は管理者による全体アカウント停止専用。
-- - 過去実装で「所属停止」時に users.is_suspended=true になった
--   サポーターユーザーだけを補正する。
-- - Supabase Auth 側で ban されているユーザーは管理者停止の可能性が
--   高いため補正対象外にする。
-- ============================================================

BEGIN;

UPDATE users u
SET is_suspended = false
FROM auth.users au
WHERE u.auth_user_id = au.id
  AND u.role = 'SUPPORTER'
  AND u.is_suspended = true
  AND (au.banned_until IS NULL OR au.banned_until <= now())
  AND EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.user_id = u.id
        AND om.status = 'SUSPENDED'
  );

COMMIT;
