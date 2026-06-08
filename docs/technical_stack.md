# 技術セット

この文書は、明日もsamasama | SDGs Match の現在の技術構成をまとめたものです。

環境の作り方は `docs/environment_setup.md`、開発時の重要ルールは `AGENTS.md` を参照してください。

---

## 全体構成

このサービスは、主に以下の技術で構成されています。

| 領域 | 技術 | 役割 |
|---|---|---|
| Webアプリ | Next.js | 画面・API・ルーティング |
| 言語 | TypeScript | 型安全な開発 |
| UI | React / Tailwind CSS | フロントエンド表示 |
| DB | Supabase PostgreSQL | ユーザー、案件、メッセージ、支援団体情報の保存 |
| 認証 | Supabase Auth / GoTrue | ログイン、ユーザー管理 |
| AI | Google Gemini AI | SDGs分類、相談内容分析 |
| ホスティング | Vercel | Webアプリの公開、Cron実行 |
| 分析 | Google Analytics | アクセス解析 |
| バージョン管理 | GitHub | ソースコード管理、dev/main運用 |

---

## Webアプリ

### Next.js

使用バージョン:

```text
Next.js 16.1.5
```

App Router構成です。

主な役割:

- トップページ、ログイン、SOS画面、サポーター画面、管理画面の表示
- `/api/...` 配下のAPI実装
- Vercel上でのサーバーサイド処理
- Cronエンドポイントの提供

主なディレクトリ:

```text
src/app
src/app/api
src/components
src/lib
```

---

## フロントエンド

### React / TypeScript

画面はReactコンポーネントで構成されています。

TypeScriptを使うことで、データ型のミスを減らしながら開発します。

### Tailwind CSS

スタイルはTailwind CSS中心です。

このサービスでは、以下のような見た目を重視します。

- やさしい印象
- 読みやすさ
- スマホでの使いやすさ
- 過度に派手ではない安心感

### ブランド要素

ロゴやサービスアイコンは `public/brand/` と `src/components/icons/` にあります。

中心となるモチーフ:

```text
濃紺の角丸四角
ティールからブルーの涙型アイコン
明日もsamasama / SDGs MATCH
```

---

## DB / 認証

### Supabase

Supabaseは、以下の役割を持っています。

```text
PostgreSQL DB
認証
ユーザー管理
RLS
Storage候補
```

現在の主な環境:

| 環境 | 用途 | Project ref |
|---|---|---|
| Staging | 開発・検証 | `fzawgdmqewmwdqjsqjwt` |
| Production | 本番 | `dqiqwclgzxhjxpotflvz` |

Productionのproject refは作業直前にSupabase Dashboard、Vercel環境変数、CLI表示で必ず再確認します。

### サポーター団体DB刷新

Stagingでは、サポーターを個人ではなく団体単位で扱うDB刷新を適用済みです。
Productionには未適用です。

主なテーブル:

| テーブル | 役割 |
|---|---|
| `organizations` | サポーター団体の正本 |
| `organization_memberships` | 個人ユーザーと団体の所属 |
| `case_internal_notes` | サポーター内部メモ |
| `supporter_service_areas` | 団体の活動地域 |

主な設計:

- `users` はログインする個人。
- 団体プロフィール、団体所在地、活動地域は `organizations` を中心に扱う。
- 所属ロールは `OWNER` / `ADMIN` / `MEMBER`。
- OWNERは複数可。最後のOWNERは停止・解除・降格できない。
- 1ユーザーの同時複数団体所属はDBで禁止。
- 団体内の所属停止は `organization_memberships.status = SUSPENDED` で表現し、`users.is_suspended` は管理者による全体アカウント停止専用にする。
- 団体の物理削除は避け、`ARCHIVED` 運用へ寄せる。

Production適用手順は `docs/production_supporter_db_refresh_runbook.md` を参照します。

### Supabase Admin Client

サーバーサイドAPIでは、基本的に `supabaseAdmin` を使います。

理由:

```text
RLSの影響で、anon keyでは必要なDB操作が拒否される場合があるため
```

該当ファイル:

```text
src/lib/supabase/server.ts
```

注意:

```text
service_role key はサーバー専用
クライアント側に絶対に出さない
```

API Routeでは、`supabaseAdmin` を使う前に必ず認証・認可を確認します。
新規APIでは `src/lib/api/auth.ts` の `requireActiveAppUser()` を優先して使います。

詳細な設計方針は `docs/api_security_design.md` を参照します。

### Supabase Client

ブラウザ側ではanon keyのSupabase clientを使います。

該当ファイル:

```text
src/lib/supabase/client.ts
```

ブラウザ側のanon clientは、認証・セッション取得に使います。
相談、メッセージ、団体、管理情報などのDB読み書きは、Next.js API Route経由で行います。

ブラウザからSupabase Realtimeの `postgres_changes` を直接購読する実装は避けます。
通知や未読管理は、将来的に専用API・専用テーブルで扱います。

---

## AI

### Google Gemini AI

現在はGeminiを使って、主に相談内容のSDGs分類を行っています。

該当ファイル:

```text
src/lib/gemini.ts
```

現在の主な用途:

