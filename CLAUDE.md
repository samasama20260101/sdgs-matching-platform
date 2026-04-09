# CLAUDE.md — 明日もsamasama | SDGs Match

Claudeがこのプロジェクトで作業する際に必ず参照するドキュメント。

---

## プロジェクト概要

**サービス名**: 明日もsamasama | SDGs MATCH
**運営**: 合同会社ｓａｍａｓａｍａ
**目的**: 社会的困難を抱えるSOSユーザーと、NPO・行政・企業（サポーター）をAIでマッチングするプラットフォーム
**対象地域**: 日本・インドネシア（グローバル展開を視野に）
**未成年定義**: 18歳未満（SDGs/国連子どもの権利条約 CRC基準）

---

## 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 16.1.5（App Router） |
| 言語 | TypeScript |
| DB / Auth | Supabase（PostgreSQL + GoTrue） |
| ホスティング | Vercel Pro |
| AI | Google Gemini AI（SDGsタグ付け） |
| アナリティクス | Google Analytics G-8S5GP8P7EZ |

---

## 環境情報

### Supabase
| 環境 | Project ID | URL |
|---|---|---|
| Staging | fzawgdmqewmwdqjsqjwt | https://fzawgdmqewmwdqjsqjwt.supabase.co |
| Production | dqiqwclgzxhjxpotflvz | https://dqiqwclgzxhjxpotflvz.supabase.co |

### Vercel
| 環境 | URL |
|---|---|
| Staging | https://sdgs-matching-platform-git-dev-samasama.vercel.app |
| Production | https://sdgs-matching-platform-taupe.vercel.app |

### GitHub
- Org: samasama20260101
- リポジトリ: https://github.com/samasama20260101/sdgs-matching-platform
- devブランチ: 開発用（Stagingに自動デプロイ）
- mainブランチ: 本番用（PR必須・直接pushは不可）

### ローカル開発
- OS: Ubuntu + VSCode
- パス: ~/samasama/sdgs-matching-platform
- 環境変数ファイル: .env.local

### 管理者アカウント（Staging）
- メール: x25660@yahoo.co.jp
- 管理者ログインURL: /admin/login

---

## ユーザーロール

| ロール | 説明 | ダッシュボード |
|---|---|---|
| SOS | 相談者（支援を求める人） | /sos/dashboard |
| SUPPORTER | 支援者（NPO・行政・企業） | /supporter/dashboard |
| ADMIN | 管理者 | /admin/dashboard |

---

## 重要な技術的知見（必読）

### 1. RLSバイパスパターン
サーバーサイドAPIルートは必ず supabaseAdmin（service_role key）を使う。
クライアントの anon key は RLS により auth.uid() が NULL になりアクセス拒否される。

### 2. テストユーザー作成
SQL直接挿入では GoTrue の auth.identities が作られずログインできない。
必ず supabaseAdmin.auth.admin.createUser() を使うこと。

実行コマンド:
NEXT_PUBLIC_SUPABASE_URL=https://fzawgdmqewmwdqjsqjwt.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6YXdnZG1xZXdtd2RxanNxand0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk4MzU5OCwiZXhwIjoyMDg5NTU5NTk4fQ.tm5dMs3vhSOEpoYd2NuEcIZb3OHTSFE6AodYGjNB4sg \
npx tsx scripts/create-test-users.ts

削除順序（外部キー制約）: messages → offers → cases → public.users → auth.users

### 3. Next.js 16 の params は Promise
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}

### 4. 地域クエリ
regions テーブルへの FK JOIN は使わない。必ず2ステップクエリで取得する。

### 5. use client ディレクティブ
ファイルの最初の行（コメントより後、importより前）に記述すること。

### 6. Supabaseのbcryptハッシュ形式
GoTrue は $2a$ 形式を期待する。Python の bcrypt は $2b$ を生成するため変換が必要。
SQLでのパスワード直接設定は不安定。Admin APIを使うこと。

---

## ブランチ運用

機能開発 → devブランチ → Staging自動デプロイ → テスト確認 → PR → mainマージ → Production

- devへは直接 push 可
- mainへは PR 必須（ブランチ保護ルール）
- PRはGitHub画面から作成: https://github.com/samasama20260101/sdgs-matching-platform/compare/main...dev

---

## 文字数制限（全フォーム実装済み）

