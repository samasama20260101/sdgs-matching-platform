-- ============================================================
-- v2_16_directory_consult_profile.sql(#138・#139)
-- 掲載台帳に団体の「相談の受け方」を足し、相談ごとに提案した支援団体を残す
--
-- 背景: 2026-11-19 の定例で、相談を届けたあと相談の内容に合う支援団体を 3 つ出し、
--       それが動いてから v1.0.0 を公開すると決めた。選ぶには各団体の受けている相談・対象・手段が要る。
--       項目は directory-data の src/schema/profile.ts と同じ名前(取り込みはそのまま upsert する)
-- 実行場所: v2_15 のあと。Staging で確かめてから本番。
--
-- 注意:
-- - 既存の列と行は変えない(足すだけ)。調べていない行は accepts_consultation = 'UNKNOWN' のまま提案に出ない
-- - case_suggestions はサーバーだけが読み書きする(RLS を有効にして規則を置かない)
-- - consult_evidence は出典の URL と本文の引用だけ。個人の氏名は入れない(取り込み側で落とす)
--
-- ロールバック:
--   DROP TABLE IF EXISTS case_suggestions;
--   ALTER TABLE cases DROP COLUMN IF EXISTS suggestions_generated_at;
--   DROP INDEX IF EXISTS directory_entries_consult_indicators_idx;
--   ALTER TABLE directory_entries
--     DROP COLUMN IF EXISTS accepts_consultation, DROP COLUMN IF EXISTS consult_summary,
--     DROP COLUMN IF EXISTS consult_indicators, DROP COLUMN IF EXISTS consult_targets,
--     DROP COLUMN IF EXISTS consult_subjects, DROP COLUMN IF EXISTS consult_channels,
--     DROP COLUMN IF EXISTS consult_fee, DROP COLUMN IF EXISTS consult_languages,
--     DROP COLUMN IF EXISTS consult_evidence, DROP COLUMN IF EXISTS consult_checked_at,
--     DROP COLUMN IF EXISTS consult_collected_by, DROP COLUMN IF EXISTS consult_status,
--     DROP COLUMN IF EXISTS org_type;
-- ============================================================

BEGIN;

ALTER TABLE directory_entries
    -- 個人・会社・地域からの相談を受けているか。YES の行だけが提案の候補になる
    ADD COLUMN IF NOT EXISTS accepts_consultation text NOT NULL DEFAULT 'UNKNOWN'
        CHECK (accepts_consultation IN ('YES', 'NO', 'UNKNOWN')),
    -- どういう相談を、誰から、どう受けているか(120 字以内の日本語。事実だけ)
    ADD COLUMN IF NOT EXISTS consult_summary text CHECK (consult_summary IS NULL OR char_length(consult_summary) <= 200),
    -- 受けている相談のグローバル指標の番号(例 '1.2.1')。相談の分類の指標と照らす
    ADD COLUMN IF NOT EXISTS consult_indicators text[] NOT NULL DEFAULT '{}',
    -- 対象者(ANYONE・CHILD・YOUTH・PARENT・WOMEN・ELDERLY・DISABLED・ILLNESS・FOREIGN_RESIDENT・LGBTQ・CRIME_VICTIM・BUSINESS・COMMUNITY)
    ADD COLUMN IF NOT EXISTS consult_targets text[] NOT NULL DEFAULT '{}',
    -- だれの相談を受けるか(PERSON・COMPANY・COMMUNITY)
    ADD COLUMN IF NOT EXISTS consult_subjects text[] NOT NULL DEFAULT '{}'
        CHECK (consult_subjects <@ ARRAY['PERSON', 'COMPANY', 'COMMUNITY']::text[]),
    -- 相談の手段(PHONE・ONLINE・EMAIL・FORM・CHAT・VISIT・OUTREACH)
    ADD COLUMN IF NOT EXISTS consult_channels text[] NOT NULL DEFAULT '{}'
        CHECK (consult_channels <@ ARRAY['PHONE', 'ONLINE', 'EMAIL', 'FORM', 'CHAT', 'VISIT', 'OUTREACH']::text[]),
    ADD COLUMN IF NOT EXISTS consult_fee text NOT NULL DEFAULT 'UNKNOWN'
        CHECK (consult_fee IN ('FREE', 'PAID', 'MIXED', 'UNKNOWN')),
    -- ISO 639-1
    ADD COLUMN IF NOT EXISTS consult_languages text[] NOT NULL DEFAULT '{}',
    -- 項目ごとの根拠 [{field, url, quote}]
    ADD COLUMN IF NOT EXISTS consult_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS consult_checked_at timestamptz,
    -- codex:<model> / manual
    ADD COLUMN IF NOT EXISTS consult_collected_by text,
    -- 調べの結果(OK = 調べが付いた / NO_SOURCE = 調べる出典がない / FAILED = 取得や照合に失敗)。null は調べていない
    ADD COLUMN IF NOT EXISTS consult_status text CHECK (consult_status IS NULL OR consult_status IN ('OK', 'NO_SOURCE', 'FAILED')),
    -- 法人格(NPO・GENERAL_INCORPORATED・PUBLIC_INTEREST・SOCIAL_WELFARE・VOLUNTARY・BAR_ASSOCIATION・COMPANY・OTHER など)。
    -- 営利の会社(COMPANY)は、提案に入れるかを決めるまで候補にしない(src/lib/domain/suggestions.ts)
    ADD COLUMN IF NOT EXISTS org_type text;

-- 提案の候補を指標の重なりで引く
CREATE INDEX IF NOT EXISTS directory_entries_consult_indicators_idx
    ON directory_entries USING gin (consult_indicators)
    WHERE accepts_consultation = 'YES' AND visibility = 'PUBLIC';

-- 提案を作り終えた時刻(0 件でも入れる。画面を開くたびに AI を呼ばないため)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS suggestions_generated_at timestamptz;

CREATE TABLE IF NOT EXISTS case_suggestions (
    case_id            uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    directory_entry_id uuid NOT NULL REFERENCES directory_entries(id) ON DELETE CASCADE,
    rank               smallint NOT NULL CHECK (rank BETWEEN 1 AND 3),
    -- 相談者の言語で一言の理由(AI が書く。AI が使えなかったときは null)
    reason             text CHECK (reason IS NULL OR char_length(reason) <= 200),
    -- AI = AI が候補から選んだ / RULE = 指標の重なりと手段で選んだ
    method             text NOT NULL CHECK (method IN ('AI', 'RULE')),
    created_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (case_id, directory_entry_id),
    UNIQUE (case_id, rank)
);

ALTER TABLE case_suggestions ENABLE ROW LEVEL SECURITY;

COMMIT;
