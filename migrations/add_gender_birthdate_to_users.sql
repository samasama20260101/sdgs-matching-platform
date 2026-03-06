-- usersテーブルに性別・生年月日を追加（SOS登録時必須）
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS birth_date date DEFAULT NULL;

-- gender は 'MALE' | 'FEMALE' | 'OTHER' の3値
