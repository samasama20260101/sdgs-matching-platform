# HANDOFF: 休止前整理 — 残りはお知らせ機能の本番反映
更新: 2026-10-26(古い作業記録を削って現在地だけにした。それまでの経緯は `git log -p HANDOFF.md` で見られる)

## ゴール(完成条件)
11月からの少人数運営(開発休止)の前に、dev の改善を本番へ出し、運営が迷わず使える状態にする。
- 2026-10-26 dev → main を **PR #57** で本番反映済み(`53a4abc`、PR #35〜#56: 新しい相談フォーム・AI の安全対策・回数制限・体験ページ `/trial`・セキュリティヘッダー・cron 認証修正など)。ユーザーが GitHub 上で PR を作りマージ。本番デプロイ success、`/` `/trial` `/api/health` 200、ヘッダー 4 つを curl で確認
- **残り: お知らせ機能を本番へ**(下の「現在地」)

## 現在地
### お知らせ機能(PR #34 で dev にマージ済み、本番未反映)
- 本番 DB の `news_posts` は **2026-10-26 作成済み**(ユーザーが SQL Editor で実行。確認 SQL で RLS・CHECK 5 種・trigger・index・search_path を確認)。Staging と同じ状態
- 残りは dev → main のマージだけ(ユーザーが GitHub 上で、PR #57 と同じ手順: https://github.com/samasama20260101/sdgs-matching-platform/compare/main...dev )。仕様は dev のまま(「お知らせ」の名前も変えない、ユーザー判断 2026-10-26)
- 反映後に確認: 本番デプロイの状態、トップ・`/news` が開くこと、管理画面 `/admin/news` で下書き → 公開、記事 URL を LINE / X に貼ったときの画像
- 内容: 管理画面 `/admin/news` で投稿、公開中の新しい 3 件をトップ(サーバーで読む)、全件を `/news`、記事ページ `/news/[id]`(タイトル入り共有画像 `/api/public/news/[id]/og`)。種別は お知らせ / メンテナンス / 参加団体 / インタビュー / 話題(TOPIC、外の人が書いた記事の URL 要約紹介)。AI 下書き(Gemini)は材料 1 欄+「URL から下書きを作る」。正本は `docs/news_section_design.md` の決定ログ
- note 記事ワークフローは削除済み(タグ `archive/news-note-article-2026-10`)。最初の投稿は 11 月の少人数運営の宣言の予定

### 本番反映(PR #57)のあとにユーザーが見ること
- ブラウザ確認: 相談登録(スマホ・写真)、サポーターのフィルター、体験ページ、流出パスワード(`password123` で日本語の案内が出るか)
- 翌朝 JST 2:00 の cron(`/api/cron/auto-close-cases`)が 200 で終わっているか(Vercel のログ)

### 残っている小さな課題
- サポーター用ダッシュボードの困りごとチップが、スマホで 7 段に折り返す(横スクロール化は右端が切れるとユーザーに却下された。直すなら別の方法で)
- 結果ページの見出し「AIが分析しました」は、AI が分類しなくなったので文言を見直す余地
- 体験ページの「自動では伏せられないものがあります」に残る「サポーターには書いたとおりに表示されます」を残すか(ユーザー未回答)
- AI が書く説明文は日本語固定(日本語以外の画面でも日本語で出る)
- 登録総数の上限(MAX_SOS_USERS = 1000)はロボットに埋められると弱点。CAPTCHA はオフのまま(設定だけでオンにすると全員ログイン不可。入れるなら Cloudflare Turnstile)
- 依頼者の確認待ち: 緊急フラグ 14 個 / 日本向きでない選択肢 / 内容が近い組(`docs/intake_indicators.md` の「内容面の気づき」)/ 日本語以外の訳。既存案件は新しい選択肢にマッピングしていない(大項目フィルターには掛かる、選択肢フィルターには掛からない)
- 利用規約 第7条「承認するまでサポーターに開示されません」はユーザー判断でそのまま
- Supabase: Leaked Password Protection を Staging → 本番の順に ON(未実施なら)。旧 API キー(JWT 形式)の Disable は様子を見てから(まだ押していない)
- 技術負債: `users.supporter_type` / `users.organization_name` 列は未 DROP(害はない)。本番の `display_id_backup_20260816` テーブル DROP(ユーザー実行)。Staging の SMTP(Resend)設定は任意

### 2026-10-26 の整理
- 削除: 開発用ページ `/test-ai` と `/api/classify-sdgs`、`scripts/list-models.js`・`test-gemini-connection.js`・`create-test-users.ts`、ルートの残骸(`er.email`・`fix_routing.sh`・`restructure_sdgs.sh`・空ファイル `next`・`sdgs-matching-platform@0.1.0`)、マージ済みブランチ、リポジトリ外の `~/samasama/メール変更調査SQL/`・`本番アカウント削除SQL/`・`staging_cases_cancelled_2026-10-16.json`
- `docs/sdgs_impact_dashboard_design.md` はタグ `archive/sdgs-impact-dashboard-2026-10` へ(教師データ待ちで休止)
- タグ保管の一覧: `archive/i18n-phase2-2026-07`(多言語 Phase 2)、`archive/case-concerns-2026-09`(お困りごとラベル)、`archive/news-note-article-2026-10`(note 記事)、`archive/sdgs-impact-dashboard-2026-10`(ダッシュボード設計)。再開時はマージせず取り出して作り直す

## 試して失敗したこと ★最重要
- **auto mode の分類器は「一括削除っぽい」コマンドをブロックする**(xargs や for ループでのブランチ削除)。名前を明示列挙した単一コマンドなら通る。本番 psql も止まるのでユーザーが `!` で実行
- **Staging の DDL/SQL は Management API**(`POST https://api.supabase.com/v1/projects/fzawgdmqewmwdqjsqjwt/database/query`、トークンは `~/.supabase/access-token`)。jq は未インストールなので python3 で整形
- **本番 DB の確認は、ユーザーに読み取りだけの確認 SQL を渡して SQL Editor で流してもらう**(2026-10-26 は 1 回目に古い版の SQL が流れ、確認 SQL で search_path の抜けに気づいた)
- **SVG の url(#id) 参照は id 重複に弱い**: 同じ部品を表示/非表示ペアで 2 つ置くと Chrome で描画されない。defs を持つ部品は `useId` で固有 id に(Logo.tsx で対応済み)
- **`opengraph-image.tsx` を `[locale]` の下に置くと画像 URL が `/ja/...` になり 307** → 共有画像は `/api/public/...` に置く
- feature ブランチの未取り込み判定は `git cherry -v dev <branch>`。`git merge-tree --write-tree` は git 2.34 では未対応
- Staging の `/ja` を curl すると 307(next-intl の既定ロケール。本番も同じ)。Staging は全パスに dev-login ゲート(cookie `dev-auth=<DEV_PASSWORD>`、API も cookie が必要)
- `/sos/hearing` `/profile` などはログイン必須のクライアント描画で curl では中身を確認できない

## 地雷・注意
- **本番 Supabase への変更操作はユーザーの明示許可なしに実行しない**(こちらは read-only のみ)
- **dev → main はユーザーが GitHub 上で手動で行う**(2026-10-26 ユーザー指示)
- **公開している言語は ja・en・zh のみ**(`src/i18n/routing.ts`)。言語切替は `LANGUAGE_SWITCHER_ENABLED = false` で非表示。資料で「6 言語対応」と書かない。多言語再公開は `LANGUAGE_SWITCHER_ENABLED` + `localeDetection` の 2 点(ko/vi/id は緊急語彙のネイティブ確認が前提)
- **体験ページ `/trial` に fetch を足さない**(API・DB・AI を呼ばない作り)
- **画面の確認方法**: Playwright はプロジェクトに入れていない。`~/samasama/.qa-tools/` に `playwright-core` と撮影スクリプト。ブラウザ本体は `~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`
- **画面の横スクロール化は慎重に**(右端が切れて見えるとユーザーに却下された)
- **パスワード更新は必ず本人トークンで GoTrue PUT /user**(admin API だと本人セッションごと失効=即ログアウト。2026-09-17 の回帰)
- **メール変更は新アドレスのみの 1 段階確認**(Secure email change OFF)。確認メールは新旧両方の宛先に届くが仕様(二重送信バグではない)。リンクの有効期限 1 時間。Staging は SMTP 未設定で届かない
- **管理者は `/profile` に入れない**ので、管理者自身のパスワード変更は forgot-password 頼み
- 災害SOSは受付終了(`ACTIVE_DISASTER_EVENT = null`)、災害案件はサポーター一覧から外す(`DISASTER_CASES_SHOWN_TO_SUPPORTERS = false`)。再開時は両方戻す。災害データは `cases.intake_qna.disaster` 配下(正本 `src/lib/constants/disaster.ts`)
- Staging テストユーザー: sos01@gmail.com / npo01_1@gmail.com(testpass123)、管理者 x25660@yahoo.co.jp(PW 不明)
- Staging と本番のスキーマは一致(i18n 列は `users.locale` / `cases.locale` のみ、`news_posts` は両方にある)
- 環境差: Staging はメール確認 OFF・dev-login ゲートあり / 本番はメール確認 ON
- ローカルの Vercel CLI は古い個人プロジェクトにリンクされたまま。デプロイ状況は `gh api repos/samasama20260101/sdgs-matching-platform/commits/<sha>/status` で見る
- `docs/staging_users_*.csv` はコミット禁止。配布物は `~/samasama/docs_退避_20260925/配布物/`。相談フォーム改善提案・NPO インタビュー作戦の正本は `~/samasama/docs_退避_20260925/proposals/`
- 営業用 PowerPoint テンプレート: `~/samasama/営業資料/`。説明ドキュメント「案件登録QA 作り直し(指標ベース)」: https://claude.ai/code/artifact/69f7caf3-563d-4cff-b359-e5e2d30176a7
- チャットに貼られた Resend API キーは落ち着いたら再発行 → Supabase SMTP 再設定
