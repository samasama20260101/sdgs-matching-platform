-- 問い合わせテーブル
CREATE TABLE IF NOT EXISTS inquiries (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    display_id      text UNIQUE NOT NULL,  -- INQ-00001形式
    user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
    role            text CHECK (role IN ('SOS', 'SUPPORTER')),  -- ログイン時のみ
    -- 未ログイン時の入力項目
    name            text,
    email           text NOT NULL,
    organization    text,
    phone           text,
    -- 共通
    category        text NOT NULL,
    message         text NOT NULL,
    -- 管理者用
    status          text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'CLOSED')),
    admin_memo      text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- display_id採番用シーケンス
CREATE SEQUENCE IF NOT EXISTS inquiries_display_seq START 1;

-- display_id自動生成関数
CREATE OR REPLACE FUNCTION generate_inquiry_display_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.display_id := 'INQ-' || LPAD(nextval('inquiries_display_seq')::text, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー
DROP TRIGGER IF EXISTS set_inquiry_display_id ON inquiries;
CREATE TRIGGER set_inquiry_display_id
    BEFORE INSERT ON inquiries
    FOR EACH ROW
    WHEN (NEW.display_id IS NULL OR NEW.display_id = '')
    EXECUTE FUNCTION generate_inquiry_display_id();

-- updated_at自動更新
CREATE OR REPLACE FUNCTION update_inquiries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_inquiries_updated_at ON inquiries;
CREATE TRIGGER set_inquiries_updated_at
    BEFORE UPDATE ON inquiries
    FOR EACH ROW
    EXECUTE FUNCTION update_inquiries_updated_at();

-- RLS無効（service_roleのみアクセス）
ALTER TABLE inquiries DISABLE ROW LEVEL SECURITY;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_user_id ON inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at DESC);
