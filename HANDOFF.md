# HANDOFF: 開発休止前の整理 — docs 点検済み、次は引き継ぎ資料
更新: 2026-10-30(それまでの経緯は `git log -p HANDOFF.md` で見られる)

## ゴール(完成条件)
11月からの少人数運営(開発休止)の前に、dev の改善を本番へ出し、運営と次の担当者が迷わず使える状態にする。
- 本番反映は完了: 2026-10-26 PR #57、2026-10-28 PR #70(本番 `fee9cf0`)。本番 DB に流す SQL は残っていない
- 2026-10-30 に docs を点検し、古い記述・済んだ作業の記録を削った
- **次: 次の担当者向けの引き継ぎ資料。** 何を入れるか(アカウントと権限の一覧、秘密の値の置き場所、日々の運営手順など)はユーザーと決める
- **2026-10-30 以降、今の担当者はコードを触らない。** コードの変更が要るものは、すべて次の担当者への申し送り。開発の休止は確定ではなく、別の担当者で開発が続く可能性もある(2026-10-30 ユーザー)

## 次の担当者への申し送り(2026-10-30)
コードの変更が要るので、次の担当者が判断して進める。上から優先。

### 1. 管理者まわりのセキュリティ(最優先)
- **管理者アカウントに二段階認証(MFA)がない。** アプリの管理者(ADMIN)はメールアドレスとパスワードだけで入れる。管理者は全相談者の氏名・メールアドレスを見られ、アカウントの停止・メールアドレスの変更・お知らせの公開ができるので、パスワードが漏れたときの被害が大きい。Supabase Auth の MFA(認証アプリのワンタイムコード)を使い、管理画面と管理者 API で「二段階目まで済んだログイン」だけを通す形にする。今のコードに MFA の処理はまったくない
- 同じ理由で一緒に直したいもの(詳細は `docs/service_specification.md` §15):
  - `/admin/login` が初回のパスワード変更を強制しない(運営が作った管理者が初期パスワードのまま使える)
  - 管理者が、別の管理者や自分のメールアドレスを変えられる(乗っ取りの経路になる)。停止・停止解除が監査ログに残らない
- **運営で使う外部サービスのアカウントも二段階認証を必須にする**: GitHub、Vercel、Supabase、Google(Analytics など)、Discord、Resend。組織・チームの設定で全員に必須にできるサービスは必須にする。特に Supabase と Vercel は、本番の DB と環境変数に直接触れる
- 管理者アカウントは複数人で共有しない(監査ログで誰の操作か分からなくなる)。一人一アカウントにして、離任したらすぐ停止する
- その前に、離任者をメンバーから外すことと、秘密の値の作り直しを済ませる(下の「離任メンバーの後始末」)

### 2. トップページ「ご利用の流れ」の文言
- STEP 2 が「AIが分析 / AIが相談内容を解析し、最適なSDGsカテゴリを判定」のまま(`messages/<言語>/landing.json` の `steps`、6 言語)。今は AI が分類せず、選んだ困りごとからサーバーが決めている。「相談者に SDGs を意識させない」方針(`AGENTS.md`)とも合わない。相談者が最初に読むページなので、今の流れに合わせて書き直す。結果ページは PR #69 で「書いてくださった内容を、AIが読みやすく整理しました。運営が確認したサポーターがこの内容を読み、力になれる方法を考えます。」に直したので、それに揃えるとよい

### 3. 相談者の画面の文言と実際の動きのずれ(2026-10-30 の画面確認で発見)
- 登録画面の「お名前」の注記「マッチ後にサポーターへ共有されます」は実際と違う。お名前はサポーターに渡らない(プロフィール画面は「サポーターには自動表示されません」で、こちらが正しい)
- プロフィール画面は住所を「サポーターには自動表示されません」と案内しているが、住所欄の都道府県はサポーターの都道府県の絞り込みに使われる(`docs/service_specification.md` §6.1・§15)
- 解決を確認した直後のバッジ画面を閉じると、あとからバッジを贈る方法がない
- 相談者に SDGs が見える箇所: 相談履歴の「SDGs:」ラベル、結果ページの「SDG 2 飢餓をゼロに」と AI の説明文(`src/lib/gemini.ts` の指示文、上の「残っている課題」)、相談フォームの「SDGsの隣のお困りごと」、パスワード変更画面の見出し「SDGsマッチング」
- 団体の公開ページ(`/supporters/[id]`)で、種別が未設定の団体は種別の欄に翻訳キー `common.supporterType` がそのまま出る
- 管理画面に管理者の一覧・停止がない(管理者が辞めたら DB で止めるしかない)

