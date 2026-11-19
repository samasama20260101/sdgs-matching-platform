-- ============================================================
-- v2_17_directory_claim_search.sql(#140)
-- 支援団体の登録のとき、掲載台帳から名前の近い団体を探す
--
-- 背景: 2026-11-19 の定例で、全国の団体を前もって掲載台帳に入れると、その団体が支援団体として登録するときに
--       行が重なるので、登録のときに名前の近い団体を「この団体でしょうか」と出して選んでもらい、
--       運営の承認のときに行を支援団体に結ぶ(claim_status = CLAIMED・claimed_organization_id)と決めた。
--       名前は提案(#138)と同じ鍵(法人格・空白・全角半角の違いを除く)で比べる。
--       鍵の作りは src/lib/domain/suggestions.ts の nameKey と同じにする(変えるときは両方を直す。
--       法人格と記号の並びは scripts/tests/directoryClaim.test.ts がこのファイルと突き合わせる)
-- 実行場所: v2_16 のあと。Staging で確かめてから本番。何度流しても同じ結果。
--
-- - directory_entries.name_key: 名前の鍵(名前から DB が作る列。取り込みでも書かない)
--     打つたびに探すので、行ごとに鍵を作り直さず、作った鍵を持っておく(鍵を毎回作ると民間の団体 3,000 行で 30〜80ms かかった)
-- - search_directory_organizations(p_key, p_corporate_number, p_limit):
--     民間の団体(kind = ORGANIZATION)・公開中・まだ結んでいない行から、法人番号の一致か、名前の鍵の部分一致
--     (行の鍵に入れた鍵が入っている、または入れた鍵に行の鍵(3 文字以上)が入っている)を返す。最終の並べ方と 5 件への絞り込みは
--     src/lib/domain/directoryClaim.ts の rankClaimCandidates(ここは候補を取りこぼさないための下ごしらえ)
--   返すのは名前・法人番号・都道府県・サイト・出典の表記だけ(電話・住所・相談の受け方の引用は返さない)
--   呼ぶのはサーバーの service_role だけ
--
-- 影響: directory_entries に列を 1 つ足し(表を書き直す。Staging の 13,700 行で数秒)、関数を 1 つ足す。既存の列と行の値は変えない。
--
-- ロールバック:
--   DROP FUNCTION IF EXISTS search_directory_organizations(text, text, integer);
--   ALTER TABLE directory_entries DROP COLUMN IF EXISTS name_key;
-- ============================================================

BEGIN;

ALTER TABLE directory_entries
    ADD COLUMN IF NOT EXISTS name_key text GENERATED ALWAYS AS (
        lower(
            regexp_replace(
                regexp_replace(
                    normalize(coalesce(name, ''), NFKC),
                    '(特定非営利活動法人|認定特定非営利活動法人|認定NPO法人|NPO法人|一般社団法人|公益社団法人|一般財団法人|公益財団法人|社会福祉法人|社会福祉協議会法人)',
                    '', 'g'),
                '[\s・()（）「」『』]', '', 'g'))
    ) STORED;

CREATE OR REPLACE FUNCTION search_directory_organizations(p_key text, p_corporate_number text, p_limit integer DEFAULT 30)
RETURNS TABLE (
    id uuid,
    name text,
    corporate_number text,
    prefecture_code text,
    website_url text,
    attribution text,
    source_url text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT e.id, e.name, e.corporate_number, e.prefecture_code, e.website_url, e.attribution, e.source_url
    FROM directory_entries e
    WHERE e.kind = 'ORGANIZATION'
      AND e.visibility = 'PUBLIC'
      AND e.claim_status <> 'CLAIMED'
      AND ((p_corporate_number IS NOT NULL AND e.corporate_number = p_corporate_number)
           OR (char_length(coalesce(p_key, '')) >= 2
               AND (strpos(e.name_key, p_key) > 0
                    OR (char_length(e.name_key) >= 3 AND strpos(p_key, e.name_key) > 0))))
    ORDER BY (p_corporate_number IS NOT NULL AND e.corporate_number = p_corporate_number) DESC,
             (e.name_key = coalesce(p_key, '')) DESC,
             abs(char_length(e.name_key) - char_length(coalesce(p_key, ''))),
             e.name
    LIMIT least(greatest(coalesce(p_limit, 30), 1), 100)
$$;

REVOKE ALL ON FUNCTION search_directory_organizations(text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION search_directory_organizations(text, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION search_directory_organizations(text, text, integer) TO service_role;

COMMIT;
