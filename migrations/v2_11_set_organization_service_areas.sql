-- ============================================================================
-- v2_11_set_organization_service_areas.sql(v2.0 #72)
-- 目的: 団体の活動地域を、団体の画面から入れ替えられるようにする(11/6)。
--   消してから入れ直すのを 1 つの関数(= 1 つのトランザクション)で行い、途中で失敗しても半端な状態を残さない
--   (v1 では API で消してから入れ直していて、途中で失敗すると地域が消えた)。
--   - set_organization_service_areas(p_org_id, p_user_id, p_country, p_nationwide, p_region_codes)
--     全国なら全国の 1 行、そうでなければ地域ごとに 1 行。supporter_user_id には変えた人を入れる(v1 の列。NOT NULL)
--   呼ぶのはサーバーの service_role だけ。地域がその国のものかと、変えてよい人かは API で確かめる。
-- 実行場所: Staging(v2_10 のあと)。本番は v2_01〜10 と一緒に流す。何度流しても同じ結果。
-- 影響: 関数を足すだけ。表は変えない。
-- 戻し方: DROP FUNCTION IF EXISTS set_organization_service_areas(uuid, uuid, text, boolean, text[]);
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION set_organization_service_areas(
  p_org_id uuid,
  p_user_id uuid,
  p_country text,
  p_nationwide boolean,
  p_region_codes text[]
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT p_nationwide AND coalesce(cardinality(p_region_codes), 0) = 0 THEN
    RAISE EXCEPTION 'service areas need nationwide or at least one region';
  END IF;

  DELETE FROM supporter_service_areas WHERE organization_id = p_org_id;

  IF p_nationwide THEN
    INSERT INTO supporter_service_areas (supporter_user_id, organization_id, country, is_nationwide, region_code)
    VALUES (p_user_id, p_org_id, p_country, true, NULL);
  ELSE
    INSERT INTO supporter_service_areas (supporter_user_id, organization_id, country, is_nationwide, region_code)
    SELECT p_user_id, p_org_id, p_country, false, code
    FROM (SELECT DISTINCT unnest(p_region_codes) AS code) AS picked;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION set_organization_service_areas(uuid, uuid, text, boolean, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_organization_service_areas(uuid, uuid, text, boolean, text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION set_organization_service_areas(uuid, uuid, text, boolean, text[]) TO service_role;

COMMIT;
