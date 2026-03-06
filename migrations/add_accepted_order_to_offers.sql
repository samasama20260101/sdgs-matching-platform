-- offersテーブルにaccepted_orderカラムを追加
-- 1=主サポーター（解決ボタン押下可）、2・3=副サポーター
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS accepted_order integer DEFAULT NULL;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_offers_case_accepted
  ON offers (case_id, accepted_order) WHERE status = 'ACCEPTED';
