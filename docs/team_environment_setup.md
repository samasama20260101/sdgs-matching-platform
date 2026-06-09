# メンバー向け環境セットアップ

この文書は、新しいメンバーが `明日もsamasama | SDGs Match` の開発・確認に参加するための手順です。

メンバーのスキル差があっても事故が起きにくいように、通常開発、本番読み取り、本番操作を分けて説明します。

---

## 最初に守ること

このプロジェクトでは、開発環境と本番環境を明確に分けます。

| 種類 | 原則 | 使う環境 |
|---|---|---|
| 通常開発 | 画面修正・API修正・DB migration作成 | `dev` branch + Supabase Staging |
| 動作確認 | Stagingでロール別テスト | Staging Vercel + Supabase Staging |
| 本番読み取り | 障害調査・件数確認・状態確認のみ | Production Supabase read-only |
| 本番操作 | SQL実行・データ更新・Auth操作・環境変数変更 | 代表者の明示許可 + runbook |

本番の読み取り権限でも、相談内容、メッセージ、個人情報に触れる可能性があります。
読み取り専用だから安全、とは考えません。

---

## 権限レベル

全員に同じ権限を渡さず、役割に応じて分けます。

| レベル | 対象者 | できること | 渡してよいもの |
|---|---|---|---|
| Level 1: 通常開発者 | 画面・通常機能を開発する人 | GitHub、Staging確認、Staging DB確認 | Staging用 `.env.local` |
| Level 2: 本番参照者 | 障害調査や本番状態確認を行う人 | Production DBのSELECT、Vercel/GitHub状況確認 | Production read-only接続情報 |
| Level 3: 本番作業者 | DB変更・リリース作業を行う人 | 承認済みSQL、環境変数変更、runbook作業 | 必要最小限の本番操作権限 |

Level 1の人にProductionの `service_role key` を渡してはいけません。
Level 2の人にも、原則としてProductionの `service_role key` は渡しません。

---

## 環境の全体像

| 項目 | Staging | Production |
|---|---|---|
| Git branch | `dev` | `main` |
| Supabase ref | `fzawgdmqewmwdqjsqjwt` | `dqiqwclgzxhjxpotflvz` |
| Supabase URL | `https://fzawgdmqewmwdqjsqjwt.supabase.co` | `https://dqiqwclgzxhjxpotflvz.supabase.co` |
| Vercel URL | `https://sdgs-matching-platform-git-dev-samasama.vercel.app` | `https://sdgs-matching-platform-taupe.vercel.app` / `https://app.samasama.site` |

Productionのproject refは、本番作業や本番読み取りの直前に必ず画面上でも確認します。

---

## 1. GitHub / Git

### 必要なもの

- GitHubアカウント
- リポジトリへの権限
- Git
- GitHub CLI `gh`
- SSH鍵

### 初回設定

```bash
ssh-keygen -t ed25519 -C "your-name-samasama"
cat ~/.ssh/id_ed25519.pub
```

表示された公開鍵をGitHubに登録します。

```text
GitHub → Settings → SSH and GPG keys → New SSH key
```

接続確認:

```bash
ssh -T git@github.com
```

GitHub CLI:

```bash
gh auth login --hostname github.com --web
gh config set git_protocol ssh --host github.com
```

リポジトリ取得:

```bash
mkdir -p ~/samasama
cd ~/samasama
git clone git@github.com:samasama20260101/sdgs-matching-platform.git
cd sdgs-matching-platform
git checkout dev
```

確認:

```bash
git remote -v
git branch --show-current
gh auth status -h github.com
```

期待する状態:

```text
origin git@github.com:samasama20260101/sdgs-matching-platform.git
branch: dev
Git operations for github.com configured to use ssh protocol
```

---

## 2. ローカル開発環境

### 推奨

- Ubuntu / WSL Ubuntu
- Node.jsは `nvm` で管理
- 作業ディレクトリは `~/samasama/sdgs-matching-platform`

### Node.js

```bash
cd ~/samasama/sdgs-matching-platform
source ~/.nvm/nvm.sh
npm install
```

確認:

```bash
node -v
npm -v
```

開発サーバー:

```bash
npm run dev
```

PowerShellから `\\wsl.localhost\...` のパスで直接 `npm` を実行すると、Windows側のNode/npmを拾うことがあります。
基本はWSLターミナルで実行してください。

---

## 3. `.env.local`

`.env.local` はローカルPC専用の秘密情報です。
Gitにコミットしてはいけません。

通常開発者は、Staging用の値だけを入れます。

```bash
# Supabase Staging
NEXT_PUBLIC_SUPABASE_URL=https://fzawgdmqewmwdqjsqjwt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=STAGING_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=STAGING_SERVICE_ROLE_KEY

# AI / Cron / local development
GOOGLE_GEMINI_API_KEY=STAGING_OR_DEV_GEMINI_KEY
CRON_SECRET=STAGING_CRON_SECRET
DEV_PASSWORD=LOCAL_DEV_PASSWORD
```

