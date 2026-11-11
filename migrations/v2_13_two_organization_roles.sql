-- ============================================================================
-- v2_13_two_organization_roles.sql(v2.0 #72)
-- 目的: 団体の中の役割を「管理(OWNER)」と「メンバー(MEMBER)」の2つにする(2026-11-11 岡本さん)。
--   これまでの「追加(ADMIN)」は v1 の 2026-05 に入った役割で、v2 でできるのはメンバーを招くことだけだった。
--   代表が Staging で「担当と追加の違いが分からない」と書いたのをきっかけに、2つで足りると決めた。
--   - organization_memberships: ADMIN の人は OWNER にする(v1 の ADMIN はメンバーを管理できたので、近い方に寄せる)
--   - organization_invitations: ADMIN で招いた招待(返事待ち・済みとも)を OWNER にする
--   - 2つの表の役割の決まりを OWNER と MEMBER だけにする
-- 実行場所: Staging(v2_12 のあと)。本番は v2_01〜12 と一緒に流す。何度流しても同じ結果。
-- 影響: ADMIN だった人が OWNER になり、団体の紹介・活動地域の編集と、メンバーの役割の変更・外すことができるようになる。
-- 戻し方: 決まりを3つに戻すだけ(OWNER にした人は OWNER のまま。誰を移したかは audit_logs の organization.role_merged に残る)。
--   ALTER TABLE organization_memberships DROP CONSTRAINT organization_memberships_role_check;
--   ALTER TABLE organization_memberships ADD CONSTRAINT organization_memberships_role_check CHECK (role = ANY (ARRAY['OWNER','ADMIN','MEMBER']));
--   ALTER TABLE organization_invitations DROP CONSTRAINT organization_invitations_role_check;
--   ALTER TABLE organization_invitations ADD CONSTRAINT organization_invitations_role_check CHECK (role = ANY (ARRAY['ADMIN','MEMBER']));
-- ============================================================================

BEGIN;

-- 誰を移したかを残す(戻すとき・問い合わせのときに引ける)
INSERT INTO audit_logs (actor_user_id, organization_id, action, target_table, target_id, metadata)
SELECT NULL, m.organization_id, 'organization.role_merged', 'organization_memberships', m.id,
       jsonb_build_object('from', 'ADMIN', 'to', 'OWNER', 'migration', 'v2_13')
FROM organization_memberships m
WHERE m.role = 'ADMIN';

UPDATE organization_memberships SET role = 'OWNER' WHERE role = 'ADMIN';
UPDATE organization_invitations SET role = 'OWNER' WHERE role = 'ADMIN';

ALTER TABLE organization_memberships DROP CONSTRAINT IF EXISTS organization_memberships_role_check;
ALTER TABLE organization_memberships ADD CONSTRAINT organization_memberships_role_check CHECK (role = ANY (ARRAY['OWNER', 'MEMBER']));

ALTER TABLE organization_invitations DROP CONSTRAINT IF EXISTS organization_invitations_role_check;
ALTER TABLE organization_invitations ADD CONSTRAINT organization_invitations_role_check CHECK (role = ANY (ARRAY['OWNER', 'MEMBER']));

COMMIT;
