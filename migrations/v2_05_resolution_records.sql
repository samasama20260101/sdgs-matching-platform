-- ============================================================================
-- v2_05_resolution_records.sql(v2.0 #72)
-- 目的: 解決した相談の社会貢献の記録を DB の関数1つで付ける(どの経路で解決しても同じ。v1 の「自動で解決になった
--       相談にはバッジが付かない」課題の手当て)。
--   record_case_resolution(case_id):
--     - 関わった人 = 選ばれた申し出の個人の支え手 / 団体の申し出を出した人と、その団体としてやりとりに書いた人
--     - 点 = 運営が確定した指標の数 × 相談の対象の人数(11/5 定例。src/lib/domain/score.ts と同じ式)
--     - まだ記録がなければ RESOLVED の行を、すでにあって点が変わっていれば CORRECTION の差分の行を足す(追記だけ)
--     - 何度呼んでも同じ結果(運営が指標を確定・取り消したあとに呼び直す)
-- 実行場所: v2_04 のあと。Staging で確かめてから本番。
-- 戻し方: DROP FUNCTION record_case_resolution(uuid);
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

    IF NOT has_resolved THEN
      INSERT INTO contributions (user_id, organization_id, case_id, kind, indicator_codes, population, points)
      VALUES (participant.user_id, participant.organization_id, p_case_id, 'RESOLVED', codes, GREATEST(target_case.affected_population, 1), target_points);
      inserted := inserted + 1;
    ELSIF existing_points <> target_points THEN
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
