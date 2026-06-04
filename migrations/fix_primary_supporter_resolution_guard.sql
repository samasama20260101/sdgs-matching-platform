-- ============================================================
-- 主サポーター判定のDB補強
-- 実行場所: Supabase Dashboard -> SQL Editor (Staging first)
--
-- 方針:
-- - 既存ACCEPTED offerの accepted_order を案件内で正規化する
-- - 同一案件内の承認順が重複しないようにする
-- - Production適用時は add_accepted_order_to_offers.sql の直後に実行する
-- ============================================================

BEGIN;

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS accepted_order integer DEFAULT NULL;

WITH ordered_accepted_offers AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY case_id
      ORDER BY accepted_order ASC NULLS LAST, accepted_at NULLS LAST, created_at ASC, id ASC
    ) AS generated_order
  FROM offers
  WHERE status = 'ACCEPTED'
)
UPDATE offers offer
SET accepted_order = ordered_accepted_offers.generated_order
FROM ordered_accepted_offers
WHERE offer.id = ordered_accepted_offers.id
  AND offer.accepted_order IS DISTINCT FROM ordered_accepted_offers.generated_order;

CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_case_accepted_order_unique
  ON offers (case_id, accepted_order)
  WHERE status = 'ACCEPTED'
    AND accepted_order IS NOT NULL;

COMMIT;
