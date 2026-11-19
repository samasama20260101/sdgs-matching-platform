-- ============================================================
-- v2_18_directory_suggest_retrieval.sql(#148)
-- 支援団体の提案の候補を、全国から「指標の重なりの多い順」と「相談の意味の近い順」で引く
--
-- 背景: 2026-11-19 の定例の「範囲は全国で、優先の高いものから 3 つ」に合わせ、地域で足切りしない。
--       ほかの都道府県の団体は遠隔(電話・オンライン・チャット・メール・フォーム)で相談を受けているものだけ(岡本さん)。
--       また、指標の番号の重なりだけで引くと、相談の分類か団体の指標のどちらかが抜けたときに合う団体を取りこぼすので、
--       団体の相談の受け方の要約(consult_summary)の埋め込みと、相談文(伏せたもの)の埋め込みの近さでも引く。
-- 実行場所: v2_17 のあと。Staging で確かめてから本番。何度流しても同じ結果。
--
-- - pgvector(extensions スキーマ)を有効にする
-- - directory_entries.consult_embedding: 要約の埋め込み(1536 次元)。consult_embedding_model に作ったモデル、
--   consult_embedding_hash に元の文とモデルの指紋を持つ(scripts/embed-directory-entries.mts が、指紋が変わった行だけ作り直す)
--   埋め込みはモデルが替わると比べられないので、検索は保存したベクトルと同じモデルの行だけを見る(p_model)
-- - match_directory_by_indicators / match_directory_by_embedding: どちらも民間の団体・公開中・相談を受けている・まだ結んでいない行で、
--   相談の地域(全国・同じ都道府県)か遠隔の手段で相談を受けている行だけを返す。最終の並べ方は src/lib/domain/suggestions.ts
--   呼ぶのはサーバーの service_role だけ
--
-- ロールバック:
--   DROP FUNCTION IF EXISTS match_directory_by_embedding(extensions.vector, text, text, integer);
--   DROP FUNCTION IF EXISTS match_directory_by_indicators(text[], smallint[], text, integer);
--   DROP INDEX IF EXISTS directory_entries_consult_embedding_idx;
--   ALTER TABLE directory_entries DROP COLUMN IF EXISTS consult_embedding, DROP COLUMN IF EXISTS consult_embedding_model,
--     DROP COLUMN IF EXISTS consult_embedding_hash;
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

ALTER TABLE directory_entries
    ADD COLUMN IF NOT EXISTS consult_embedding extensions.vector(1536),
    ADD COLUMN IF NOT EXISTS consult_embedding_model text,
    ADD COLUMN IF NOT EXISTS consult_embedding_hash text;

CREATE INDEX IF NOT EXISTS directory_entries_consult_embedding_idx
    ON directory_entries USING hnsw (consult_embedding extensions.vector_cosine_ops)
    WHERE consult_embedding IS NOT NULL AND accepts_consultation = 'YES' AND visibility = 'PUBLIC';

-- 相談者が連絡して相談できる行か(相談の地域で受けている、または遠隔の手段で相談を受けている)
CREATE OR REPLACE FUNCTION directory_entry_reachable(e directory_entries, p_region text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT e.service_scope = 'NATIONWIDE'
        OR (p_region IS NOT NULL AND (e.prefecture_code = p_region OR p_region = ANY (e.service_codes)))
        OR e.consult_channels && ARRAY['PHONE', 'ONLINE', 'CHAT', 'EMAIL', 'FORM']::text[]
$$;

CREATE OR REPLACE FUNCTION match_directory_by_indicators(p_indicators text[], p_goals smallint[], p_region text, p_limit integer DEFAULT 60)
RETURNS TABLE (id uuid, indicator_hits integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT e.id, (SELECT count(*)::integer FROM unnest(e.consult_indicators) i WHERE i = ANY (coalesce(p_indicators, '{}'))) AS indicator_hits
    FROM directory_entries e
    WHERE e.kind = 'ORGANIZATION'
      AND e.visibility = 'PUBLIC'
      AND e.accepts_consultation = 'YES'
      AND e.claim_status <> 'CLAIMED'
      -- 指標が重なるか、大項目が重なる(団体の大項目の列か、団体の指標の頭の数字)
      AND (e.consult_indicators && coalesce(p_indicators, '{}')
           OR e.sdgs_goals && coalesce(p_goals, '{}')
           OR EXISTS (SELECT 1 FROM unnest(e.consult_indicators) i WHERE split_part(i, '.', 1) = ANY (coalesce(p_goals, '{}')::text[])))
      AND directory_entry_reachable(e, p_region)
    ORDER BY indicator_hits DESC,
             (e.service_scope = 'NATIONWIDE' OR e.prefecture_code = p_region) DESC,
             e.name
    LIMIT least(greatest(coalesce(p_limit, 60), 1), 200)
$$;

CREATE OR REPLACE FUNCTION match_directory_by_embedding(p_embedding extensions.vector, p_model text, p_region text, p_limit integer DEFAULT 40)
RETURNS TABLE (id uuid, similarity double precision)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
    SELECT e.id, 1 - (e.consult_embedding <=> p_embedding) AS similarity
    FROM directory_entries e
    WHERE e.kind = 'ORGANIZATION'
      AND e.visibility = 'PUBLIC'
      AND e.accepts_consultation = 'YES'
      AND e.claim_status <> 'CLAIMED'
      AND e.consult_embedding IS NOT NULL
      AND e.consult_embedding_model = p_model
      AND directory_entry_reachable(e, p_region)
    ORDER BY e.consult_embedding <=> p_embedding
    LIMIT least(greatest(coalesce(p_limit, 40), 1), 200)
$$;

REVOKE ALL ON FUNCTION directory_entry_reachable(directory_entries, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION match_directory_by_indicators(text[], smallint[], text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION match_directory_by_embedding(extensions.vector, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION directory_entry_reachable(directory_entries, text) TO service_role;
GRANT EXECUTE ON FUNCTION match_directory_by_indicators(text[], smallint[], text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION match_directory_by_embedding(extensions.vector, text, text, integer) TO service_role;

COMMIT;
