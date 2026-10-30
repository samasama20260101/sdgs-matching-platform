# 開発・運用の手引き

更新: 2026-10-30(10/26 に環境構築・技術構成・API 設計・DB アクセス・メンテナンスモードの 5 本をまとめ、10/30 に点検した。以前の版は git 履歴にある)

サービスの中身は `docs/service_specification.md`、作業ルールの要点は `AGENTS.md` を見てください。

---

## 1. 最初に守ること

- **開発環境と本番環境は分かれている。** 普段の作業は `dev` ブランチ + Staging の Supabase で行う。
- **本番の Supabase を変える操作(SQL・データ更新・RLS・Auth・環境変数)は、代表者の明示の許可なしに行わない。** 読み取り専用の確認でも、相談内容や個人情報に触れうるので慎重に。
- **DB の変更は `migrations/` に SQL として残し、Staging で確かめてから本番を検討する。**
- 秘密情報(`.env.local`、キー、パスワード)は Git・チャットに貼らない。

権限の段階:

| 段階 | できること | 渡してよいもの |
|---|---|---|
| 通常の開発者 | GitHub、Staging の確認 | Staging 用の `.env.local` |
| 本番の参照者 | 本番 DB の SELECT、Vercel・GitHub の確認 | 本番の読み取り専用の接続情報 |
| 本番の作業者 | 承認済みの SQL、環境変数の変更 | 必要最小限の本番権限 |

本番の `service_role` キーは開発者の PC に入れない。

## 2. 環境

| 項目 | Staging(開発) | Production(本番) |
|---|---|---|
| Git ブランチ | `dev` | `main` |
| Supabase ref | `fzawgdmqewmwdqjsqjwt` | `vxcoivgulfkpblqrawif` |
| Vercel URL | https://sdgs-matching-platform-git-dev-samasama.vercel.app | https://app.samasama.site |
| メール確認 | オフ | オン |
| メール送信 | できない(SMTP 未設定) | できる |
| 入口のパスワード | あり(`DEV_PASSWORD`、`/dev-login`) | なし |

- 本番の作業や読み取りの直前に、Supabase の画面で project ref を必ず確かめる。
- Vercel のチームは `samasama`、プロジェクトは `sdgs-matching-platform`。関数のリージョンは東京(`hnd1`)。
- GitHub: https://github.com/samasama20260101/sdgs-matching-platform

### 2.1 技術構成

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 16(App Router)、React 19、TypeScript |
| 多言語 | next-intl(`src/i18n/`、`messages/<言語>/*.json`) |
| DB・認証・保存場所 | Supabase(PostgreSQL・GoTrue・Storage) |
| ホスティング | Vercel Pro |
| AI | Google Gemini `gemini-2.5-flash`(`@google/generative-ai`) |
| 見た目 | Tailwind CSS 4、Radix UI |
| アクセス解析 | Google Analytics(`G-8S5GP8P7EZ`、`src/app/[locale]/layout.tsx`) |
| 郵便番号 | zipcloud → 見つからなければ HeartRails Geo API(`/api/zipcode`) |

### 2.2 環境変数

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase の URL と公開キー(`sb_publishable_` 形式) |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー用の秘密キー(`sb_secret_` 形式)。Vercel では Secret |
| `GOOGLE_GEMINI_API_KEY`(または `GEMINI_API_KEY`) | Gemini。ない場合、相談の整理は決まった内容のデモ結果を返す |
| `CRON_SECRET` | cron の認証。未設定なら cron は必ず断る |
| `DEV_PASSWORD` | Staging の入口パスワード。**本番には設定しない** |
| `MAINTENANCE_MODE` / `MAINTENANCE_BYPASS_TOKEN` | メンテナンスモード(§6) |
| `VERCEL_ENV` | Vercel が付ける。`production` のときだけ 1 日の相談登録上限が効く |

- 環境変数を変えたら再デプロイしないと効かない。`NEXT_PUBLIC_` で始まるものはビルド時に埋め込まれる。
- GitHub Actions の秘密: `DISCORD_DEPLOY_WEBHOOK_URL`(デプロイ通知)。

