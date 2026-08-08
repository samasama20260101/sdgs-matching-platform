-- Case and chat translation storage.
-- Staging first. Production application requires maintenance mode and runbook checks.

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS description_free_ja text NULL;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS source_locale text NOT NULL DEFAULT 'ja'
    CHECK (source_locale IN ('ja', 'en', 'zh', 'ko', 'vi', 'id')),
  ADD COLUMN IF NOT EXISTS translated_content text NULL,
  ADD COLUMN IF NOT EXISTS translation_status text NOT NULL DEFAULT 'NONE'
    CHECK (translation_status IN ('NONE', 'DONE', 'PENDING', 'FAILED')),
  ADD COLUMN IF NOT EXISTS translation_attempts smallint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_messages_translation_pending
  ON messages (created_at)
  WHERE translation_status = 'PENDING';

COMMENT ON COLUMN cases.description_free_ja IS 'Japanese translation of description_free for non-Japanese cases.';
COMMENT ON COLUMN messages.source_locale IS 'Locale of the original message content.';
COMMENT ON COLUMN messages.translated_content IS 'Stored one-time AI translation for the other side of the case language pair.';
COMMENT ON COLUMN messages.translation_status IS 'NONE, DONE, PENDING, or FAILED.';
COMMENT ON COLUMN messages.translation_attempts IS 'Retry count for cron-based translation recovery.';