## 現在地(2026-10-30)
### 本番
- メンテナンスモードは解除済み(10/30 に `/api/health` が `maintenance: false`、`/`・`/news`・`/trial`・`/supporters` が 200)
- ユーザーに見てもらうこと: 管理画面 `/admin/news` で下書き → 公開、記事の URL を LINE / X に貼ったときの画像
- お知らせの公開は 0 件。最初の投稿は 11 月の少人数運営の宣言(たたき台は `docs/news_section_design.md` §5.2)
- メンテナンスのバイパス用トークンはユーザーが 10/28 に変更(Vercel の環境変数で見る。チャット・Git に書かない)

### 離任メンバーの後始末(残り)
- 本番アカウントの削除は 10/28 に完了(ADM-00001・ADM-00002・SUP-00002)。本番の管理者は ADM-00003 だけ。利用者はサポーター 8・相談者 8・管理者 1
- **未実施**: GitHub・Vercel・Supabase・Discord・Google Analytics のメンバーから外す
- **未実施**: 離任者が知りうる値の作り直し — Supabase の秘密キー、本番読み取り専用 DB ユーザーのパスワード、`CRON_SECRET`(手順は `docs/operations.md` §9)、Gemini API キー、Discord Webhook(Discord で作り直し、GitHub Secrets の `DISCORD_DEPLOY_WEBHOOK_URL` を Update)、Resend API キー(チャットに貼られたもの。再発行して Supabase の SMTP を設定し直す)
- GitHub リポジトリの admin は 3 人: toratora44-ai、Kojok120(岡本さん)、samasama20200101(**誰が使っているか要確認**)。組織に入っている GitHub App は Vercel だけ

