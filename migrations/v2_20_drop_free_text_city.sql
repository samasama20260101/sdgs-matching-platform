-- ============================================================================
-- v2_20_drop_free_text_city.sql(#173、2026-11-27)
-- 目的: 自由入力の市区町村(users.city・cases.city)を消す。v2_19 で団体コード(municipality_code)に移したあと、
--   新しい画面(市区町村を一覧から選ぶ)を出してから流す。番地まで書かれていても残さない(「住所は持たない」)。
--   退会の関数 withdraw_person を新しい列に合わせ、相談に写した市区町村も消す。
-- 実行場所: v2_19 のあと、#173 の画面を出してから。Staging で確かめてから本番(本番は v2 の画面に切り替えるときに続けて流す)。
--   何度流しても同じ結果になる。
-- 戻し方: ALTER TABLE users ADD COLUMN city text; ALTER TABLE cases ADD COLUMN city text; v2_04 の withdraw_person を流し直す
--   (消した自由入力の値は戻らない。v2_19 で団体コードに移せたものは municipalities の name で埋め直せる)
-- ============================================================================

BEGIN;

ALTER TABLE users DROP COLUMN IF EXISTS city;
ALTER TABLE cases DROP COLUMN IF EXISTS city;

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

  -- 相談に写した市区町村も消す(相談とやりとりは支え手の側の記録として残すが、どこに住んでいた人かは残さない。#173)
  UPDATE cases SET municipality_code = NULL WHERE owner_user_id = p_user_id AND municipality_code IS NOT NULL;

  UPDATE offers
  SET status = 'DECLINED', declined_at = now(), updated_at = now()
  WHERE status IN ('PENDING', 'INVITED')
    AND case_id IN (SELECT id FROM cases WHERE owner_user_id = p_user_id);

  UPDATE users
  SET display_name = '退会した人',
      age_years = NULL, age_base_date = NULL,
      region_code = NULL, municipality_code = NULL,
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

REVOKE ALL ON FUNCTION withdraw_person(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION withdraw_person(uuid) TO service_role;

COMMIT;
