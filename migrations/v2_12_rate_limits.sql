-- ============================================================================
-- v2_12_rate_limits.sql(v2.0 #72)
-- 目的: AI を呼ぶ API の回数の上限を DB で数える(11/6)。
--   体験ページ(/trial)でもログインなしで「近いもの」を AI で出すので、費用を抑える上限が要る。
--   これまでの上限はサーバーの入れ物の中だけで数えていたので、Workers では場所ごと・入れ物ごとに別に数えられ、ほとんど効かなかった。
--   - rate_limit_hits: 枠(bucket)× 伏せた鍵(key_hash。IP や人の id を HMAC で伏せたもの)× 時間の区切りごとの回数
--   - hit_rate_limit(p_bucket, p_key_hash, p_window_seconds, p_max): 今の区切りの回数を 1 増やし、上限の内なら true
--   古い行は毎日の自動処理が 2 日で消す。読むのも書くのもサーバーの service_role だけ(RLS を有効にして方針は置かない)
-- 実行場所: Staging(v2_11 のあと)。本番は v2_01〜11 と一緒に流す。何度流しても同じ結果。
-- 影響: 表と関数を足すだけ。
-- 戻し方: DROP FUNCTION IF EXISTS hit_rate_limit(text, text, integer, integer); DROP TABLE IF EXISTS rate_limit_hits;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  bucket text NOT NULL,
  key_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, key_hash, window_start)
);
CREATE INDEX IF NOT EXISTS rate_limit_hits_window_start_idx ON rate_limit_hits (window_start);

ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE rate_limit_hits FROM PUBLIC;
REVOKE ALL ON TABLE rate_limit_hits FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE rate_limit_hits TO service_role;

CREATE OR REPLACE FUNCTION hit_rate_limit(p_bucket text, p_key_hash text, p_window_seconds integer, p_max integer)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_window timestamptz := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
BEGIN
  INSERT INTO rate_limit_hits (bucket, key_hash, window_start, hits)
  VALUES (p_bucket, p_key_hash, v_window, 1)
  ON CONFLICT (bucket, key_hash, window_start) DO UPDATE SET hits = rate_limit_hits.hits + 1
  RETURNING hits INTO v_hits;
  RETURN v_hits <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION hit_rate_limit(text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION hit_rate_limit(text, text, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION hit_rate_limit(text, text, integer, integer) TO service_role;

COMMIT;