本番読み取りが必要な人だけ、別名でProduction read-only接続情報を追加します。
アプリ本体はこの変数を使いません。調査用コマンドだけで使います。

```bash
# Production read-only diagnostics only
SUPABASE_PROD_READONLY_DATABASE_URL=postgresql://app_prod_readonly:PASSWORD@HOST:PORT/postgres
```

禁止:

```text
Productionのservice_role keyを通常開発者のPCに入れる
Production URLをStaging用のSUPABASE_SERVICE_ROLE_KEYと混ぜる
本番確認のためにNEXT_PUBLIC_SUPABASE_URLを気軽にProductionへ差し替える
.env.localをGitHub、Slack、チャットへ貼る
```

---

## 4. Supabase Staging

通常開発ではSupabase CLIをStagingへリンクします。

```bash
npx supabase login
npx supabase link --project-ref fzawgdmqewmwdqjsqjwt
```

確認:

```bash
npx supabase projects list
```

期待する状態:

```text
sdgs-staging / fzawgdmqewmwdqjsqjwt に LINKED が付いている
```

`supabase/.temp/` はPCごとのリンク情報です。
Gitに入れてはいけません。

---

## 5. Production読み取り

Production読み取りは、障害調査やリリース前後の確認に使います。
通常の開発作業には使いません。

### 推奨方針

最初は以下のどちらかにします。

| 方法 | 向いている人 | 特徴 |
|---|---|---|
| Supabase Dashboardで必要なSELECTだけ実行 | SQLに不慣れな人、単発確認 | 操作画面で対象Projectを確認しやすい |
| `SUPABASE_PROD_READONLY_DATABASE_URL` でpsql接続 | 調査担当、Codexに確認させる人 | コマンドで再現しやすい |

どちらの場合も、本番に対する `INSERT` / `UPDATE` / `DELETE` / `ALTER` / `DROP` / `TRUNCATE` は禁止です。

### 本番読み取り用DBユーザー

Production読み取りには、専用のread-onlyユーザーを使います。
作成は代表者または本番作業者だけが行います。

例:

```sql
-- 実行対象: Production Supabase
-- 実行者: 代表者または本番作業者のみ

CREATE ROLE app_prod_readonly
  LOGIN
  PASSWORD 'CHANGE_ME_TO_A_STRONG_PASSWORD'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE;

GRANT USAGE ON SCHEMA public TO app_prod_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_prod_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO app_prod_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO app_prod_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO app_prod_readonly;
```

注意:

- このユーザーに `service_role` 権限を渡してはいけません。
- `auth` schemaは原則読ませません。
- RLSが有効なテーブルは、通常のread-only権限だけでは見えない行があります。
- 個人情報や相談本文まで見える権限を作る場合は、対象者をさらに限定します。

RLSを越えた運用確認が必要な場合は、いきなり全テーブルのRLS回避権限を与えるのではなく、集計用viewや診断用viewを作る方が安全です。
どうしても全体読取が必要な場合は、目的、対象者、期間、監査方法を決めてから別途承認します。

### psqlでの確認

`psql` がない場合:

```bash
sudo apt update
sudo apt install -y postgresql-client
```

接続確認:

```bash
psql "$SUPABASE_PROD_READONLY_DATABASE_URL" -c "select current_user, now();"
```

安全な確認例:

```bash
psql "$SUPABASE_PROD_READONLY_DATABASE_URL" -c "select role, count(*) from public.users group by role order by role;"
psql "$SUPABASE_PROD_READONLY_DATABASE_URL" -c "select status, count(*) from public.cases group by status order by status;"
```

避ける確認:

```sql
select * from public.messages;
select * from public.users;
select * from public.cases;
```

本文や個人情報を大量に出力しないでください。
必要な場合でも、`count(*)`、`status`別集計、`limit 5`、マスキングを優先します。

---

## 6. Vercel

### CLI設定

```bash
npm install -g vercel@latest
vercel login
vercel link
```

確認:

```bash
vercel whoami
vercel project ls
vercel env ls
vercel ls sdgs-matching-platform-czna
```

`vercel whoami` は、Teamではなくログイン中の個人ユーザー名を表示します。
企業Team配下のProjectを扱うときは、Team scopeを明示します。

```bash
vercel teams ls
vercel project ls --scope samasama
vercel ls sdgs-matching-platform --scope samasama
```

このリポジトリのVercel Teamは以下です。

```text
scope: samasama
```

Project名はVercel Dashboardで確認します。
通常は `sdgs-matching-platform` を想定しますが、似た名前のProjectがある場合はGit連携branch、環境変数、公開URLで照合します。

