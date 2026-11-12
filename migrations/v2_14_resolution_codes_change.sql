-- ============================================================================
-- v2_14_resolution_codes_change.sql(v2.0 #72)
-- 目的: 解決の記録(record_case_resolution)で、運営が指標を入れ替えて点が同じになったときも訂正の行を足す。
--   11/12 の定例で、記録の見せ方を「指標の数 × 人口」のスコアから、指標ごとの解決した相談の数(m)に変えた。
--   これまでは点の増減だけで訂正の行を足していたので、指標を1つ入れ替えただけ(数は同じ)だと、
--   その人の記録の指標が古いまま残っていた。指標の組が変わったときも訂正の行を足す。
--   ほかの動き(関わった人の決め方・点の計算・追記だけ)は v2_05 と同じ。
-- 実行場所: Staging(v2_13 のあと)。本番は v2_01〜13 と一緒に流す。何度流しても同じ結果。
-- 影響: 関数を置き換えるだけ。すでにある記録は変えない(次に運営が指標を確定し直したときから効く)。
-- 戻し方: migrations/v2_05_resolution_records.sql の CREATE OR REPLACE FUNCTION をもう一度流す。
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION record_case_resolution(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_case cases%ROWTYPE;
  codes text[];
  target_points bigint;
  participant record;
  existing_points bigint;
  latest_codes text[];
  has_resolved boolean;
  inserted integer := 0;
BEGIN
  SELECT * INTO target_case FROM cases WHERE id = p_case_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND');
  END IF;
  IF target_case.status <> 'RESOLVED' THEN
    RETURN jsonb_build_object('error', 'NOT_RESOLVED');
  END IF;

  SELECT COALESCE(array_agg(DISTINCT indicator_code ORDER BY indicator_code), '{}')
  INTO codes
  FROM case_indicators
  WHERE case_id = p_case_id AND status = 'CONFIRMED';

  target_points := COALESCE(cardinality(codes), 0) * GREATEST(target_case.affected_population, 1);

  FOR participant IN
    -- 同じ人が2つの立場で関わっていても1人として数える(団体の立場を優先)
    SELECT DISTINCT ON (p.user_id) p.user_id, p.organization_id
    FROM (
      -- 個人の支え手
      SELECT o.supporter_user_id AS user_id, NULL::uuid AS organization_id
      FROM offers o
      WHERE o.case_id = p_case_id AND o.status = 'ACCEPTED' AND o.supporter_kind = 'INDIVIDUAL'
      UNION
      -- 団体: 申し出を出した人
      SELECT COALESCE(o.created_by_user_id, o.supporter_user_id), o.supporter_organization_id
      FROM offers o
      WHERE o.case_id = p_case_id AND o.status = 'ACCEPTED' AND o.supporter_kind = 'ORGANIZATION'
      UNION
      -- 団体: その団体としてやりとりに書いた人
      SELECT m.sender_user_id, m.sender_organization_id
      FROM messages m
      JOIN offers o ON o.case_id = m.case_id AND o.supporter_organization_id = m.sender_organization_id AND o.status = 'ACCEPTED'
      WHERE m.case_id = p_case_id AND m.message_type = 'USER' AND m.sender_organization_id IS NOT NULL
    ) p
    WHERE p.user_id IS NOT NULL
    ORDER BY p.user_id, p.organization_id NULLS LAST
  LOOP
    -- 退会した人には付けない
    CONTINUE WHEN EXISTS (SELECT 1 FROM users u WHERE u.id = participant.user_id AND u.withdrawn_at IS NOT NULL);

    SELECT EXISTS (
      SELECT 1 FROM contributions c WHERE c.user_id = participant.user_id AND c.case_id = p_case_id AND c.kind = 'RESOLVED'
    ), COALESCE((
      SELECT sum(c.points) FROM contributions c
      WHERE c.user_id = participant.user_id AND c.case_id = p_case_id AND c.kind IN ('RESOLVED', 'CORRECTION')
    ), 0)
    INTO has_resolved, existing_points;

    -- その人のこの相談の最新の指標(解決・訂正の行のうち、いちばん新しいもの)
    SELECT c.indicator_codes INTO latest_codes
    FROM contributions c
    WHERE c.user_id = participant.user_id AND c.case_id = p_case_id AND c.kind IN ('RESOLVED', 'CORRECTION')
    ORDER BY c.created_at DESC
    LIMIT 1;

    IF NOT has_resolved THEN
      INSERT INTO contributions (user_id, organization_id, case_id, kind, indicator_codes, population, points)
      VALUES (participant.user_id, participant.organization_id, p_case_id, 'RESOLVED', codes, GREATEST(target_case.affected_population, 1), target_points);
      inserted := inserted + 1;
    -- 点が同じでも、指標が入れ替わったら訂正の行を足す(画面は指標ごとの数を最新の行で数える。11/12)
    ELSIF existing_points <> target_points OR latest_codes IS DISTINCT FROM codes THEN
      INSERT INTO contributions (user_id, organization_id, case_id, kind, indicator_codes, population, points, note)
      VALUES (participant.user_id, participant.organization_id, p_case_id, 'CORRECTION', codes, GREATEST(target_case.affected_population, 1),
              target_points - existing_points, '運営が指標を確かめ直した');
      inserted := inserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'rows', inserted, 'points', target_points, 'indicators', codes);
END;
$$;

REVOKE ALL ON FUNCTION record_case_resolution(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_case_resolution(uuid) TO service_role;

COMMIT;
