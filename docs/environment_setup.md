# 環境セットアップ手順

この文書は、明日もsamasama | SDGs Match の開発環境について、何を設定したか、何ができるようになったか、次回どう再現するかをまとめたものです。

専門用語に慣れていない人でも追えるように、まず全体像から説明します。

---

## まず知っておくこと

このプロジェクトには、大きく分けて3つの外部サービスがあります。

| サービス | 役割 | 今回できるようにしたこと |
|---|---|---|
| GitHub / Git | ソースコードの保管場所 | SSHで安全にpushできるようにした |
| Vercel | Webアプリの公開・デプロイ | CLIでプロジェクト情報や環境変数を確認できるようにした |
| Supabase | DB・ログイン認証 | CLIでStaging DBにリンクできるようにした |

通常の開発は、以下の流れで行います。

```text
devブランチで開発
→ GitHubへpush
→ Stagingで確認
→ 問題なければmainへPR/merge
→ Productionへ反映
```

本番DBは実ユーザーに影響するため、絶対に慎重に扱います。

---

## 現在の環境

### ローカルPC

| 項目 | 内容 |
|---|---|
| OS | WSL Ubuntu |
| 作業ディレクトリ | `~/samasama/sdgs-matching-platform` |
| Node管理 | `nvm` |
| Node.js | `v24.13.0` |
| npm | `11.6.2` |
| Next.js | `16.1.5` |

WSLでは、作業前に以下を実行するとNode/npmが正しく使えます。

```bash
cd ~/samasama/sdgs-matching-platform
source ~/.nvm/nvm.sh
```

PowerShellから `\\wsl$\...` のパスで直接 `npm` を実行すると、Windows側のnpmを拾って失敗することがあります。開発コマンドはWSLターミナル内で実行してください。

---

## Git / GitHub

### 何をしたか

以前はGitHub TokenがGit remote URLに埋め込まれていました。これは漏洩リスクがあるため削除し、SSH方式に変更しました。

現在のremoteは以下です。

```bash
git@github.com:samasama20260101/sdgs-matching-platform.git
```

また、GitHub CLIにもログインし、GitHub CLI側もSSHを使う設定にしました。

### 何ができるようになったか

- `git push origin dev` で安全にdevへpushできる
- GitHub CLIでPRやリポジトリ情報を確認できる
- remote URLにTokenを含めずに運用できる

### 確認コマンド

```bash
git remote -v
gh auth status -h github.com
git status
```

期待する状態:

```text
origin git@github.com:samasama20260101/sdgs-matching-platform.git
Logged in to github.com as toratora44-ai
Git operations for github.com configured to use ssh protocol
```

### 新しいPCで設定する場合

1. SSH鍵を作成します。

```bash
ssh-keygen -t ed25519 -C "your-pc-name"
cat ~/.ssh/id_ed25519.pub
```

2. `cat` で表示された公開鍵をGitHubに登録します。

GitHub:

```text
Settings → SSH and GPG keys → New SSH key
```

3. SSH接続を確認します。

```bash
ssh -T git@github.com
```

成功すると以下のような表示になります。

```text
Hi toratora44-ai! You've successfully authenticated, but GitHub does not provide shell access.
```

4. GitHub CLIにログインします。

```bash
gh auth login --hostname github.com --web
gh config set git_protocol ssh --host github.com
```

WSLでブラウザが開かない場合は、表示されたURLをWindows側のブラウザで開き、画面に出たコードを入力します。

---

## Vercel

### 何をしたか

WSL側にVercel CLIをインストールし、Vercelへログイン済みの状態にしました。

```bash
npm install -g vercel@latest
```

確認済みバージョン:

```text
Vercel CLI 53.2.0
```

ローカルプロジェクトは以下のVercel projectにリンクしています。

```text
stanabe/sdgs-matching-platform-czna
```

リンク情報は `.vercel/` に作成されますが、`.vercel/` はGit管理対象外です。

### 何ができるようになったか

- Vercelのプロジェクト一覧を確認できる
- Vercelの環境変数名を確認できる
- デプロイ履歴を確認できる
- 将来的にCLIからデプロイやログ確認ができる

### 確認コマンド

```bash
vercel whoami
vercel project ls
vercel env ls
vercel ls sdgs-matching-platform-czna
```

### 注意点

Vercelには似た名前のプロジェクトが複数ありました。

```text
sdgs-matching-platform
sdgs-matching-platform-czna
```

今回確認した範囲では、`sdgs-matching-platform-czna` の方に以下の環境変数が揃っていたため、こちらをリンクしました。

```text
CRON_SECRET
SUPABASE_SERVICE_ROLE_KEY
DEV_PASSWORD
GOOGLE_GEMINI_API_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_URL
```

Vercel CLIや連携アカウントの表示は環境によって異なる場合があります。
Staging / Production の最終確認は、Vercel Dashboardの対象ProjectとGit連携ブランチで行ってください。

### メンテナンスモード

本番DB変更中は、Productionでメンテナンスモードを使います。