## 3. ローカル開発

```bash
# 初回
git clone git@github.com:samasama20260101/sdgs-matching-platform.git ~/samasama/sdgs-matching-platform
cd ~/samasama/sdgs-matching-platform
git checkout dev
source ~/.nvm/nvm.sh     # Node は nvm で管理(WSL のターミナルで実行する)
npm install

# 起動
npm run dev
```

`.env.local`(Git に入れない)には **Staging の値だけ** を入れる:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://fzawgdmqewmwdqjsqjwt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_GEMINI_API_KEY=...
CRON_SECRET=...
DEV_PASSWORD=...
# 本番の読み取りが必要な人だけ(アプリは使わない。調査用)
SUPABASE_PROD_READONLY_DATABASE_URL=postgresql://app_prod_readonly:...
```

よく使うコマンド:

| コマンド | 内容 |
|---|---|
| `npm run build` | 本番ビルド(型チェックを含む) |
| `npx tsc --noEmit` | 型チェックだけ |
| `npm run lint` | ESLint |
| `npm run test:units` | 単体テスト(`scripts/tests/`) |
| `npm run check:i18n` | 全言語の翻訳キーが日本語と一致するか |

- GitHub は SSH で接続し、`gh` CLI も使う。
- Supabase CLI は Staging にリンクする(`npx supabase link --project-ref fzawgdmqewmwdqjsqjwt`)。`supabase/.temp/` は Git に入れない。
- CI(自動テスト)はない。PR の前に上の 4 つを手元で通す。
- Playwright はプロジェクトに入れていない。画面の撮影は `~/samasama/.qa-tools/` の道具を使う。
- `docs/assets/` はファビコンと共有画像(`public/og-image.png` など)の元の SVG。`docs/email_templates/change_email.html` は Supabase の Authentication → Emails → Change Email Address に貼るメール本文(件名と注意点はファイル先頭のコメント)。

## 4. ブランチとリリース

```
作業ブランチ(dev から分ける)→ dev へ PR → Staging に自動デプロイ → 確認
→ dev から main へ PR(GitHub の画面で代表者が作ってマージ)→ 本番に自動デプロイ
```

- `main` は PR 必須。**dev → main はユーザー(代表者)が GitHub の画面で行う。** https://github.com/samasama20260101/sdgs-matching-platform/compare/main...dev から作り、「Create a merge commit」でマージする。
- 本番 DB の変更があるときは、**先に本番 DB に SQL を流してから** dev → main をマージする(新しいテーブルは、古いコードには影響しないため)。
- デプロイの結果は Discord に通知される(本番と、dev の Staging)。状態は `gh api repos/samasama20260101/sdgs-matching-platform/commits/<sha>/status` でも見られる。
- 使わなくなった機能は本番に入れず、`archive/<名前>-<年月>` のタグに残して消す。再開するときはマージせず、タグから取り出して作り直す。今あるタグ:
  - `archive/i18n-phase2-2026-07`(チャットなどの動的翻訳)
  - `archive/case-concerns-2026-09`(お困りごとラベル)
  - `archive/news-note-article-2026-10`(お知らせの note 記事ワークフロー)
  - `archive/sdgs-impact-dashboard-2026-10`(SDGs インパクトダッシュボードの設計書)
  - `archive/i18n-design-doc-2026-10`(多言語の設計書)
  - 中身を見るとき: `git show <タグ>:<ファイル>` または `git switch --detach <タグ>`
- 本番に反映したら確かめること: `/`・`/trial`・`/api/health` が 200、セキュリティヘッダー 4 つ、変えた画面のブラウザ確認、翌朝の cron。

## 5. DB の扱い

### 5.1 変更の進め方
1. `migrations/<内容>.sql` を書く(先頭のコメントに: 目的・実行場所・影響・戻し方)。何度流しても同じ結果になる書き方(`IF NOT EXISTS` など)にする。
2. Staging に流す。Staging は Supabase の SQL Editor か Management API(`POST https://api.supabase.com/v1/projects/fzawgdmqewmwdqjsqjwt/database/query`、トークンは `~/.supabase/access-token`)。
3. Staging で動作を確かめる。
4. 本番は代表者が SQL Editor で流す。その前に project ref・SQL 全文・影響・戻し方を確かめる。大きな変更ではメンテナンスモードとバックアップを使う。
5. 流したあと、読み取りだけの確認 SQL で結果を確かめる(テーブル・制約・RLS など)。

