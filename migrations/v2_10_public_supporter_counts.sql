-- ============================================================================
-- v2_10_public_supporter_counts.sql(v2.0 #72)
-- 目的: 公開の団体一覧の「解決した相談」と「ありがとう」を DB の中で数える関数(性能のレビュー 11/5)。
--   これまでは申し出とありがとうの行を全部運んで JS で数えていたので、行が増えると遅くなり、
--   API の 1 回の上限(max_rows = 1000)を超えると黙って少なく出ていた。
--   あわせて「解決した相談」を、選ばれた(ACCEPTED)申し出の数から、解決した(RESOLVED)相談の数に直す
--   (支援中の相談まで「解決」に数えていた)。
--   - public_supporter_counts(p_org_ids): 団体ごとの resolved_cases(解決した相談の数)と thanks(ありがとうの言葉の数)
--   呼ぶのはサーバーの service_role だけ。
-- 実行場所: Staging(v2_09 のあと)。本番は v2_01〜09 と一緒に流す。何度流しても同じ結果。
-- 影響: 関数を足すだけ。表は変えない。
-- 戻し方: DROP FUNCTION IF EXISTS public_supporter_counts(uuid[]);
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public_supporter_counts(p_org_ids uuid[])
RETURNS TABLE (organization_id uuid, resolved_cases bigint, thanks bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    o.id,
    (
      SELECT count(DISTINCT f.case_id)
      FROM offers f
      JOIN cases c ON c.id = f.case_id
      WHERE f.supporter_organization_id = o.id AND f.status = 'ACCEPTED' AND c.status = 'RESOLVED'
    ),
    (SELECT count(*) FROM supporter_badges b WHERE b.supporter_organization_id = o.id)
  FROM unnest(p_org_ids) AS o(id)
$$;

REVOKE ALL ON FUNCTION public_supporter_counts(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public_supporter_counts(uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public_supporter_counts(uuid[]) TO service_role;

COMMIT;
