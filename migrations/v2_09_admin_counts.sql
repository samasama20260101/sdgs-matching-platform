-- ============================================================================
-- v2_09_admin_counts.sql(v2.0 #72)
-- 目的: 運営の画面の件数を DB の中で数える関数(性能のレビュー 11/5)。
--   行を運んで JS で数えると、API の 1 回の上限(max_rows = 1000)で黙って切れ、件数が少なく出るため。
--   - admin_cases_with_proposed_indicators(): 確かめ待ちの指標がある相談の数(運営のホームの札)
--   - admin_open_cases_by_indicator(p_limit): 受付中の相談を、相談した人が選んだ指標ごとに数えた上位(運営の分析)
--   呼ぶのはサーバーの service_role だけ。
-- 実行場所: Staging(v2_08 のあと)。本番は v2_01〜08 と一緒に流す。何度流しても同じ結果。
-- 影響: 関数を足すだけ。表は変えない。
-- 戻し方: DROP FUNCTION IF EXISTS admin_cases_with_proposed_indicators(); DROP FUNCTION IF EXISTS admin_open_cases_by_indicator(integer);
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION admin_cases_with_proposed_indicators()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT count(DISTINCT case_id) FROM case_indicators WHERE status = 'PROPOSED'
$$;

CREATE OR REPLACE FUNCTION admin_open_cases_by_indicator(p_limit integer DEFAULT 10)
RETURNS TABLE (indicator_code text, cases bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT code, count(*) AS cases
  FROM cases c
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(c.intake_qna -> 'indicators') = 'array' THEN c.intake_qna -> 'indicators' ELSE '[]'::jsonb END
  ) AS code
  WHERE c.status = 'OPEN'
  GROUP BY code
  ORDER BY count(*) DESC, code
  LIMIT greatest(1, least(p_limit, 100))
$$;

REVOKE ALL ON FUNCTION admin_cases_with_proposed_indicators() FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_cases_with_proposed_indicators() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_cases_with_proposed_indicators() TO service_role;
REVOKE ALL ON FUNCTION admin_open_cases_by_indicator(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_open_cases_by_indicator(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_open_cases_by_indicator(integer) TO service_role;

COMMIT;