関数には `SET search_path = public` を付ける(Supabase の Security Advisor の警告対策)。

### 5.2 本番の読み取り
- 読み取り専用のユーザー(`app_prod_readonly`)か、Supabase の画面で SELECT だけ。
- 本文や個人情報を大量に出さない。`count(*)`、状態ごとの集計、`limit 5` を優先する。`select * from messages` などはしない。
- `auth`・`storage` のスキーマは読み取り専用ユーザーでは読めない。必要なら SQL Editor で。

### 5.3 テーブルの一覧
| テーブル | 中身 |
|---|---|
| `users` | ログインする個人(ロール・表示番号・地域・停止など) |
| `organizations` | サポーター団体(物理削除せず ARCHIVED にする) |
| `organization_memberships` | 個人と団体の所属(OWNER / ADMIN / MEMBER、1 人 1 団体) |
| `supporter_service_areas` | 団体の活動地域(全国と個別地域は混ぜられない) |
| `cases` | 相談(選んだ選択肢・災害の情報・写真は `intake_qna`、AI の結果は `ai_sdg_suggestion`) |
| `offers` | 申し出(承認順 `accepted_order`) |
| `messages` | チャット(`__SYSTEM__` で始まるものはシステムメッセージ) |
| `case_internal_notes` | 団体内の内部メモ |
| `supporter_badges` | 相談者が団体に贈るバッジ |
| `inquiries` | お問い合わせ |
| `news_posts` | お知らせ |
| `regions` | 地域の一覧 |
| `audit_logs` | 監査ログ |
| `organization_invitations` | 団体への招待(テーブルだけあり、コードは使っていない) |

- 保存場所: 非公開の `case-photos`(相談の写真)。
- RLS は有効。アプリはサーバーから `service_role` で読み書きするので、**認可は API のコードで行う**(§7)。
- テスト用ユーザーは SQL で直接入れず、`supabaseAdmin.auth.admin.createUser()` で作る(Auth の identities ができないとログインできない)。
- 地域(`regions`)は外部キーの JOIN を使わず、2 回に分けて取る。

## 6. メンテナンスモード

本番 DB の作業中に、利用者の書き込みを止めるために使う。ログアウトはさせない。

有効にする:
1. Vercel の Production 環境変数に `MAINTENANCE_MODE=true` を入れて再デプロイ
2. 通常のブラウザで `/maintenance` に飛ばされること、`/api/health` が `maintenance: true` を返すことを確かめる
3. 運営だけ通すときは `MAINTENANCE_BYPASS_TOKEN` を設定しておき、`/api/maintenance-bypass?token=<値>&redirect=/` を開く(そのブラウザだけ 1 時間通れる)

作業:
4. project ref を確かめる → バックアップ → SQL を 1 本ずつ → 確認 SQL → 通れるブラウザで画面を確かめる

戻す:
5. `MAINTENANCE_MODE` を消すか `false` にして再デプロイ

メンテナンスモードはバックアップや戻し方の代わりにはならない。

## 7. API を作るとき

- **ブラウザから DB を直接読み書きしない。** ブラウザの Supabase は認証(ログイン・セッション)だけに使い、DB は API ルート経由。
- API ルートは `supabaseAdmin`(`src/lib/supabase/server.ts`、RLS を通らない)を使う。**DB に触る前に認証・認可をする。**
- サーバー専用のファイルには `import 'server-only'` を入れる(`src/lib/supabase/server.ts`・`src/lib/gemini.ts`・`src/lib/api/*` など)。

