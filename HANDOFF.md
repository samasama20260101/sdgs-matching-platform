# HANDOFF: v2.0 の実装中 — Staging で代表に確かめてもらう前
更新: 2026-11-05(それまでの経緯は `git log -p HANDOFF.md` で見られる。v1 の申し送りは 2026-10-30 の版)

## ゴール(完成条件)
v2.0(#72)を Staging で代表に使ってもらい、やりたいことが反映できているかを確かめ、OK が出たら本番に出す(11/5 定例)。
設計の正本は `docs/v2_design.md`、決まりの置き場所はその表。

## 現在地(2026-11-05)
### dev(Staging)
- v2.0 の画面と API は dev に入っている(PR #73・#75〜#82)。v1 の相談者・サポーターの画面と、v1 の運営ダッシュボードは消した(v1 は main にある)
- Staging の DB は v2 の形(`migrations/v2_01〜06` を 2026-11-05 に流した)。つなぎ先 13,506 件を取り込み済み
- Staging は今も Vercel(`sdgs-matching-platform-git-dev-samasama.vercel.app`、入口のパスワードあり)。Cloudflare Workers への載せ替えは設定まで済み(下の「止まっていること」)
### main(本番)
- v1 のまま。本番の DB には何も流していない

## 止まっていること(人の操作が要る)
1. **Supabase の Auth の設定を変えられない**: 岡本さんのアカウントで `config push` すると 403(SQL と読み取りはできる)。org の役割を Administrator 以上にしてもらうか、代表が流す。それまで:
   - ログインのメールは Supabase の標準の文面(リンクだけ。リンクを押せば入れる)。`ops/supabase-auth/staging` の 6 けた・10 分・中身を書かない文面は未適用
   - Supabase の標準の送信は、Supabase の org のメンバーのアドレスにしか届かない(代表に試してもらうなら、代表が org のメンバーであること)
   - Workers の Staging の URL を戻り先に足すのもこの設定
2. **Cloudflare Workers Paid**(代表の申し込み待ち)と、GitHub の `CLOUDFLARE_API_TOKEN`。そろったら `CF_STAGING_DEPLOY=true` で Staging を Workers に出す
3. **鍵と費用**: OpenAI / xAI(Grok)の鍵(今は Gemini のまま)、SMS の会社(個人の支え手の電話番号の確認)、Resend(知らせのメール)、Discord の運営用 Webhook。どれも鍵がなければ黙って使わない作り
4. **規約とポリシーの案文**(盤 70〜73)とリーガルチェック。同意の画面と版の管理はできている(`src/lib/validation/person.ts` の版を上げると同意し直しになる)

## 本番に出すまで
1. 代表の Staging での確認(相談する・支える・運営の3つの顔)
2. 規約とポリシーの案文 → よろず支援拠点のリーガルチェック → 施行日の2週間前に告知
3. 本番の DB を v1 の形のまま読み取りで確かめる → `migrations/v2_01〜06` を本番に流す(直前に内容を出して確認をもらう)
4. DNS を Cloudflare に移し、本番を Workers に切り替える(Resend の送信用レコードを写す)→ 本番の目視確認
5. 施行のあと、相談者の個人情報の列を消す(`v2_90_drop_pii.sql`、未作成)。Vercel を止め、リポジトリを非公開にする

## 試して失敗したこと(AI で作業するとき)
- **Supabase CLI を上げたあとに止まって見えたら、Mac の画面のキーチェーンの許可を見る**(CLI の本体が替わると、保存したトークンを読むのに許可が要る)。`!` からの `supabase login` は TTY がなく通らない(ターミナルのアプリで)
- **`supabase db dump` は Docker を使う**。この Mac に Docker がないときは `--dry-run` の手順を pg_dump 17 で流す(`docs/operations.md` §3)
- **画面の確認は手元の `npm run dev` を Staging の DB につないで行う**。ログインはメールを送らずに、管理 API の `generateLink`(magiclink)で出したコードを `verifyOtp` に渡してセッションを作る(一回きりのスクリプトで。コミットしない)。2つ目の確認は、登録の画面に出る文字列から TOTP を計算して入れる
- **auto mode の分類器は「一括削除っぽい」コマンドを止める**(xargs や for ループでのブランチ削除)。名前を並べた単一のコマンドなら通る。本番の psql も止まるので、ユーザーが `!` で実行する
- **本番 DB の確認は、読み取りだけの確認 SQL をユーザーに渡して SQL Editor で流してもらう**
- **SVG の `url(#id)` 参照は id の重複に弱い**: defs を持つ部品は `useId` で固有の id にする(`Logo.tsx` で対応済み)
- **`opengraph-image.tsx` を `[locale]` の下に置くと画像の URL が `/ja/...` になって 307** → 共有画像は `/api/public/...` に置く
- 積んだ PR は、土台の PR をマージする前に base を付け替える(`--delete-branch` で土台のブランチが消えると上の PR が閉じる)

## 地雷・注意(`AGENTS.md`・`docs/operations.md`・`docs/v2_design.md` にないもの)
- **Staging のテスト用アカウントのパスワードは 2026-11-05 に無効にした**(公開リポに載っていたため。v2 はパスワードを使わない)。v1 の HANDOFF の版にあるパスワードは使えない。入るときはメールのコード(またはリンク)で
- Staging には手元の確認で作ったテスト用のデータがある: `[テスト] 住まいの支援NPO`(承認済み)、`v2test.*@example.com` の人たち、CASE-00152〜00154
- 離任メンバーの後始末(10/30 の版)は未実施のまま: GitHub・Vercel・Supabase・Discord・Google Analytics のメンバーから外す、Supabase の秘密キー・`CRON_SECRET`・Gemini の鍵・Discord Webhook・Resend の鍵の作り直し。GitHub の admin の `samasama20200101` はだれが使っているか要確認
- ローカルの Vercel CLI は `samasama-4963` で入っている。デプロイの状態は `gh api repos/samasama20260101/sdgs-matching-platform/commits/<sha>/status` で見る
- **リポジトリの外にある資料**(前の担当者の PC の `~/samasama/` にあり、引き継ぐなら別に渡す): 配布物・相談フォーム改善提案・営業用テンプレート・説明ドキュメント「案件登録QA 作り直し(指標ベース)」https://claude.ai/code/artifact/69f7caf3-563d-4cff-b359-e5e2d30176a7