| フォーム | フィールド | 上限 |
|---|---|---|
| ログイン | メールアドレス | 254文字 |
| パスワード忘れ | メールアドレス | 254文字 |
| パスワードリセット・変更 | パスワード | 64文字 |
| 新規登録 | メールアドレス | 254文字 |
| 新規登録 | パスワード | 64文字 |
| 新規登録 | お名前・表示名 | 64文字 |
| 新規登録 | 電話番号 | 20文字 |
| 相談登録 | Q1〜Q5 その他 | 200文字 |
| 相談登録 | いま何が起きているか | 1000文字 |
| 相談登録 | いつから・どうなりたいか | 200文字 |
| お問い合わせ | お名前 | 64文字 |
| お問い合わせ | メールアドレス | 254文字 |
| お問い合わせ | 組織名 | 64文字 |
| お問い合わせ | 電話番号 | 20文字 |
| お問い合わせ | 詳細 | 1000文字 |
| プロフィール | お名前・ニックネーム・表示名 | 64文字（カウンター付き） |
| プロフィール | 組織名 | 64文字（カウンター付き） |
| プロフィール | 電話番号 | 20文字（カウンター付き） |
| プロフィール | 自己紹介文 | 500文字 |
| プロフィール | SNS外部リンク | 500文字 |
| 住所 | 都道府県/Province | 50文字 |
| 住所 | 市区町村/City | 50文字 |
| 住所 | 番地・ビル名 | 100文字 |
| 住所 | 部屋番号 | 100文字 |
| サポーター作成（管理画面） | 組織名・担当者名・表示名 | 64文字 |
| サポーター作成（管理画面） | メール | 254文字 |
| サポーター作成（管理画面） | パスワード | 64文字 |
| サポーター作成（管理画面） | 電話番号 | 15桁（ハイフン除去） |
| サポーター申し出 | メッセージ | 1000文字（カウンター付き） |
| 管理者メモ | 対応記録 | 2000文字 |

---

## DBスキーマ補足（Staging・Production両方に適用済み）

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false;

ALTER TABLE supporter_badges
ADD CONSTRAINT supporter_badges_unique
UNIQUE (case_id, supporter_user_id, badge_key);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

---

## 重要なファイル一覧

| ファイル | 役割 |
|---|---|
| src/lib/utils/age.ts | 未成年判定（18歳未満、SDGs基準） |
| src/lib/supabase/server.ts | supabaseAdmin（service_role） |
| src/lib/supabase/client.ts | supabase（anon key、シングルトン） |
| src/lib/constants/sdgs.ts | 定数一元管理（MAX_SUPPORTERS_PER_CASE など） |
| src/components/form/AddressForm.tsx | 住所フォーム共通コンポーネント |
| src/components/layout/Header.tsx | ヘッダー（スマホ用ハンバーガーメニュー実装済み） |
| src/components/ui/toast.tsx | トースト通知（重複防止済み） |
| scripts/create-test-users.ts | テストユーザー一括作成スクリプト |
| src/app/api/admin/users/[id]/route.ts | ユーザー停止・削除API（signOut globalで即時反映） |
| src/app/api/zipcode/route.ts | 郵便番号検索（zipcloud + HeartRailsフォールバック） |

---

## display_id（ユーザー一意ID）

### フォーマット

| ロール | 形式 | 例 |
|---|---|---|
| SOS | `S-` + 6桁ゼロ埋め | `S-000001` |
| SUPPORTER | `P-` + 6桁ゼロ埋め | `P-000001` |
| ADMIN | `A-` + 6桁ゼロ埋め | `A-000001` |

- 最大 999,999 人対応
- PostgreSQL シーケンスで採番（同時登録でも重複なし）

### Supabase に作成済みのオブジェクト（Staging・Production 両方）

```sql
-- シーケンス
seq_display_id_sos
seq_display_id_supporter
seq_display_id_admin

-- 採番関数（APIから呼び出す）
generate_display_id(p_role TEXT) RETURNS TEXT
```

### 採番タイミング

- SOS 登録時: `api/auth/signup/route.ts` で `generate_display_id('SOS')` を呼び出し
- サポーター登録時: `api/admin/create-supporter/route.ts` で `generate_display_id('SUPPORTER')` を呼び出し

### Production へ展開するときの注意

Production の Supabase でも同じ SQL を実行する必要がある：
1. シーケンス3本の作成
2. `generate_display_id` 関数の作成
3. 既存ユーザーへの一括採番（本番ローンチ前はユーザー0なので不要）

---

## ケースのステータス遷移（重要）

```
OPEN → MATCHED → RESOLVED
         ↓
      CANCELLED（取り消し）
```

- **OPEN**: サポーター待ち（申し出受付中）
- **MATCHED**: 1名以上のサポーターが承認された = 支援進行中（マッチ＝支援開始）
- **RESOLVED**: SOS ユーザーが解決を確認した
- **CANCELLED / CLOSED**: 取り消し・自動クローズ

⚠️ **IN_PROGRESS は廃止済み**。過去の DB データに IN_PROGRESS が残っていても画面には表示されない（OPEN/MATCHED/RESOLVED 以外は else 扱い）。

---

## サポーター承認上限（重要）

**上限数の定義は1箇所のみ**:

```typescript
// src/lib/constants/sdgs.ts
export const MAX_SUPPORTERS_PER_CASE = 2  // ← ここだけ変えれば全体に反映
```

現在は **2名**。将来3名に拡張する場合はこの数値を変えるだけでよい。
この定数を import しているファイル: `api/sos/offers/[id]/route.ts`、`api/supporter/cases/[id]/offer/route.ts`、`api/supporter/dashboard/route.ts`、`supporter/case/[id]/page.tsx`、`sos/result/[id]/page.tsx`

