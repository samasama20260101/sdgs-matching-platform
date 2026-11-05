-- ============================================================================
-- v2_04_withdrawal.sql(v2.0 #72)
-- 目的: 退会を1つのトランザクションで行う DB 関数 withdraw_person。
--   - 社会貢献の記録をすべて消す(10/30 決定 C。団体の「その時の所属」の分も消える)
--   - 個人の支え手の登録・通知の設定・端末の登録を消す
--   - 団体の所属を「抜けた」にする(最後の管理者なら断る。既存の trigger が止める)
--   - 受付中・支援中の自分の相談を取り消しにする(相談とやりとりは消さない。支え手の側の記録のため)
--   - users の行は残し、呼び名を伏せ、年齢・地域・v1 の個人情報の列を空にする。withdrawn_at を付けてログインさせない
--   Auth のアカウント(メール)の削除は API が続けて行う(auth.admin.deleteUser)
-- 実行場所: v2_03 のあと。Staging で確かめてから本番。何度流しても同じ結果になる。
-- 戻し方: DROP FUNCTION withdraw_person(uuid); ALTER TABLE users DROP COLUMN withdrawn_at;
-- ============================================================================

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;

CREATE OR REPLACE FUNCTION withdraw_person(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target users%ROWTYPE;
  cancelled_count integer;
BEGIN
  SELECT * INTO target FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND');
  END IF;
  IF target.role <> 'PERSON' THEN
    RETURN jsonb_build_object('error', 'NOT_PERSON');
  END IF;
  IF target.withdrawn_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  -- 最後の管理者として残っている団体があれば、先に別の人を管理者にしてもらう
  IF EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.user_id = p_user_id AND m.role = 'OWNER' AND m.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM organization_memberships o
        WHERE o.organization_id = m.organization_id AND o.user_id <> p_user_id
          AND o.role = 'OWNER' AND o.status = 'ACTIVE'
      )
  ) THEN
    RETURN jsonb_build_object('error', 'LAST_OWNER');
  END IF;

  DELETE FROM contributions WHERE user_id = p_user_id;
  DELETE FROM supporter_profiles WHERE user_id = p_user_id;
  DELETE FROM notification_prefs WHERE user_id = p_user_id;
  DELETE FROM push_subscriptions WHERE user_id = p_user_id;

  UPDATE organization_memberships
  SET status = 'LEFT', left_at = now()
  WHERE user_id = p_user_id AND status IN ('INVITED', 'ACTIVE', 'SUSPENDED');

  UPDATE cases
  SET status = 'CANCELLED', updated_at = now()
  WHERE owner_user_id = p_user_id AND status IN ('OPEN', 'MATCHED');
  GET DIAGNOSTICS cancelled_count = ROW_COUNT;

  UPDATE offers
  SET status = 'DECLINED', declined_at = now(), updated_at = now()
  WHERE status IN ('PENDING', 'INVITED')
    AND case_id IN (SELECT id FROM cases WHERE owner_user_id = p_user_id);

  UPDATE users
  SET display_name = '退会した人',
      age_years = NULL, age_base_date = NULL,
      region_code = NULL, city = NULL,
      real_name = NULL, email = NULL, phone = NULL,
      postal_code = NULL, prefecture = NULL, address_structured = NULL,
      gender = NULL, birth_date = NULL, bio = NULL, social_links = NULL,
      sos_region_code = NULL,
      is_suspended = true,
      withdrawn_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'cancelled_cases', cancelled_count);
END;
$$;

REVOKE ALL ON FUNCTION withdraw_person(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION withdraw_person(uuid) TO service_role;

COMMIT;
