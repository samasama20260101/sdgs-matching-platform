-- ============================================================================
-- v2_02_cases.sql(v2.0 #72)
-- 目的: 相談の入口を「個人・会社・地域(・国)」に分け、表は1つのまま持つ。支え手は最大3者(最初の1者が中心)。
--   - cases: 相談する主体・代理登録・入口・機微・18歳未満・対象の人数・地域
--   - case_indicators: 相談の指標(本人が選んだもの・AI の候補・運営の確定を分けて持つ)
--   - offers: 個人の支え手からの申し出・中心からの共同支援の招待(相談者の同意待ち)
--   - accept_sos_offer: 3者まで・相談の状態を見る・招待の同意も同じ関数で
--   - message_translations・case_translations: 原文を残したまま訳を持つ
--   - case_handover_codes: 代理登録の引き継ぎコード(期限つき・使い切り。値はハッシュで持つ)
--   - case_summaries: 解決した相談の要約(内容・取った手立て・その後。運営が見る)
--   - contributions: 社会貢献の記録(人に付く・その時の所属つき・追記だけ)
-- 実行場所: v2_01 のあと。Staging で確かめてから本番。
-- 何度流しても同じ結果になる。
-- 戻し方: 足した表は DROP TABLE。offers の制約は v1 の offers_supporter_organization_required を付け直す
--         (個人の申し出の行を消してから)。accept_sos_offer は 000_baseline の定義に戻す。
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- cases
-- ---------------------------------------------------------------------------
-- 相談する主体。PERSON = 本人として / COMPANY = 会社の一員として / COMMUNITY = 自治体の課・町内会など / NATION = 国(v2.0 では出さない)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS subject_type text NOT NULL DEFAULT 'PERSON';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS subject_organization_id uuid REFERENCES organizations(id) ON DELETE RESTRICT;
-- 会社・地域の相談の担当者(替わったら管理者が付け替える)。本人の相談では owner と同じ
ALTER TABLE cases ADD COLUMN IF NOT EXISTS assignee_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
-- 代理登録(スマホを持たない人の相談を、支え手の団体が本人の同意を得て登録する)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS proxy_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS proxy_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS proxy_consented_at timestamptz;
-- 入口(本屋などの相談所コード・レンズ)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS entry_channel text NOT NULL DEFAULT 'DIRECT';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS entry_code text;
-- 機微: 個人の支え手に見せない・団体のメンバーは2つ目の確認を通った人だけが見る。
-- 決め方は src/lib/domain/sensitivity.ts(指標の印・18歳未満。AI は上げる方向だけ、運営はどちらにも直せる)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_sensitive boolean NOT NULL DEFAULT false;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sensitive_reasons text[] NOT NULL DEFAULT '{}';
-- 登録したときに18歳未満だったか(本人の年齢の写し。あとから年齢が進んでも相談の扱いは変えない)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_minor boolean NOT NULL DEFAULT false;
-- 対象の人数。スコア = 解決した相談に付いた指標の数 × これ(11/5 定例)。個人の相談は 1
ALTER TABLE cases ADD COLUMN IF NOT EXISTS affected_population bigint NOT NULL DEFAULT 1;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS region_code text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS city text;
-- 支え手の申し出がないまま 24 時間たち、コーディネーターの一覧に回した時刻
ALTER TABLE cases ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

-- 代理登録で、本人がまだ引き継いでいない相談は持ち主がいない
ALTER TABLE cases ALTER COLUMN owner_user_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cases_subject_type_check') THEN
    ALTER TABLE cases ADD CONSTRAINT cases_subject_type_check
      CHECK (subject_type IN ('PERSON', 'COMPANY', 'COMMUNITY', 'NATION'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cases_subject_org_required') THEN
    ALTER TABLE cases ADD CONSTRAINT cases_subject_org_required
      CHECK ((subject_type = 'PERSON') = (subject_organization_id IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cases_owner_or_proxy') THEN
    ALTER TABLE cases ADD CONSTRAINT cases_owner_or_proxy
      CHECK (owner_user_id IS NOT NULL OR proxy_organization_id IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cases_entry_channel_check') THEN
    ALTER TABLE cases ADD CONSTRAINT cases_entry_channel_check
      CHECK (entry_channel IN ('DIRECT', 'SHOP_CODE', 'LENS', 'PROXY'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cases_population_positive') THEN
    ALTER TABLE cases ADD CONSTRAINT cases_population_positive CHECK (affected_population > 0);
  END IF;
END $$;

ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_locale_check;
ALTER TABLE cases ADD CONSTRAINT cases_locale_check
  CHECK (locale = ANY (ARRAY['ja','en','es','zh','ko','vi','id']));

-- v1 の相談: 地域は相談者の地域の設定から写す(v1 の region_area は使っていない)。
-- 18歳未満の印は v1 では生年月日から都度計算していた。生年月日を持つ人は 0 人なので写すものはない
UPDATE cases c SET region_code = u.region_code
FROM users u
WHERE c.owner_user_id = u.id AND c.region_code IS NULL AND u.region_code IS NOT NULL;
UPDATE cases SET assignee_user_id = owner_user_id WHERE assignee_user_id IS NULL AND owner_user_id IS NOT NULL;
-- 個人の相談は団体を通して支える(11/5)。個人の支え手に個人の相談を出さないのは見える範囲の決まり
-- (src/lib/domain/visibility.ts)で守り、機微の印とは分ける。機微の印は指標の印と18歳未満で決まる

CREATE INDEX IF NOT EXISTS idx_cases_status_created ON cases (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_owner ON cases (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_subject_org ON cases (subject_organization_id) WHERE subject_organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_proxy_org ON cases (proxy_organization_id) WHERE proxy_organization_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 相談の指標
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS case_indicators (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  indicator_code     text NOT NULL,
  -- SELF = 相談した人が選んだ / AI = AI の候補 / COORDINATOR / ADMIN = 運営が足した
  source             text NOT NULL CHECK (source IN ('SELF', 'AI', 'COORDINATOR', 'ADMIN')),
  confidence         real CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  reason             text,
  -- PROPOSED = 確かめる前 / CONFIRMED = 運営が確定(地図と社会貢献の記録に数えるのはこれだけ)/ REJECTED
  status             text NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'CONFIRMED', 'REJECTED')),
  decided_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, indicator_code, source)
);
CREATE INDEX IF NOT EXISTS idx_case_indicators_status ON case_indicators (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_indicators_code ON case_indicators (indicator_code);

-- v1 の相談で本人が選んだ選択肢(intake_qna.indicators)を写す。v1 では本人の選択で大項目が決まっていたので、
-- 本人が選んだものは確定として扱う(AI は分類していない)
INSERT INTO case_indicators (case_id, indicator_code, source, status, decided_at)
SELECT c.id, code, 'SELF', 'CONFIRMED', c.created_at
FROM cases c
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(c.intake_qna -> 'indicators') = 'array' THEN c.intake_qna -> 'indicators' ELSE '[]'::jsonb END
) AS code
ON CONFLICT (case_id, indicator_code, source) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 申し出: 団体か個人。中心(accepted_order = 1)からの共同支援の招待は INVITED(相談者の同意で ACCEPTED)
-- ---------------------------------------------------------------------------
ALTER TABLE offers ADD COLUMN IF NOT EXISTS supporter_kind text NOT NULL DEFAULT 'ORGANIZATION';
ALTER TABLE offers ADD COLUMN IF NOT EXISTS invited_by_offer_id uuid REFERENCES offers(id) ON DELETE SET NULL;
ALTER TABLE offers ALTER COLUMN supporter_organization_id DROP NOT NULL;
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_supporter_organization_required;
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_status_allowed;
ALTER TABLE offers ADD CONSTRAINT offers_status_allowed
  CHECK (status = ANY (ARRAY['PENDING','INVITED','ACCEPTED','DECLINED','WITHDRAWN']));
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offers_supporter_kind_check') THEN
    ALTER TABLE offers ADD CONSTRAINT offers_supporter_kind_check CHECK (
      (supporter_kind = 'ORGANIZATION' AND supporter_organization_id IS NOT NULL)
      OR (supporter_kind = 'INDIVIDUAL' AND supporter_organization_id IS NULL));
  END IF;
END $$;
-- 個人の申し出は相談1件に1人1件(団体は既存の idx_offers_case_organization_unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_case_individual_unique
  ON offers (case_id, supporter_user_id) WHERE supporter_kind = 'INDIVIDUAL';

-- 社会貢献のありがとう(バッジ): 個人の支え手にも贈れる
ALTER TABLE supporter_badges ALTER COLUMN supporter_organization_id DROP NOT NULL;
ALTER TABLE supporter_badges DROP CONSTRAINT IF EXISTS supporter_badges_organization_required;

-- 承認(相談者が申し出を選ぶ)。最大 p_max_accepted 者まで。最初に選んだ1者が中心(accepted_order = 1)。
-- 招待(INVITED)への同意も同じ関数で受ける。相談が受付中・支援中でなければ断る(仕様書 §15 の件)
CREATE OR REPLACE FUNCTION accept_sos_offer(p_offer_id uuid, p_sos_user_id uuid, p_max_accepted integer)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
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
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN');
  END IF;
  -- 選べるのは相談の持ち主(本人の相談)か担当者(会社・地域の相談)。代理の相談は代理の団体の API 側で確かめてから呼ぶ
  IF p_sos_user_id IS DISTINCT FROM target_case.owner_user_id
     AND p_sos_user_id IS DISTINCT FROM target_case.assignee_user_id THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN');
  END IF;
  IF target_case.status NOT IN ('OPEN', 'MATCHED') THEN
    RETURN jsonb_build_object('error', 'CASE_NOT_ACTIVE');
  END IF;
  IF target_offer.status NOT IN ('PENDING', 'INVITED') THEN
    RETURN jsonb_build_object('error', 'OFFER_NOT_PENDING');
  END IF;

  SELECT count(*) INTO accepted_count FROM offers
  WHERE case_id = target_offer.case_id AND status = 'ACCEPTED';
  IF accepted_count >= p_max_accepted THEN
    RETURN jsonb_build_object('error', 'MAX_REACHED');
  END IF;

  SELECT COALESCE(max(accepted_order), 0) + 1 INTO next_order FROM offers
  WHERE case_id = target_offer.case_id;

  UPDATE offers
  SET status = 'ACCEPTED', accepted_order = next_order, accepted_at = now(),
      accepted_by_user_id = p_sos_user_id, updated_at = now()
  WHERE id = p_offer_id AND status IN ('PENDING', 'INVITED');

  UPDATE cases SET status = 'MATCHED', started_at = COALESCE(started_at, now()), updated_at = now()
  WHERE id = target_offer.case_id AND status = 'OPEN';

  IF accepted_count + 1 >= p_max_accepted THEN
    UPDATE offers
    SET status = 'DECLINED', declined_at = now(), declined_by_user_id = p_sos_user_id, updated_at = now()
    WHERE case_id = target_offer.case_id AND id <> p_offer_id AND status IN ('PENDING', 'INVITED');
  END IF;

  RETURN jsonb_build_object('ok', true, 'accepted_order', next_order,
    'auto_declined', accepted_count + 1 >= p_max_accepted);
END;
$$;
REVOKE ALL ON FUNCTION accept_sos_offer(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION accept_sos_offer(uuid, uuid, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 訳(原文はそれぞれの表に残し、訳だけを足す)
-- ---------------------------------------------------------------------------
ALTER TABLE messages ADD COLUMN IF NOT EXISTS original_language text;
CREATE TABLE IF NOT EXISTS message_translations (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  language   text NOT NULL,
  content    text NOT NULL,
  provider   text NOT NULL,
  model      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, language)
);
CREATE TABLE IF NOT EXISTS case_translations (
  case_id     uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  language    text NOT NULL,
  title       text NOT NULL,
  description text NOT NULL,
  provider    text NOT NULL,
  model       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, language)
);
CREATE INDEX IF NOT EXISTS idx_messages_case_created ON messages (case_id, created_at);

-- ---------------------------------------------------------------------------
-- 代理登録の引き継ぎコード
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS case_handover_codes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            uuid NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
  -- コードそのものは持たず sha256 だけ(紙で本人に渡す。DB から読まれても使えない)
  code_hash          text NOT NULL UNIQUE,
  expires_at         timestamptz NOT NULL,
  used_at            timestamptz,
  used_by_user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  failed_attempts    integer NOT NULL DEFAULT 0,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 解決した相談の要約(ナレッジ)。運営だけが見る。プライバシーポリシーに書く(11/5)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS case_summaries (
  case_id    uuid PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,
  content    text NOT NULL,
  actions    text NOT NULL,
  aftermath  text NOT NULL,
  source     text NOT NULL CHECK (source IN ('AI', 'STAFF')),
  model      text,
  is_model_case boolean NOT NULL DEFAULT false,
  reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_case_summaries_updated_at ON case_summaries;
CREATE TRIGGER set_case_summaries_updated_at BEFORE UPDATE ON case_summaries
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------------------------------------------------------------------------
-- 社会貢献の記録。人に付き、その時の所属を残す。追記だけ(直すときは訂正の行を足す)。
-- 退会したときだけ、その人の行をすべて消す(10/30 決定 C)。計算は src/lib/domain/score.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contributions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  case_id         uuid REFERENCES cases(id) ON DELETE SET NULL,
  -- RESOLVED = 支えた相談が解決した / THANKS = ありがとうが届いた / CORRECTION = 訂正
  kind            text NOT NULL CHECK (kind IN ('RESOLVED', 'THANKS', 'CORRECTION')),
  indicator_codes text[] NOT NULL DEFAULT '{}',
  population      bigint NOT NULL DEFAULT 1 CHECK (population > 0),
  points          bigint NOT NULL DEFAULT 0,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contributions_resolved_once
  ON contributions (user_id, case_id) WHERE kind = 'RESOLVED';
CREATE INDEX IF NOT EXISTS idx_contributions_user ON contributions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contributions_org ON contributions (organization_id) WHERE organization_id IS NOT NULL;

CREATE OR REPLACE FUNCTION prevent_contribution_update() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- 消すのは退会のときだけ(行ごと)。書き換えは訂正の行を足して表す
  IF TG_OP = 'UPDATE' THEN
    -- 団体が消えたときの ON DELETE SET NULL と、相談が消えたときの SET NULL だけは通す
    IF NEW.id = OLD.id AND NEW.user_id = OLD.user_id AND NEW.kind = OLD.kind AND NEW.points = OLD.points
       AND NEW.indicator_codes = OLD.indicator_codes AND NEW.population = OLD.population
       AND ((NEW.organization_id IS NULL AND OLD.organization_id IS NOT NULL) OR (NEW.case_id IS NULL AND OLD.case_id IS NOT NULL)) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'contributions is append-only';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS contributions_append_only ON contributions;
CREATE TRIGGER contributions_append_only BEFORE UPDATE ON contributions
  FOR EACH ROW EXECUTE FUNCTION prevent_contribution_update();

-- ---------------------------------------------------------------------------
ALTER TABLE case_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_handover_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, PUBLIC;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

COMMIT;
