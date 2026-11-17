-- ============================================================================
-- v2_15_consult_organizations_not_vetted.sql(v2.0 #72・#131)
-- 目的: 会社・地域として相談するために登録した団体(相談のための団体、application.purpose = CONSULT)を、
--   支え手の審査から分ける(2026-11-17 代表了承)。相談するのに承認は要らないので、相談のための団体は審査の列に並べず、
--   支える側にも出さない。その団体で支えるときは、管理の人が支え手の申し込み(同意と6つの自己採点)をしてから審査に並ぶ。
--   - 審査の状態に「支え手の申し込み前」(NOT_APPLIED)を足す
--   - 相談のための団体の 申し込み・面談の調整中・承認済み を NOT_APPLIED に戻し、承認の記録と相談の受け付けを外す
--   - 相談のための団体の 見送り は 停止 にする(団体として相談できないようにした効果を保つ。新しい決まりでは、
--     見送りは支え手の申し込みを断ったという意味だけになり、相談は止めない)
--   - 相談のための団体のコーディネーターの範囲を外す(コーディネーターは支える側の役割)
--   - 決まり: 相談のための団体は NOT_APPLIED か SUSPENDED だけ、支え手の団体は NOT_APPLIED にならない
-- 実行場所: Staging(v2_14 のあと)。本番は v2_01〜14 と一緒に流す。本番は v1 の形で相談のための団体がないので、
--   動く行はなく、決まりが増えるだけ。何度流しても同じ結果。
-- 影響: Staging の相談のための団体は、支える側の顔・申し出・共同支援・代理の登録が使えなくなる(支え手の申し込みをして
--   承認されると戻る)。その団体が出していた申し出の行は消さない。
-- 戻し方: 決まりを外し、状態の一覧を v2_01 に戻す(NOT_APPLIED の行を先に APPLIED にする)。
--   ALTER TABLE organizations DROP CONSTRAINT organizations_vetting_matches_purpose;
--   UPDATE organizations SET vetting_status = 'APPLIED' WHERE vetting_status = 'NOT_APPLIED';
--   ALTER TABLE organizations DROP CONSTRAINT organizations_vetting_status_check;
--   ALTER TABLE organizations ADD CONSTRAINT organizations_vetting_status_check CHECK (vetting_status IN ('APPLIED','INTERVIEW','APPROVED','REJECTED','SUSPENDED'));
--   (どの団体を戻したかは audit_logs の organization.consult_unvetted に残る)
-- ============================================================================

BEGIN;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_vetting_status_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_vetting_status_check
  CHECK (vetting_status IN ('NOT_APPLIED', 'APPLIED', 'INTERVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'));

-- どの団体をどう戻したかを残す(戻すとき・問い合わせのときに引ける)
INSERT INTO audit_logs (actor_user_id, organization_id, action, target_table, target_id, metadata)
SELECT NULL, o.id, 'organization.consult_unvetted', 'organizations', o.id,
       jsonb_build_object('from', o.vetting_status,
                          'to', CASE WHEN o.vetting_status = 'REJECTED' THEN 'SUSPENDED' ELSE 'NOT_APPLIED' END,
                          'approved_at', o.approved_at, 'migration', 'v2_15')
FROM organizations o
WHERE o.application->>'purpose' = 'CONSULT'
  AND o.vetting_status IN ('APPLIED', 'INTERVIEW', 'APPROVED', 'REJECTED');

UPDATE organizations
SET vetting_status = 'NOT_APPLIED', applied_at = NULL, approved_at = NULL, approved_by_user_id = NULL, reception_status = 'UNAVAILABLE'
WHERE application->>'purpose' = 'CONSULT'
  AND vetting_status IN ('APPLIED', 'INTERVIEW', 'APPROVED');

UPDATE organizations
SET vetting_status = 'SUSPENDED', reception_status = 'UNAVAILABLE'
WHERE application->>'purpose' = 'CONSULT'
  AND vetting_status = 'REJECTED';

DELETE FROM coordinator_scopes c
USING organizations o
WHERE o.id = c.organization_id AND o.application->>'purpose' = 'CONSULT';

-- 用途と審査の状態を合わせる。v1 から移った団体は application を持たない(支え手の団体)
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_vetting_matches_purpose;
ALTER TABLE organizations ADD CONSTRAINT organizations_vetting_matches_purpose CHECK (
  CASE WHEN application->>'purpose' = 'CONSULT'
    THEN vetting_status IN ('NOT_APPLIED', 'SUSPENDED')
    ELSE vetting_status <> 'NOT_APPLIED'
  END
);

COMMIT;
