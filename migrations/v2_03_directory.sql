-- ============================================================
-- v2_03_directory.sql(v2.0 #72)
-- 公開情報のつなぎ先(掲載台帳)と、団体の管理権取得(claim)
-- 元: directory-data の app-integration/migration_directory_entries.sql(2026-10-15 の案)。
--     10/30 に「公開データのつなぎ先をアプリに載せる」が決まった(決めてほしいこと 7)ので v2.0 に入れる。
-- 実行場所: v2_02 のあと。Staging で確かめてから本番。
-- 取り込み: scripts/import-directory-entries.mts(データはリポジトリに入れない。directory-data の出力から流す)
--
-- 方針:
-- - directory_entries = 公開データから集めたつなぎ先 (公的窓口・全国共通ダイヤル・claim 前の団体)
-- - organizations (サポーター) とは別の表にする
--     - サービス紹介資料の「審査済みの団体だけが参加」と混ざらない
--     - 団体数の集計 (/api/public/stats)・公開一覧 (/api/public/supporters)・申し出とチャットの流れに影響しない
-- - claim は「掲載行の団体が本人確認と審査を経てサポーター (organizations) になる」操作。
--   承認したら organizations と OWNER の所属を作り、claimed_organization_id で結ぶ
-- - 行の出典 (source_url・license・attribution) は表示に使う (PDL1.0 / CC BY の出典表記の義務)
--
-- 注意:
-- - 既存の表は変更しない
-- - 個人の氏名は持たない (取り込み側で落としている)。claim 申請者のメールだけが個人情報
-- - Production 適用前に必ず対象 project ref とバックアップを確認する
--
-- ロールバック:
--   DROP TABLE IF EXISTS case_referrals;
--   DROP TABLE IF EXISTS directory_change_requests;
--   DROP TABLE IF EXISTS directory_claim_requests;
--   DROP TABLE IF EXISTS directory_entries;
--   DROP FUNCTION IF EXISTS update_directory_updated_at();
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS directory_entries (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- directory-data の entry_id。取り込みを何度流しても同じ行を更新するためのキー
    entry_key               text NOT NULL UNIQUE,
    kind                    text NOT NULL
        CHECK (kind IN ('NATIONAL_HOTLINE', 'PUBLIC_WINDOW', 'ORGANIZATION')),
    -- 窓口種別 (directory-data/mappings/window-types.yaml)。社協のように複数を兼ねる窓口がある
    categories              text[] NOT NULL CHECK (cardinality(categories) > 0),
    name                    text NOT NULL,
    operator_name           text,
    corporate_number        text CHECK (corporate_number ~ '^[0-9]{13}$'),
    -- regions.code と同じ JP-xx
    prefecture_code         text,
    -- 全国地方公共団体コード (検査数字つき6桁)
    local_gov_code          text CHECK (local_gov_code ~ '^[0-9]{6}$'),
    postal_code             text CHECK (postal_code ~ '^[0-9]{7}$'),
    address                 text,
    -- FULL = 番地まで / CITY = 市区町村まで (個人宅の可能性がある小さな団体) / NONE = 公表しない (DV 関連など)
    address_precision       text NOT NULL
        CHECK (address_precision IN ('FULL', 'CITY', 'NONE')),
    phone                   text,
    fax                     text,
    email                   text,
    website_url             text,
    hours_text              text,
    service_scope           text NOT NULL
        CHECK (service_scope IN ('NATIONWIDE', 'PREFECTURE', 'MUNICIPALITY', 'DISTRICT')),
    -- PREFECTURE は JP-xx、MUNICIPALITY/DISTRICT は団体コード
    service_codes           text[] NOT NULL DEFAULT '{}',
    service_note            text,
    -- 特定非営利活動促進法 別表の活動分野の番号 (1〜20)。NPO 以外は空
    npo_activity_fields     smallint[] NOT NULL DEFAULT '{}' CHECK (npo_activity_fields <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]::smallint[]),
    sdgs_goals              smallint[] NOT NULL DEFAULT '{}',
    gi_indicators           text[] NOT NULL DEFAULT '{}',
    -- 所在地を伏せるべき窓口 (DV など)。true なら住所を持たない
    sensitive               boolean NOT NULL DEFAULT false,
    source_id               text NOT NULL,
    source_url              text NOT NULL,
    source_as_of            text,
    license                 text NOT NULL,
    attribution             text,
    -- SOURCE_OFFICIAL = 公的機関の一覧そのもの / VERIFIED = 出典ページで電話と名称を照合済み / それ以外は未確認
    verification_status     text NOT NULL,
    claim_status            text NOT NULL DEFAULT 'UNCLAIMED'
        CHECK (claim_status IN ('UNCLAIMED', 'CLAIM_PENDING', 'CLAIMED', 'NOT_APPLICABLE')),
    claimed_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
    -- 掲載停止の依頼に応じたら HIDDEN。取り込みで PUBLIC に戻さない
    visibility              text NOT NULL DEFAULT 'PUBLIC'
        CHECK (visibility IN ('PUBLIC', 'HIDDEN')),
    hidden_reason           text,
    imported_at             timestamptz NOT NULL DEFAULT now(),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT directory_entries_sensitive_has_no_address
        CHECK (NOT sensitive OR (address IS NULL AND postal_code IS NULL AND address_precision = 'NONE')),
    CONSTRAINT directory_entries_claimed_has_org
        CHECK (claim_status <> 'CLAIMED' OR claimed_organization_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS directory_entries_service_codes_idx ON directory_entries USING gin (service_codes);
CREATE INDEX IF NOT EXISTS directory_entries_categories_idx ON directory_entries USING gin (categories);
CREATE INDEX IF NOT EXISTS directory_entries_prefecture_idx ON directory_entries (prefecture_code);
CREATE INDEX IF NOT EXISTS directory_entries_corporate_number_idx ON directory_entries (corporate_number)
    WHERE corporate_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS directory_claim_requests (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    directory_entry_id      uuid NOT NULL REFERENCES directory_entries(id) ON DELETE CASCADE,
    requester_email         text NOT NULL,
    requester_user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
    -- 本人確認の方法。上から順に試す (DOMAIN_EMAIL が使えない小さな団体は電話・郵送・書類)
    method                  text NOT NULL
        CHECK (method IN ('DOMAIN_EMAIL', 'PHONE_CALLBACK', 'POSTAL_CODE', 'DOCUMENT')),
    token_hash              text UNIQUE,
    status                  text NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'VERIFIED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
    evidence                jsonb,
    reviewed_by_user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at             timestamptz,
    expires_at              timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- 1つの掲載行に進行中の申請は1件まで
CREATE UNIQUE INDEX IF NOT EXISTS directory_claim_requests_one_open_per_entry
    ON directory_claim_requests (directory_entry_id)
    WHERE status IN ('PENDING', 'VERIFIED');

-- 掲載停止・修正の依頼 (団体・自治体・第三者から)。対応期限を決めて運用する
CREATE TABLE IF NOT EXISTS directory_change_requests (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    directory_entry_id      uuid REFERENCES directory_entries(id) ON DELETE SET NULL,
    request_type            text NOT NULL
        CHECK (request_type IN ('REMOVE', 'CORRECT', 'OTHER')),
    message                 text NOT NULL,
    contact_email           text,
    status                  text NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'DONE', 'REJECTED')),
    handled_by_user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
    handled_at              timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_directory_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_directory_entries_updated_at ON directory_entries;
CREATE TRIGGER set_directory_entries_updated_at
    BEFORE UPDATE ON directory_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_directory_updated_at();

DROP TRIGGER IF EXISTS set_directory_claim_requests_updated_at ON directory_claim_requests;
CREATE TRIGGER set_directory_claim_requests_updated_at
    BEFORE UPDATE ON directory_claim_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_directory_updated_at();

-- 新設テーブルはサーバーAPI(service_role)経由のみで扱う。
-- anon/authenticated向けpolicyは意図的に作らない (既存の organizations と同じ方針)。
ALTER TABLE directory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_claim_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_change_requests ENABLE ROW LEVEL SECURITY;

-- 相談とつなぎ先の提案。相談者が「運営から伝えてよい」を選んだ記録(運営の担当者が窓口の受付から伝える。自動のメールにしない)
CREATE TABLE IF NOT EXISTS case_referrals (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    directory_entry_id  uuid NOT NULL REFERENCES directory_entries(id) ON DELETE CASCADE,
    status              text NOT NULL DEFAULT 'CONSENTED'
        CHECK (status IN ('CONSENTED', 'CONTACTED', 'DONE', 'WITHDRAWN')),
    consented_at        timestamptz NOT NULL DEFAULT now(),
    handled_by_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
    handled_at          timestamptz,
    note                text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (case_id, directory_entry_id)
);
ALTER TABLE case_referrals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, PUBLIC;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

COMMIT;
