-- ============================================================================
-- v2_08_case_last_messages.sql(v2.0 #72)
-- 目的: 相談ごとの最後のメッセージを 1 回で取る関数(やりとりの一覧とホームの「あなたの番」。画面の見直し 所見 2・7)。
--   in と order と limit で取ると、メッセージの多い相談がほかの相談の最後のメッセージを押し出すため、DISTINCT ON で取る。
--   運営の知らせ(message_type = 'SYSTEM')は数えない。呼ぶのはサーバーの service_role だけ。
-- 実行場所: Staging(v2_07 のあと)。本番は v2_01〜07 と一緒に流す。何度流しても同じ結果。
-- 影響: 関数を足すだけ。表は変えない(索引は v2_02 の idx_messages_case_created を使う)。
-- 戻し方: DROP FUNCTION IF EXISTS case_last_messages(uuid[]);
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION case_last_messages(p_case_ids uuid[])
RETURNS TABLE (
  case_id uuid,
  content text,
  created_at timestamptz,
  sender_role_snapshot text,
  sender_display_name_snapshot text,
  sender_organization_name_snapshot text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ON (m.case_id)
    m.case_id, m.content, m.created_at, m.sender_role_snapshot, m.sender_display_name_snapshot, m.sender_organization_name_snapshot
  FROM messages m
  WHERE m.case_id = ANY (p_case_ids)
    AND m.message_type = 'USER'
  ORDER BY m.case_id, m.created_at DESC
$$;

REVOKE ALL ON FUNCTION case_last_messages(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION case_last_messages(uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION case_last_messages(uuid[]) TO service_role;

COMMIT;