チェックリスト:
- [ ] ログインが必要なら `requireActiveAppUser(request, { roles })`(`src/lib/api/auth.ts`)を使う。停止中のアカウントも断られる
- [ ] ロールだけでなく、対象データの持ち主・所属団体を確かめる(団体は `getActiveOrganizationForUser`、`src/lib/organizations.ts`)
- [ ] クライアントが送る `user_id`・`organization_id`・状態・日時を信用しない
- [ ] ID は DB に渡す前に `isUuid()` / `normalizeUuidList()`(`src/lib/api/validation.ts`)で確かめる。空文字を UUID の列に渡さない
- [ ] 公開 API は返す列を明示し、個人の連絡先・相談本文・内部メモ・デバッグ情報を返さない
- [ ] 一覧は件数を絞る。`select('*')` を避ける
- [ ] 定期更新は 60 秒以上で、タブが見えていないときは止める。管理画面は自動更新しない
- [ ] AI を使うなら、ロール・対象データ・文字数の上限・回数の上限・保存先を決め、相談文は `maskPii` と `fenceConsultation` を通す
- [ ] cron は `isValidCronAuthorization`(`src/lib/api/cronAuth.ts`)で守る
- [ ] Next.js 16 の `params` は Promise(`const { id } = await params`)
- [ ] `'use client'` はファイルの先頭(import より前)

Supabase Realtime の直接購読は使わない(機微な情報が多く、設定漏れがそのまま漏洩になるため)。更新は API の再取得で行う。

## 8. Supabase の負荷(Disk IO の警告が来たら)

すぐにプランを上げず、次の順に確かめる。
1. Staging か本番か。期間と、Database / Auth / Storage / Realtime のどれが増えているか
2. グラフが山型(移行・テストなど一時的)か、平ら(開きっぱなしの画面のポーリング・定期処理)か
3. アプリ側: `grep -rn "setInterval" src` で短い間隔の更新や、見えていないタブで動く更新がないか
4. DB 側(SQL Editor): `pg_stat_statements` で読み込みの多いクエリ、`pg_stat_user_tables` で Seq Scan の多いテーブル、`pg_stat_activity` で実行中のクエリ

索引は、同じ条件の検索が多く Seq Scan が多いときに検討する(書き込みが重くなるので万能ではない)。無駄を減らしても警告が続くなら、利用が増えた結果としてプランを上げる。

## 9. 定期処理と監視

- cron: 毎日 JST 2:00 に `/api/cron/auto-close-cases`(`vercel.json`)。cron は本番デプロイでしか動かない。結果は Vercel のログで見る。
- `CRON_SECRET` を変えるときは、Vercel で値を **Edit で上書き**(削除して追加はしない)→ 本番を再デプロイ → Settings → Cron Jobs の Run で 200 を確かめる。
- `/api/health` は `{ ok, maintenance, timestamp }` を返す(メンテナンス中も動く)。

## 10. AI アシスタント(Codex・Claude)に頼むとき

権限の境界は人と同じ。頼むときに範囲をはっきり書く。
- 「Staging だけ見てください。本番 DB は見ないでください。」
- 「本番は読み取りだけ許可します。project ref は vxcoivgulfkpblqrawif。SELECT だけで、本文や個人情報を大量に出さないでください。」
- 「本番 DB に SQL を流すことを検討します。project ref・SQL 全文・影響・戻し方を出してください。私が許可するまで実行しないでください。」

## 11. よくある間違い

- 違うブランチで作業している → `git branch --show-current`。普段は `dev` から分けたブランチ
- Staging と本番の URL・キーを混ぜる → `.env.local` の URL と秘密キーは同じ環境のものにする
- `invalid input syntax for type uuid: ""` → 空文字の ID が DB に渡っている。§7 の ID 確認を入れる
- 本番で `supabase db push` をいきなり使う → 使わない。SQL Editor で、§5.1 の手順で
- `/ja` を開くと 307 → 日本語は URL に `/ja` を付けない設定なので正常
- Staging を curl で開くと `/dev-login` に飛ぶ → cookie `dev-auth=<DEV_PASSWORD>` を付ける(API も同じ)