| 環境変数 | 役割 |
|---|---|
| `MAINTENANCE_MODE` | `true` のとき通常画面を `/maintenance` へ誘導 |
| `MAINTENANCE_BYPASS_TOKEN` | 運営確認用ブラウザに一時バイパスCookieを発行 |

強制ログアウトは行いません。
セッションは保持し、メンテナンス終了後にそのまま利用再開できる設計です。

詳細は `docs/maintenance_mode.md` を参照してください。
Vercelの環境変数変更は、通常は再デプロイ後に反映されます。

---

## Supabase

### 何をしたか

Supabase CLIをプロジェクトの開発依存として追加しました。

```bash
npm install --save-dev supabase@latest
```

確認済みバージョン:

```text
Supabase CLI 2.98.2
```

その後、Supabase CLIへログインし、Stagingプロジェクトへリンクしました。

```bash
npx supabase login
npx supabase link --project-ref fzawgdmqewmwdqjsqjwt
```

現在リンクされているSupabase project:

```text
sdgs-staging
fzawgdmqewmwdqjsqjwt
```

### 何ができるようになったか

- Supabase CLIでプロジェクト一覧を確認できる
- Staging DBを対象にmigration操作を準備できる
- Supabase設定ファイルをリポジトリで管理できる

### 追加されたファイル

| ファイル | 役割 |
|---|---|
| `supabase/config.toml` | Supabase CLIの設定 |
| `supabase/.gitignore` | Supabaseのローカルキャッシュを除外 |
| `.gitignore` | `supabase/.temp/` をGitから除外 |

`supabase/.temp/` にはローカルのリンク情報が入ります。これはPCごとの情報なのでGitに入れません。

### 確認コマンド

```bash
npx supabase projects list
```

期待する状態:

```text
sdgs-staging に LINKED の印が付いている
```

### WSLでブラウザが開かない場合

`npx supabase login` でブラウザが開かない場合があります。その場合は、表示されたログインURLをWindows側のブラウザで開き、verification codeをターミナルに貼ります。

またはSupabase DashboardでPersonal Access Tokenを作り、以下のようにログインします。

```bash
npx supabase login --token YOUR_TOKEN
```

トークンはチャットやGitには絶対に貼らないでください。

---

## 本番DBの扱い

このプロジェクトは、開発DBと本番DBを分けています。

通常作業では、Supabase CLIはStagingにリンクします。

```text
Staging: fzawgdmqewmwdqjsqjwt
```

本番DBに対して、以下の操作は勝手に行ってはいけません。

- SQL実行
- `db push`
- データ更新
- データ削除
- RLS変更
- Authユーザー操作
- 環境変数変更

本番DBを操作する必要がある場合は、必ず事前に以下を確認します。

```text
1. 対象project ref
2. 実行するSQL
3. 影響を受けるテーブル
4. ユーザー体験への影響
5. rollbackできるか
6. 実行してよいかの明示許可
```

### Production project refについて

現在のProduction Supabase refは以下です。

```text
dqiqwclgzxhjxpotflvz
```

ただし、本番DB操作前には必ずSupabase Dashboard、Vercel環境変数、CLI表示を照合して、現在の本番DBを確認してください。

### サポーター団体DB刷新

サポーター団体DB刷新はStagingに適用済み、Productionには未適用です。

Production適用時は、以下を使います。

```text
docs/production_supporter_db_refresh_runbook.md
```

Stagingテスト仕様は以下です。

```text
docs/staging_role_function_test_spec.md
```

---

## よく使う作業コマンド

### 作業開始

```bash
cd ~/samasama/sdgs-matching-platform
source ~/.nvm/nvm.sh
git status
```

### 開発サーバー起動

```bash
npm run dev
```

### lint確認

```bash
npm run lint
```

現在、既存コードにESLintエラーが複数あります。これは環境セットアップによって発生したものではなく、別途修正が必要な既存課題です。

### GitHubへpush

```bash
git status
git push origin dev
```

### Supabase Stagingリンク確認

```bash
npx supabase projects list
```

### Vercel確認

```bash
vercel whoami
vercel env ls
vercel ls sdgs-matching-platform-czna
```

---

## 初期セットアップで作成したコミット

```text
2ab4627 chore: set up codex environment tooling
```

このコミットには以下が含まれます。

- `AGENTS.md` をCodex / ClaudeCode共通の正本として追加
- `CLAUDE.md` を `AGENTS.md` 参照用に整理
- Supabase CLIをdev dependencyに追加
- `supabase/config.toml` を追加
- SupabaseローカルキャッシュをGit管理から除外

---

## 次に確認したいこと

- Vercel Dashboardで、GitHub連携先とdev/mainブランチの自動デプロイ設定を確認する
- Stagingで `docs/staging_role_function_test_spec.md` に沿って2週間程度テストする
- Production適用前に `docs/production_supporter_db_refresh_runbook.md` を読み直す
- 既存のESLintエラーを別タスクとして整理する