もし違うTeamや個人Projectにリンクされている場合は、明示的にリンクし直します。

```bash
vercel link --yes --project sdgs-matching-platform --scope samasama
```

Vercel CLIで環境変数名は確認できますが、値そのものは慎重に扱います。
`vercel env pull` でProduction secretsをメンバーPCへ落とす運用は、原則避けます。

### 確認すること

| 確認 | 見る場所 |
|---|---|
| dev pushがStagingへ出ているか | Vercel Deployments |
| main mergeがProductionへ出ているか | Vercel Deployments |
| Production URLが正しいか | Vercel Project Settings / Domains |
| メンテナンスモード | Vercel Environment Variables |

---

## 7. Codex / AIアシスタントに確認させる場合

Codexに状況確認を依頼する場合も、権限の境界は同じです。

### できること

| 対象 | できる確認 |
|---|---|
| Git | branch、差分、commit、push状態 |
| GitHub | PR、commit、branch、CI状況 |
| Vercel | deployment、build log、環境変数名、公開URL |
| Supabase Staging | DB状態、テストデータ、migration確認 |
| Supabase Production | read-only接続でSELECT確認 |

### 依頼するときの書き方

Stagingだけ見てよい場合:

```text
Staging Supabaseだけ確認してください。本番DBは見ないでください。
```

本番読み取りも許可する場合:

```text
Production Supabaseは読み取りのみ許可します。
Project refは dqiqwclgzxhjxpotflvz です。
SELECTのみで、本文や個人情報の大量出力は避けてください。
```

本番操作が必要な場合:

```text
Production DBに対するSQL実行を検討します。
実行前にProject ref、SQL全文、影響範囲、rollback方針を提示してください。
私が明示的に許可するまで実行しないでください。
```

秘密情報はチャットへ貼らず、ローカルの `.env.local`、パスワード管理ツール、または各サービスの権限管理で渡します。

---

## 8. 初日チェックリスト

### 全員

- [ ] GitHubリポジトリにアクセスできる
- [ ] SSHで `git pull` / `git push` ができる
- [ ] `dev` branchで作業している
- [ ] `npm install` が成功する
- [ ] `npm run dev` でローカル画面が開く
- [ ] `.env.local` があり、Gitに出ていない
- [ ] Staging URLで画面確認ができる

### 調査担当

- [ ] Vercel CLIまたはVercel DashboardでDeploymentsを確認できる
- [ ] Supabase Stagingを確認できる
- [ ] Production read-onlyの接続情報を持っている
- [ ] Production read-onlyで `select current_user, now();` が成功する
- [ ] Productionで書き込みSQLを実行しないルールを理解している

### 本番作業者

- [ ] `docs/production_supporter_db_refresh_runbook.md` を読んでいる
- [ ] Production project refをDashboardで確認できる
- [ ] メンテナンスモードの有効化・解除手順を理解している
- [ ] SQL実行前に、Project ref、SQL全文、影響範囲、rollback方針を提示できる

---

## 9. よくあるミス

### 間違ったbranchで作業している

確認:

```bash
git branch --show-current
```

通常開発は `dev` です。
`main` へ直接pushしてはいけません。

### StagingとProductionのURLを混ぜる

`.env.local` の `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` は同じ環境のものを使います。
Staging URLにProduction service_role、またはその逆を混ぜてはいけません。

### Production read-onlyをアプリ用環境変数に入れる

`SUPABASE_PROD_READONLY_DATABASE_URL` は調査用です。
Next.jsアプリの通常起動では使いません。

### UUIDエラー

`invalid input syntax for type uuid: ""` は、空文字や不正なIDがDBへ渡ったときに起きます。
新規APIでは、DBへ渡す前に `src/lib/api/validation.ts` で検証します。

### Supabase migration履歴テーブルのエラー

`relation "supabase_migrations.schema_migrations" does not exist` は、Supabase CLIのmigration履歴テーブルが対象DBにない、またはCLI管理外のDBを見ている可能性があります。
本番ではいきなり `db push` せず、runbookとProject ref確認を優先します。

---

## 10. 関連ドキュメント

| ファイル | 内容 |
|---|---|
| `AGENTS.md` | 開発ルール、サービス思想、本番保護ルール |
| `docs/environment_setup.md` | 現在のローカル環境で実施済みのセットアップ記録 |
| `docs/technical_stack.md` | 技術構成 |
| `docs/api_security_design.md` | API認可、Supabase keyの使い分け |
| `docs/supabase_io_and_db_access_guidelines.md` | DBアクセス量、Disk IO、ポーリング設計 |
| `docs/maintenance_mode.md` | メンテナンスモード運用 |
| `docs/staging_role_function_test_spec.md` | Stagingロール別テスト仕様 |
| `docs/production_supporter_db_refresh_runbook.md` | Production DB刷新手順 |