- 相談内容からSDGsゴールを分類
- 相談内容の要約
- フォローアップ質問生成
- マッチングスコア計算の土台

今後検討しているAI活用:

- 支援団体ピックアップAgent
- SDGs / GI分類Agent
- 運営向け新規案件要約
- サポーター向け案件要約
- 個人情報・危険表現チェック

---

## Vercel

VercelはWebアプリのホスティングとCron実行に使います。

現在ローカルCLIでリンクしている候補:

```text
stanabe/sdgs-matching-platform-czna
```

Vercelには似た名前のプロジェクトが複数あるため、デプロイ設定やGit連携先はDashboardで確認が必要です。

### メンテナンスモード

DB変更など本番作業中は、Vercel環境変数でメンテナンスモードを有効にします。

| 環境変数 | 役割 |
|---|---|
| `MAINTENANCE_MODE` | `true` のとき通常画面を `/maintenance` へ誘導 |
| `MAINTENANCE_BYPASS_TOKEN` | 運営確認用の一時バイパス |

メンテナンスモードは強制ログアウトを行いません。
ユーザーセッションを保持したまま、作業中だけ画面/API操作を止めます。

関連ファイル:

```text
src/proxy.ts
src/app/maintenance/page.tsx
src/app/api/health/route.ts
src/app/api/maintenance-bypass/route.ts
docs/maintenance_mode.md
```

### Vercel Cron

すでにCronが使われています。

該当ファイル:

```text
vercel.json
```

現在のCron:

```text
/api/cron/auto-close-cases
```

用途:

- サポーター解決報告から14日経過した案件をRESOLVEDへ
- MATCHEDのまま14日無活動の案件をCLOSEDへ

今後追加候補:

- 1時間ごとの新規案件運営通知
- 深夜のSDGs/GI分類バッチ
- 未対応案件の運営アラート

---

## Git / GitHub

開発ブランチ運用:

```text
dev
→ Staging確認
→ Pull Request
→ main
→ Production
```

現在のGit remoteはSSHです。

```text
git@github.com:samasama20260101/sdgs-matching-platform.git
```

GitHub CLIもSSH protocolで設定済みです。

```bash
gh auth status -h github.com
```

---

## 現在の主な画面

| ロール | 主な画面 |
|---|---|
| SOS | `/sos/dashboard` |
| SUPPORTER | `/supporter/dashboard` |
| ADMIN | `/admin/dashboard` |
| 公開 | `/`, `/supporters`, `/story`, `/contact` |

---

## 現在の主なAPI

| API | 役割 |
|---|---|
| `/api/auth/get-role` | ログインユーザーのロール取得 |
| `/api/auth/signup` | SOSユーザー登録 |
| `/api/sos/cases` | SOS案件作成・取得 |
| `/api/supporter/dashboard` | サポーターダッシュボード |
| `/api/supporter/members` | 団体メンバー管理 |
| `/api/supporter/service-areas` | 団体活動地域管理 |
| `/api/supporter/cases/[id]/internal-notes` | サポーター内部メモ |
| `/api/admin/regions` | 地域コード追跡 |
| `/api/messages` | メッセージ取得・送信 |
| `/api/public/supporters` | 公開サポーター一覧 |
| `/api/public/stats` | 公開実績カウント |
| `/api/health` | メンテナンス中も使えるヘルスチェック |
| `/api/maintenance-bypass` | 運営確認用メンテナンスバイパス |
| `/api/cron/auto-close-cases` | 自動RESOLVED/CLOSED処理 |

---

## 今後の拡張予定と技術方針

### 支援団体ピックアップAgent

目的:

```text
相談登録直後に、合いそうな支援団体をすぐ表示する
```

技術方針:

```text
Geminiで軽量分類
Supabaseで地域・SDGs・全国対応・実績を検索
Next.js APIで即時返却
CronはPhase 1では使わない
```

### SDGs / GI分類Agent

目的:

```text
解決済み案件がどのSDGs/GIに貢献したかを分類する
```

技術方針:

```text
サポーターが解決時にGOALを選択
GI候補をわかりやすい言葉で提示
SOS解決確定後に夜間バッチでAI最終分類
Vercel Cron + Supabase + Geminiで処理
```

---

## 本番環境の扱い

本番環境は実ユーザーに影響します。

そのため、以下は必ず事前確認します。

```text
Production DBへのSQL実行
Production DBへのdb push
本番環境変数の変更
RLS変更
Authユーザー操作
一括更新・削除
```

通常作業は以下で行います。

```text
devブランチ
Staging Supabase
Staging / Preview環境
```

---

## 関連ドキュメント

| ファイル | 内容 |
|---|---|
| `AGENTS.md` | 開発ルール・サービス思想・本番保護ルール |
| `docs/environment_setup.md` | ローカル環境セットアップ手順 |
| `docs/technical_stack.md` | この文書 |
| `docs/api_security_design.md` | API認可・Supabase key・AI API・通知設計方針 |
| `docs/maintenance_mode.md` | メンテナンスモード運用 |
| `docs/production_supporter_db_refresh_runbook.md` | Productionサポーター団体DB刷新手順 |
| `docs/staging_role_function_test_spec.md` | Stagingロール別機能仕様・テスト観点 |
