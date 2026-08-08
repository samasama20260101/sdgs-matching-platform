-- i18n locale foundation
-- Staging first. Production application requires the production DB runbook checks.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'ja'
    CHECK (locale IN ('ja', 'en', 'zh', 'ko', 'vi', 'id'));

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'ja'
    CHECK (locale IN ('ja', 'en', 'zh', 'ko', 'vi', 'id'));

COMMENT ON COLUMN users.locale IS 'Preferred UI locale for the app.';
COMMENT ON COLUMN cases.locale IS 'Locale snapshot for the SOS user at case creation time.';
