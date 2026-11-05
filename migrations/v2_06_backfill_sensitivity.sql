-- ============================================================================
-- v2_06_backfill_sensitivity.sql(v2.0 #72)
-- 目的: v1 の相談に、v2 の機微の印を付け直す(v2_02 では列を足しただけで、中身を計算していなかった)。
--   機微 = 本人が選んだ指標に機微の印がある(緊急の印 14 + 機微の追加 11 = 24 の番号。
--   src/lib/domain/sensitivity.ts・intakeIndicators.ts と同じ)。18歳未満は v1 に生年月日の入った人がいないので付けない。
--   上げる方向だけ(すでに機微の相談は触らない)。運営が下げた相談(ADMIN の理由)はない(v1 に運営の判定はない)。
-- 実行場所: v2_05 のあと。何度流しても同じ結果。
-- 戻し方: UPDATE cases SET is_sensitive = false, sensitive_reasons = array_remove(sensitive_reasons, 'INDICATOR') WHERE 'INDICATOR' = ANY(sensitive_reasons);
--         (v2 で新しく届いた相談も含むので、戻すときは created_at で絞る)
-- ============================================================================

BEGIN;

UPDATE cases c
SET is_sensitive = true,
    sensitive_reasons = (SELECT array_agg(DISTINCT r) FROM unnest(c.sensitive_reasons || ARRAY['INDICATOR']) AS r)
WHERE NOT ('INDICATOR' = ANY (c.sensitive_reasons))
  AND jsonb_typeof(c.intake_qna -> 'indicators') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(c.intake_qna -> 'indicators') AS code
    WHERE code IN ('3.3.1','3.3.4','3.4.2','3.5.1','3.5.2','3.7.1','3.7.2','5.2.1','5.2.2','5.3.1','5.3.2','5.6.1','10.3.1','10.7.3','10.7.4','16.1.1','16.1.2','16.1.3','16.2.1','16.2.2','16.2.3','16.3.1','16.3.2','16.10.1')
  );

COMMIT;
