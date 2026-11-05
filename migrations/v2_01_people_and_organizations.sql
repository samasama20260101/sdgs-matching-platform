-- ============================================================================
-- v2_01_people_and_organizations.sql(v2.0 #72)
-- 目的: 1人1アカウント(相談する / 支える を同じアカウントで)、パスワードなし、相談者の個人情報を持たない形にする。
--   - users: ロールを PERSON / ADMIN の2つに。呼び名・年齢(登録日を基準に1年ごとに進める)・国と地域・言語だけを使う。
--            氏名・メールは NOT NULL を外す(列そのものは、規約の施行後に v2_90 で消す)
--   - supporter_profiles: 個人の支え手(本名・得意なこと・遠隔で可・言語)。相談する側では使わない
--   - organizations: 種類・審査の状態(申し込み → 面談 → 承認)・団体の連絡先・対象の人数(スコアの「人口」)
--   - organization_memberships: 1人で複数の団体に入れる(会社と NPO など)
--   - coordinator_scopes: まとめる役(市区町村と中間支援団体)の範囲
--   - user_consents・notification_prefs・push_subscriptions・identity_relink_requests
--   - anon / authenticated からの表と関数の権限を外す(ブラウザは認証だけに使い、DB は API から service_role で触る)
-- 実行場所: Staging で確かめてから本番。本番は規約・ポリシーの施行に合わせて、直前に内容を示して確認をもらう。
-- 前提: migrations/000_baseline_schema_20261105.sql の形。
-- 何度流しても同じ結果になる(IF NOT EXISTS・ON CONFLICT・条件つきの UPDATE)。
-- 戻し方: 足した表は DROP TABLE。users.role は v2_01 の前の値を audit_logs に残さないので、
--         戻すときは organization_memberships の有無で SUPPORTER / SOS を付け直す(運営アカウントは ADMIN のまま)。
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
ALTER TABLE users ALTER COLUMN real_name DROP NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- 年齢は生年月日でなく「登録日の年齢」で持ち、基準日から1年ごとに進める(11/5 定例)。本人が直したらその日が新しい基準日
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_years smallint;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_base_date date;
-- 国の中の地域(日本は regions の都道府県 JP-xx。ほかの国は regions にあればそのコード、なければ空)
ALTER TABLE users ADD COLUMN IF NOT EXISTS region_code text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_age_range') THEN
    ALTER TABLE users ADD CONSTRAINT users_age_range
      CHECK (age_years IS NULL OR (age_years BETWEEN 0 AND 130));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_age_pair') THEN
    ALTER TABLE users ADD CONSTRAINT users_age_pair
      CHECK ((age_years IS NULL) = (age_base_date IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_region_country_shape') THEN
    ALTER TABLE users ADD CONSTRAINT users_region_country_shape
      CHECK (region_country IS NULL OR region_country ~ '^[A-Z]{2}$');
  END IF;
END $$;

-- 言語に es を足す(画面は ja・en・es。ほかはカタログだけ残す)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_locale_check;
ALTER TABLE users ADD CONSTRAINT users_locale_check
  CHECK (locale = ANY (ARRAY['ja','en','es','zh','ko','vi','id']));

-- 地域の設定(v1 は相談者だけ sos_region_code に都道府県)を写す
UPDATE users SET region_code = sos_region_code
WHERE region_code IS NULL AND sos_region_code IS NOT NULL;

-- v1 の生年月日から年齢を作る(本番・Staging とも入っている人は 0 人の見込み。入っていれば今日を基準日にする)
UPDATE users
SET age_years = date_part('year', age(current_date, birth_date))::smallint,
    age_base_date = current_date
WHERE age_years IS NULL AND birth_date IS NOT NULL;

-- ロール: v1 の SOS / SUPPORTER は同じ「人」になる。運営(ADMIN)はそのまま
UPDATE users SET role = 'PERSON' WHERE role IN ('SOS', 'SUPPORTER');
-- v1 の利用者は v2 のはじめの質問を済ませたものとして扱う(呼び名・地域はある。年齢は「わたし」で入れてもらう)
UPDATE users SET onboarded_at = COALESCE(created_at, now()) WHERE onboarded_at IS NULL AND role = 'PERSON';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role = ANY (ARRAY['PERSON','ADMIN']));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id_unique ON users (auth_user_id);

-- 表示番号: v2 の人は USR-。v1 の SOS- / SUP- / ADM- はそのまま残す
CREATE SEQUENCE IF NOT EXISTS users_person_display_seq;
CREATE OR REPLACE FUNCTION generate_person_display_id() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.display_id IS NULL OR NEW.display_id = '' THEN
    IF NEW.role = 'ADMIN' THEN
      NEW.display_id := 'ADM-' || LPAD(nextval('users_admin_display_seq')::text, 5, '0');
    ELSE
      NEW.display_id := 'USR-' || LPAD(nextval('users_person_display_seq')::text, 5, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS set_user_display_id ON users;
CREATE TRIGGER set_user_display_id BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION generate_person_display_id();

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------------------------------------------------------------------------
-- 同意(規約・ポリシー・支える人と団体の決まり)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_consents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document    text NOT NULL CHECK (document IN ('TERMS', 'PRIVACY', 'SUPPORTER_TERMS')),
  version     text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, document, version)
);

-- ---------------------------------------------------------------------------
-- 個人の支え手
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supporter_profiles (
  user_id           uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- 本名は本人の申告。手を挙げた団体と、申し出た相談の相手にだけ見せる。相談する側では使わない
  real_name         text NOT NULL CHECK (char_length(btrim(real_name)) BETWEEN 1 AND 100),
  -- 得意なこと(大項目の番号 1〜17。久保さんの指標一覧の列D の言葉で出す)
  skill_categories  smallint[] NOT NULL DEFAULT '{}'
    CHECK (skill_categories <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17]::smallint[]),
  intro             text CHECK (intro IS NULL OR char_length(intro) <= 500),
  region_country    text NOT NULL DEFAULT 'JP' CHECK (region_country ~ '^[A-Z]{2}$'),
  region_code       text,
  remote_ok         boolean NOT NULL DEFAULT false,
  languages         text[] NOT NULL DEFAULT ARRAY['ja'],
  -- 電話番号の確認(SMS)。申し出の条件(10/30 決定 2)。番号そのものは Auth の中だけに置く
  phone_verified_at timestamptz,
  status            text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_supporter_profiles_updated_at ON supporter_profiles;
CREATE TRIGGER set_supporter_profiles_updated_at BEFORE UPDATE ON supporter_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------------------------------------------------------------------------
-- 団体
-- ---------------------------------------------------------------------------
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_type text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS vetting_status text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS vetting_note text;
-- 申し込みフォームの答え(簡単な情報と10項目)と、面談のチェックリスト(項目は運営が決める)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS application jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS interview_checklist jsonb NOT NULL DEFAULT '{}'::jsonb;
-- 団体の連絡先(課の代表メールなど)。知らせの宛先だけに使い、ログインには使わない(盤 65)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_email text;
-- 対象の人数。会社・地域として相談したときのスコアの「人口」に使う(11/5 定例。個人の相談は 1)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS population bigint;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS region_country text NOT NULL DEFAULT 'JP';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS remote_ok boolean NOT NULL DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT ARRAY['ja'];
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS corporate_number text;

-- v1 の種別(supporter_type)を v2 の種類に写す。分からないものは OTHER
UPDATE organizations SET org_type = CASE
    WHEN supporter_type IN ('NPO', 'npo') THEN 'NPO'
    WHEN supporter_type IN ('NGO', 'ngo') THEN 'NGO'
    WHEN supporter_type IN ('COMPANY', 'company', 'CORPORATE', 'corporate') THEN 'COMPANY'
    WHEN supporter_type IN ('GOVERNMENT', 'government', 'MUNICIPALITY', 'municipality', 'ADMINISTRATION', 'administration') THEN 'MUNICIPALITY'
    WHEN supporter_type IN ('SCHOOL', 'school') THEN 'SCHOOL'
    ELSE 'OTHER'
  END
WHERE org_type IS NULL;
-- v1 の団体は運営が面談して作ったもの。v2 では「承認済み」から始める
UPDATE organizations SET vetting_status = 'APPROVED', approved_at = COALESCE(approved_at, created_at)
WHERE vetting_status IS NULL;

ALTER TABLE organizations ALTER COLUMN org_type SET DEFAULT 'OTHER';
ALTER TABLE organizations ALTER COLUMN org_type SET NOT NULL;
ALTER TABLE organizations ALTER COLUMN vetting_status SET DEFAULT 'APPLIED';
ALTER TABLE organizations ALTER COLUMN vetting_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_org_type_check') THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_org_type_check CHECK (org_type IN (
      'NPO', 'NGO', 'COMPANY', 'MUNICIPALITY', 'COMMUNITY', 'SCHOOL', 'NATIONAL_AGENCY',
      'OTHER_PUBLIC', 'INTERMEDIARY', 'PRO_BONO_LAWYER', 'OTHER'));
  END IF;
  -- 審査は2段階に分けない(11/5)。申し込み → 面談の調整中 → 承認(一覧に載り、機微な相談も受けられる)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_vetting_status_check') THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_vetting_status_check
      CHECK (vetting_status IN ('APPLIED', 'INTERVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_population_positive') THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_population_positive
      CHECK (population IS NULL OR population > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_corporate_number_shape') THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_corporate_number_shape
      CHECK (corporate_number IS NULL OR corporate_number ~ '^[0-9]{13}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_region_country_shape') THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_region_country_shape
      CHECK (region_country ~ '^[A-Z]{2}$');
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_organizations_vetting ON organizations (vetting_status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 所属: 1人で複数の団体に入れる。同じ団体に今いる所属は1つまで(既存の索引のまま)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_organization_memberships_user_current_unique;

-- ---------------------------------------------------------------------------
-- まとめる役(コーディネーター)の範囲。団体 × 地域 × テーマ(テーマは空なら地域の全部)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coordinator_scopes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  region_country  text NOT NULL DEFAULT 'JP' CHECK (region_country ~ '^[A-Z]{2}$'),
  region_code     text,
  theme           text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coordinator_scopes_unique
  ON coordinator_scopes (organization_id, region_country, COALESCE(region_code, ''), COALESCE(theme, ''));

-- ---------------------------------------------------------------------------
-- 通知の受け取り方(本人が選ぶ。既定はどちらもオフ。件名にも本文にも相談の中身を書かない)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT false,
  push_enabled  boolean NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- ログイン手段の付け替えの申し出(運営が本人と確かめてから付け替え、記録に残す)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identity_relink_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid REFERENCES users(id) ON DELETE SET NULL,
  display_id_claimed text,
  current_method     text,
  requested_email    text,
  note               text,
  status             text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'VERIFYING', 'DONE', 'REJECTED')),
  handled_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  handled_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 新しい表も RLS を有効にする(ポリシーは置かない。API が service_role で読み書きする)
-- ---------------------------------------------------------------------------
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE supporter_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordinator_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_relink_requests ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 公開キー(anon)とログイン中の利用者(authenticated)から、public の表・関数・連番の権限を外す。
-- RLS で止まってはいるが、置き忘れたポリシー1つで漏れる形をやめる(仕様書 §15 の後回しにしていた件)
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, PUBLIC;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;