### サポーターの主/副ロール

- `offers.accepted_order`（承認時に付番）の昇順で主/副が決まる
- 最小 `accepted_order` を持つサポーター = **主**（解決報告ボタンが表示される）
- 主が離脱（WITHDRAWN）すると次の `accepted_order` が自動的に主になる
- accepted_order は欠番が生じても問題なし（絶対値でなく相対順位で判定）

### 評価バッジ（解決時に自動付与）

- 主（最小 accepted_order）→ 🥇 金メダル
- 副（それ以降）→ 🥈 銀メダル
- `sos/result/[id]/page.tsx` の `handleResolveCase` 内で `accepted_order` 昇順ソート後に付与

### サポーターのオファー状態とダッシュボード表示ルール

| オファー状態 | 満員（上限到達） | 空きあり |
|---|---|---|
| ACCEPTED / PENDING | 常に表示 | 常に表示 |
| WITHDRAWN / DECLINED | **非表示** | 表示（再申し出可） |
| 未オファー | **非表示** | 表示 |

---

## 実装済み機能一覧

- SOSユーザー新規登録・ログイン
- 相談登録（Q1〜Q5 + 自由記述）
- AI分析（Google Gemini）でSDGsタグ付け（Q1〜Q5 + 自由記述を統合して送信）
- AIローディング演出（ステップ表示・30秒タイムアウト）
- サポーターマッチング・申し出・承認（上限 MAX_SUPPORTERS_PER_CASE 名）
- 承認上限到達時に残りのPENDINGを自動DECLINED
- 取り下げ済みオファーの承認防止
- サポーターが承認後に対応をキャンセル可能（WITHDRAWN → 残数0ならOPENに巻き戻し）
- 主/副サポーター制（accepted_order 昇順）・主離脱時の自動繰り上がり
- 解決報告は主サポーターのみ可能、SOS側で確認してRESOLVED
- 解決時の自動バッジ付与（主→金メダル、副→銀メダル、accepted_order 昇順で判定）
- メッセージ機能（承認済みサポーター全員と共有）
- 未成年バッジ（サポーター案件一覧・詳細・管理画面）
- SOSダッシュボード地域未登録バナー
- 管理画面ユーザー停止・削除（signOut globalでセッション即時無効化）
- Google Analytics（全ページ・layout.tsxに1箇所）
- プライバシーポリシー・利用規約（正式版）
- スマホ用ハンバーガーメニュー（md以上でPC表示）
- 郵便番号検索（官公庁対応・HeartRailsフォールバック）
- 全フォーム文字数制限・カウンター表示

---

## テストユーザー（Staging）

| 種別 | メール形式 | 例 |
|---|---|---|
| SOS | sos01〜20@gmail.com | 大谷翔平〜荻原次晴（スポーツ選手） |
| 行政 | gov01〜05@gmail.com | 東京都・大阪府など |
| NPO | npo01〜05@gmail.com | 織田信長NPOなど（戦国武将） |
| 企業 | corp01〜05@gmail.com | ソフトバンク・トヨタなど |

パスワード: testpass123（全員共通）
注意: 本番デプロイ前に必ず削除すること

---

## ローンチ前必須タスク

- [ ] Staging テストデータの削除
- [ ] DEV_PASSWORD を Vercel 環境変数から削除
- [ ] Production Supabase の Email Confirm 有効化
- [ ] Production の管理者ユーザー登録
- [ ] Google Analytics 動作確認
- [ ] Production Supabase で display_id 関連 SQL を実行（シーケンス3本 + generate_display_id 関数）

---

## Cron ジョブ（自動処理）

`vercel.json` に設定済み。毎日午前2時（本番環境のみ自動実行）。

### 処理内容（`api/cron/auto-close-cases/route.ts`）

| 処理 | 条件 | 結果 |
|---|---|---|
| 処理1 | `supporter_resolved_at` から14日経過 | `RESOLVED` |
| 処理2 | `MATCHED` のまま最終メッセージから14日無活動 | `CLOSED` |

処理2の判定：最終メッセージ日時が14日以上前（メッセージ0件の場合は `cases.updated_at` を起点にする）

### Staging でのテスト方法

```bash
curl -X GET \
  "https://sdgs-matching-platform-git-dev-samasama.vercel.app/api/cron/auto-close-cases" \
  -H "Authorization: Bearer <CRON_SECRETの値>"
```

### 環境変数

`CRON_SECRET` — Vercel の Environment Variables に設定済み（Production + Preview）

---

## 未実装・保留事項

- スマホ向けアプリ化（将来対応予定）
- サポーター承認上限を 2名 → 3名に拡張（`MAX_SUPPORTERS_PER_CASE = 3` 1行変更のみ）
- サポーター公開ページの写真・ロゴ掲載機能（Supabase Storage使用、設計済み）
- favicon・apple-touch-icon・OGP画像の差し替え（`public/brand/` に素材あり）
