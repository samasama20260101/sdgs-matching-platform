# HANDOFF: v2.0 の実装中 — Staging で代表に確かめてもらう前
更新: 2026-11-10(それまでの経緯は `git log -p HANDOFF.md` で見られる。v1 の申し送りは 2026-10-30 の版)

## ゴール(完成条件)
v2.0(#72)を Staging で代表に使ってもらい、やりたいことが反映できているかを確かめ、OK が出たら本番に出す(11/5 定例)。
設計の正本は `docs/v2_design.md`、決まりの置き場所はその表。

## 現在地(2026-11-09)
### dev(Staging)
- v2.0 の画面と API は dev に入っている(PR #73・#75〜#82、#98〜#108)。v1 の画面と部品は消した(v1 は main と `archive/mask-lab-2026-11` などのタグにある)
  - 11/5 夜〜11/6 に入れたもの: 本番前の直し(#98〜#101)、使っていないコードの削除(#102・#103)、性能(#104)、lint を CI で警告 0 件(#105)、古い見た目の画面を v2 に(#106)、団体の活動地域の編集(#107)、体験ページの「近いもの」を AI で出す・回数の上限を DB で(#108)、AI のモデルを OpenAI の `gpt-6-luna` と xAI の `grok-4.20-0309-non-reasoning` に決めて設定(鍵はまだ)
- Staging の Auth の設定(`ops/supabase-auth/staging`: 6 けた・10 分・中身を書かないログインのメール、戻り先に Workers の Staging と localhost)は 2026-11-06 に流した(代表が Supabase の役割を上げてくれた)。ログインのメールに 6 けたのコードが入るようになった(届くのを確かめた)。送り主はまだ Supabase の標準(表示名「Supabase Auth」)
- Staging の DB は v2 の形(`migrations/v2_01〜14`。v2_11・12 は 2026-11-06、v2_13 は 2026-11-11、v2_14 は 2026-11-12 に流した)。つなぎ先 13,506 件を取り込み済み
- Staging は Vercel(`sdgs-matching-platform-git-dev-samasama.vercel.app`)と Cloudflare Workers(`samasama-app-staging.samasama.workers.dev`)の両方で動いている。**入口のパスワードは 2 つで別の値**(Workers の値は手元の `.env.workers-staging.local`。Git には入れない)。Workers は dev への push で自動で出る
- 2026-11-09: 支える側は18歳以上(`canSupportAtAge`)、16歳未満の方への保護者の同意の案内(`GuardianConsentNote`)を入れた。案内だけで、同意の記録はしていない(DB に持つものを増やさない約束があるので、リーガルチェックの答えを見て決める)
### main(本番)
- v1 のまま。本番の DB には何も流していない

## 止まっていること(人の操作が要る)
1. **ログインのメールの送り主**: Supabase の標準の送信のままで、Supabase の org のメンバーのアドレスにしか届かない(代表に試してもらうなら、代表が org のメンバーであること)。本番は Resend(samasama のドメイン)を Auth の SMTP にする。Staging の site_url は Vercel のまま(コードで入るので困らない)
2. **AI の鍵**: 2026-11-09 に `OPENAI_API_KEY`・`XAI_API_KEY` を Workers の Staging の Secret に入れた(手元は `.env.workers-staging.local`)。両社とも指定のモデルと `response_format: json_object` が通り、体験ページの「近いもの」は AI で平均 3 秒ほど。費用の目安は 2 社合計で月 3 万円(代表)。OpenAI の支出の上限は「強制しない」設定で、自動の入金もオンなので、本番の前に止め方を代表と決める。本番の鍵は別に作る
3. **Google ログイン**: Staging で使える(2026-11-10)。GCP のプロジェクト `samasama-app` の同意画面はテスト中で、入れるのはテストユーザー(岡本・代表)だけ。OAuth クライアント `samasama-app-staging` の設定は `ops/supabase-auth/staging`、シークレットは手元の `.env.workers-staging.local` の `GOOGLE_OAUTH_CLIENT_SECRET`(push のときに環境変数で渡す)。本番は、同意画面の公開(ブランディングの URL とサポートのメールを代表のものに)と本番用のクライアントを作ってから
4. **ほかの鍵と費用**: SMS の会社(個人の支え手の電話番号の確認)、Resend(知らせのメール。Workers にはまだ入れていない)。どれも鍵がなければ黙って使わない作り。Workers Paid・GitHub の `CLOUDFLARE_API_TOKEN`・`CF_STAGING_DEPLOY=true` は 2026-11-05 にそろい、dev への push のたびに Workers の Staging に出る
5. **規約とポリシーのリーガルチェック**: 11/9 版(代表の答えと改正個人情報保護法を反映。OneDrive の `700_岡本/v2.0_規約とポリシーの改定案_20261109/`)を代表へ送り、よろず支援拠点のリーガルチェックを頼んだ。チェックが済んだら、本文を `/terms`・`/privacy` と支える側の決まりの画面に入れ、`src/lib/validation/person.ts` の版を上げる(版を上げると、初めて入るときに同意し直しになる)

## 本番に出すまで
1. 代表の Staging での確認(相談する・支える・運営の3つの顔)
   - 運営は、相談する・支えるとは別のアカウントで入る(v1 と同じ。役割 ADMIN のアカウントは支える側の画面を使えない)。本番は v1 の運営アカウントが ADMIN のまま残り、初めて入るときに認証アプリを登録する。Staging には代表の運営アカウントがまだない(2026-11-11。v1 で使っていたメールを代表に確認中)
   - 個人の支え手は電話番号の確認(SMS)が済むまで申し出られない。SMS の会社は未契約(2026-11-11 に SMS を入れる方向と決め、候補と費用を代表に出す)
2. 規約とポリシーのリーガルチェック → 本文を画面に入れる。前もっての告知期間は置かず、公開の日に施行し、今の利用者には初めて入るときに同意をもらい直す(2026-11-05 岡本さん。10/30 の「2週間前に告知」は取りやめ)
3. 本番の DB を v1 の形のまま読み取りで確かめる → `migrations/v2_01〜14` を本番に流す(直前に内容を出して確認をもらう。v2_13 は v1 で「ADMIN」にした団体のメンバーを OWNER に移すので、件数も出す)
   - 本番の Auth の設定(6 けたのコードのメール・戻り先・送り主)も入れる。今は `ops/supabase-auth/staging` しかないので、本番の分を作ってから(権限は 2026-11-06 にそろった。本番に流すのは直前に確認をもらう)
4. DNS は 2026-11-09 に Cloudflare へ移した(レコードは DNS only のまま Vercel 向き、Resend の分も写した)。本番を Workers に切り替える → 本番の目視確認
5. 施行のあと、相談者の個人情報の列を消す(`v2_90_drop_pii.sql`、未作成)。Vercel を止め、リポジトリを非公開にする

## 試して失敗したこと(AI で作業するとき)
- **Supabase CLI を上げたあとに止まって見えたら、Mac の画面のキーチェーンの許可を見る**(CLI の本体が替わると、保存したトークンを読むのに許可が要る)。`!` からの `supabase login` は TTY がなく通らない(ターミナルのアプリで)
- **`supabase db dump` は Docker を使う**。この Mac に Docker がないときは `--dry-run` の手順を pg_dump 17 で流す(`docs/operations.md` §3)
- **画面の確認は手元の `npm run dev` を Staging の DB につないで行う**。ログインはメールを送らずに、管理 API の `generateLink`(magiclink)で出したコードを `verifyOtp` に渡してセッションを作る(一回きりのスクリプトで。コミットしない)。2つ目の確認は、登録の画面に出る文字列から TOTP を計算して入れる
- **auto mode の分類器は「一括削除っぽい」コマンドを止める**(xargs や for ループでのブランチ削除)。名前を並べた単一のコマンドなら通る。本番の psql も止まるので、ユーザーが `!` で実行する
- **本番 DB の確認は、読み取りだけの確認 SQL をユーザーに渡して SQL Editor で流してもらう**
- **SVG の `url(#id)` 参照は id の重複に弱い**: defs を持つ部品は `useId` で固有の id にする(v1 の `Logo.tsx` は消した。今の印 `Mark` は defs を持たない)
- **`opengraph-image.tsx` を `[locale]` の下に置くと画像の URL が `/ja/...` になって 307** → 共有画像は `/api/public/...` に置く
- 積んだ PR は、土台の PR をマージする前に base を付け替える(`--delete-branch` で土台のブランチが消えると上の PR が閉じる)

## 地雷・注意(`AGENTS.md`・`docs/operations.md`・`docs/v2_design.md` にないもの)
- **Staging のテスト用アカウントのパスワードは 2026-11-05 に無効にした**(公開リポに載っていたため。v2 はパスワードを使わない)。v1 の HANDOFF の版にあるパスワードは使えない。入るときはメールのコード(またはリンク)で
- Staging には手元の確認で作ったテスト用のデータがある: `[テスト] 住まいの支援NPO`(承認済み・活動地域は未登録)、CASE-00152〜00154、`v2test.*@example.com` の人たち
  - `v2test.new2`(相談 3 件)・`v2test.npo-staff`(上の団体の管理)・`v2test.person1`(団体は 2 つとも却下・停止で、支える顔なし)・`v2test.admin`(運営。2つ目の確認つき。TOTP の秘密は作った人の手元だけ)。個人の支え手のテスト用ユーザーはいない
  - `[テスト] 年齢確認 SUPPORT`・`[テスト] 年齢確認 CONSULT`(2026-11-09 の18歳の確認で作り、ARCHIVED にした。最後の管理者を消せない DB の決まりで消せない)と、その管理者の呼び名 `テスト17`・`テスト18`(Auth のアカウントは消した)
- サイト全体の共有画像(`public/og-image.png`。「中文」とキャラクター入り)と favicon・ホーム画面の印は v1 のまま。作り直すかは代表の判断
- 離任メンバーの後始末(10/30 の版)は未実施のまま: GitHub・Vercel・Supabase・Discord・Google Analytics のメンバーから外す、Supabase の秘密キー・`CRON_SECRET`・Gemini の鍵・Discord Webhook・Resend の鍵の作り直し。GitHub の admin の `samasama20200101` はだれが使っているか要確認
- ローカルの Vercel CLI は `samasama-4963` で入っている。デプロイの状態は `gh api repos/samasama20260101/sdgs-matching-platform/commits/<sha>/status` で見る
- **リポジトリの外にある資料**(前の担当者の PC の `~/samasama/` にあり、引き継ぐなら別に渡す): 配布物・相談フォーム改善提案・営業用テンプレート・説明ドキュメント「案件登録QA 作り直し(指標ベース)」https://claude.ai/code/artifact/69f7caf3-563d-4cff-b359-e5e2d30176a7