### Discord デプロイ通知
- `.github/workflows/deploy-notify.yml`(岡本さん作、PR #39・#40)。Vercel のデプロイ完了を拾い、本番と Staging の成否を Discord の「デプロイ」チャンネルへ送る。Webhook の URL は Discord のサーバー設定 → 連携サービス → ウェブフックで見る(ユーザーの権限では見られなかった)
- 2026-10-28 にレビューして安全面の問題なし。小さな改善点: 短い間に 2 回マージすると 1 回目の Staging 通知が抜ける / `timeout-minutes` と curl の `--max-time` がない
- このリポジトリの PR はすべてレビューなしで作成者本人がマージしている。外部送信・Secrets・Actions の変更は事前に共有するルールを `AGENTS.md` に足すか(ユーザー判断待ち)

### 残っている課題
コードの既知の課題は `docs/service_specification.md` §15。それ以外(コードの変更が要るものは次の担当者が判断する):
- サポーター用ダッシュボードの困りごとチップが、スマホで 7 段に折り返す(横スクロールは右端が切れるので却下済み。直すなら別の方法で)
- AI への指示文(`src/lib/gemini.ts`、分類 18 の説明など)に SDGs の言葉が残る。急がない- 体験ページの「自動では伏せられないものがあります」に残る「サポーターには書いたとおりに表示されます」を残すか(ユーザー未回答)
- 相談者の登録総数の上限(`MAX_SOS_USERS = 1000`)はロボットに埋められると弱い。CAPTCHA はオフ(設定だけでオンにすると全員ログインできなくなる。入れるなら Cloudflare Turnstile)
- 依頼者の確認待ち: 緊急の選択肢 14 個 / 日本向きでない選択肢 / 内容が近い組 / 日本語以外の訳(`docs/intake_indicators.md`)。古い相談は新しい選択肢に読み替えていない(大項目の絞り込みには掛かるが、選択肢の絞り込みには掛からない)
- Supabase: Leaked Password Protection を Staging → 本番の順に ON(未実施なら)。旧 API キー(JWT 形式)の Disable は様子を見てから(まだ押していない)
- 本番の `display_id_backup_20260816` テーブルの DROP(ユーザーが実行)。Staging の SMTP(Resend)設定は任意
- Vercel のビルドログに npm の `install-scripts … not yet covered by allowScripts`(esbuild・@swc/core・@parcel/watcher・msw・unrs-resolver)。今は警告だけ。npm が既定で止めるようになったら許可リストに入れる

## 試して失敗したこと(AI で作業するとき)
- **auto mode の分類器は「一括削除っぽい」コマンドを止める**(xargs や for ループでのブランチ削除)。名前を並べた単一のコマンドなら通る。本番の psql も止まるので、ユーザーが `!` で実行する
- **本番 DB の確認は、読み取りだけの確認 SQL をユーザーに渡して SQL Editor で流してもらう**(2026-10-26 は 1 回目に古い版の SQL が流れ、確認 SQL で search_path の抜けに気づいた)
- **SVG の `url(#id)` 参照は id の重複に弱い**: 同じ部品を表示用と非表示用の 2 つ置くと Chrome で描画されない。defs を持つ部品は `useId` で固有の id にする(`Logo.tsx` で対応済み)
- **`opengraph-image.tsx` を `[locale]` の下に置くと画像の URL が `/ja/...` になって 307** → 共有画像は `/api/public/...` に置く
- 作業ブランチの未取り込みの判定は `git cherry -v dev <branch>`(`git merge-tree --write-tree` は git 2.34 では使えない)
- `/sos/hearing` や `/profile` などはログインが必要なクライアント描画なので、curl では中身を確かめられない

## 地雷・注意(`AGENTS.md`・`docs/operations.md` にないもの)
- **画面の確認方法**: Playwright はプロジェクトに入れていない。`~/samasama/.qa-tools/` に `playwright-core` と撮影スクリプト。ブラウザ本体は `~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`
- **メール変更は新しいアドレスだけの 1 段階確認**(Secure email change は OFF)。確認メールは新旧両方に届くが仕様。リンクの有効期限は 1 時間。Staging は SMTP がないので届かない
- **Staging のテスト用アカウント**(2026-10-26 確認): 相談者 `sos01@gmail.com` / サポーター `npo01_1@gmail.com`(団体 tanabe の OWNER)、どちらも `testpass123`。管理者 `admin0001@example.com`(`SamaAdmin#2026kq`、ADM-00004、ダミー)と `newsadmin01@example.com`(`NewsAdmin#2026`、ADM-00003)。画面確認用に相談者 `manual.sos01@example.com`(`ManualTest#2026`、表示名「はなこ」、2026-10-30 作成。相談 4 件は解決済み 1・取り消し 3、お問い合わせ INQ-00005 も確認用)と、tanabe の MEMBER `manual.sup01@example.com`(`ManualSup#2026`、担当者名「佐藤 一郎」)
- Staging と本番のスキーマは一致している(多言語の列は `users.locale` / `cases.locale` だけ、`news_posts` は両方にある)
- ローカルの Vercel CLI は古い個人プロジェクトにリンクされたまま。デプロイの状態は `gh api repos/samasama20260101/sdgs-matching-platform/commits/<sha>/status` で見る
- **リポジトリの外にある資料**(今の担当者の PC の `~/samasama/` にあり、次の担当者の手元にはない。引き継ぐなら別に渡す):
  - 配布物: `~/samasama/docs_退避_20260925/配布物/`
  - 相談フォーム改善提案・NPO インタビュー作戦など: `~/samasama/docs_退避_20260925/proposals/`
  - 営業用 PowerPoint テンプレート: `~/samasama/営業資料/`
  - 説明ドキュメント「案件登録QA 作り直し(指標ベース)」: https://claude.ai/code/artifact/69f7caf3-563d-4cff-b359-e5e2d30176a7
