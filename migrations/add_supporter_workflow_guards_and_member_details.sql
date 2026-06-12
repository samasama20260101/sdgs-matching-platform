-- ============================================================
-- サポーター案件フローの競合防止・担当者詳細
-- 実行場所: Supabase Dashboard -> SQL Editor (Staging first)
-- ============================================================

ALTER TABLE organization_memberships
    ADD COLUMN IF NOT EXISTS department text,
    ADD COLUMN IF NOT EXISTS external_phone text,
    ADD COLUMN IF NOT EXISTS phone_extension text,
    ADD COLUMN IF NOT EXISTS admin_note text;

UPDATE organization_memberships om
SET external_phone = u.phone
FROM users u
WHERE om.user_id = u.id
  AND om.external_phone IS NULL
  AND u.phone IS NOT NULL;

ALTER TABLE offers
    ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
    ADD COLUMN IF NOT EXISTS declined_at timestamptz,
    ADD COLUMN IF NOT EXISTS withdrawal_reason text,
    ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
    ADD COLUMN IF NOT EXISTS withdrawn_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- 団体単位で同じ案件へ複数の申し出を作らない。
-- 既存の申し出は再送時も同じレコードを再利用する。
CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_case_organization_unique
    ON offers(case_id, supporter_organization_id)
    WHERE supporter_organization_id IS NOT NULL;

-- SOSの同時操作でも承認上限を越えないよう、案件行をロックして処理する。
CREATE OR REPLACE FUNCTION accept_sos_offer(
    p_offer_id uuid,
    p_sos_user_id uuid,
    p_max_accepted integer
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    target_offer offers%ROWTYPE;
    target_case cases%ROWTYPE;
    accepted_count integer;
    next_order integer;
BEGIN
    SELECT * INTO target_offer FROM offers WHERE id = p_offer_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'OFFER_NOT_FOUND');
    END IF;

    SELECT * INTO target_case FROM cases WHERE id = target_offer.case_id FOR UPDATE;
    IF NOT FOUND OR target_case.owner_user_id <> p_sos_user_id THEN
        RETURN jsonb_build_object('error', 'FORBIDDEN');
    END IF;

    IF target_offer.status <> 'PENDING' THEN
        RETURN jsonb_build_object('error', 'OFFER_NOT_PENDING');
    END IF;

    SELECT count(*)
    INTO accepted_count
    FROM offers
    WHERE case_id = target_offer.case_id
      AND status = 'ACCEPTED';

    IF accepted_count >= p_max_accepted THEN
        RETURN jsonb_build_object('error', 'MAX_REACHED');
    END IF;

    SELECT COALESCE(max(accepted_order), 0) + 1
    INTO next_order
    FROM offers
    WHERE case_id = target_offer.case_id;

    UPDATE offers
    SET status = 'ACCEPTED',
        accepted_order = next_order,
        accepted_at = now(),
        accepted_by_user_id = p_sos_user_id
    WHERE id = p_offer_id
      AND status = 'PENDING';

    UPDATE cases
    SET status = 'MATCHED'
    WHERE id = target_offer.case_id
      AND status = 'OPEN';

    IF accepted_count + 1 >= p_max_accepted THEN
        UPDATE offers
        SET status = 'DECLINED',
            declined_at = now(),
            declined_by_user_id = p_sos_user_id
        WHERE case_id = target_offer.case_id
          AND id <> p_offer_id
          AND status = 'PENDING';
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'accepted_order', next_order,
        'auto_declined', accepted_count + 1 >= p_max_accepted
    );
END;
$$;

REVOKE ALL ON FUNCTION accept_sos_offer(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_sos_offer(uuid, uuid, integer) TO service_role;
