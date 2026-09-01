# HANDOFF: 技術負債返済 + アカウント設定の穴埋め(本番反映・検収完了)
更新: 2026-09-01(auto-close 30日化を本番反映)

## ゴール(完成条件)
災害SOS拡散フェーズと並行して、本番稼働で見えてきた技術負債とUXの穴を潰す。
今回のスコープ (1) admin APIのレガシー列参照 (2) ログイン中のパスワード変更導線 (3) 8/26〜29の小改善4件 は **本番反映済み**。
将来は「マッチ済みサポーターが行政等を招待して連携」方式を設計する(現1対1はその布石)。

## 現在地
**2026-08-29 PR #29 で dev→main マージ・本番デプロイ success。2026-09-01 ユーザーが本番で実操作検収済み(下記)。このフェーズは完了。**
main = `3ab003f`、dev はコード的に本番と同一(差分はHANDOFFのみ)。DB操作は今回なし。
未コミット2件は 2026-09-01 に dev へコミットし、同日 **PR #30 で本番反映済み**(main = `8e19060`・デプロイ success)。MATCHED無活動の自動CLOSEDは本番でも30日で動く(次回cronは毎日2時)。

## 完了したこと
- **本番反映(PR #29、13コミット・38ファイル)** — 内容:
  - admin API(stats / inquiries)の団体名・種別を organizations 正本から読む `d03f671`(Staging実データ照合済み)
  - ログイン中のパスワード変更導線 `9ccab04`(`/profile` パスワードカード、`/change-password` を initial/voluntary 2モード化。判定は get-role の `must_change_password`)
  - サポーター団体の入口 `6338737`(トップ・サポーター一覧・フッター → `SUPPORTER_RECRUIT_URL` = www.samasama.site/supporter、外部リンク・新規タブ)
  - 表示言語フィールドの非表示 `33b7ad8`(フラグ `LANGUAGE_SWITCHER_ENABLED` を `src/i18n/routing.ts` に集約。非表示中は profile 保存で locale を送らない)
  - 長い団体名でカードが崩れる修正 `70cd79c`
  - 個人情報を書かない注意文を自由記述欄の直上へ `b416a5f`(災害フォームは専用文言)
  - 各Qの「その他」自由記述を廃止 `a97a84f`(翻訳キー9件×6言語削除、238キーで一致)
- **本番実操作検収(2026-09-01・ユーザー)**: パスワード変更(自発モード)と初回ログイン導線の回帰、管理ダッシュボードの団体名表示 → いずれもOK
- **本番検証(2026-08-29)**: `/` `/supporters` `/en` `/en/supporters` 200 + 募集リンク出力(新ビルド配信の証拠)、`/login` 200、get-role 無トークン401
- **Staging検証(a97a84f)**: get-role が `must_change_password` を返す、募集リンク出力、sos01/npo01_1 でサインイン可
- 前フェーズ(2026-08-16): PR #26/#27/#28、display_id形式統一とUNIQUE付与(本番適用済み)、詳細は git log

## 試して失敗したこと ★最重要
- **`git merge-tree --write-tree` は git 2.34 では未対応**で usage を出して非0終了 → 「CONFLICT」と誤判定しかけた。衝突検査は `git diff --stat origin/main <devの祖先>` が空か、で判断するのが確実
- **Stagingの `/ja` を curl すると 307** → dev-login ゲートと思い込んだが、実際は next-intl の既定ロケール `/ja`→`/` リダイレクト(本番も同じ)。Stagingの公開ページ検証は `/`・`/en` で行う
- Stagingは全パスに `dev-login` ゲート(`src/proxy.ts`)。curl で通すには cookie `dev-auth=<DEV_PASSWORD>`(.env.local の値がそのまま使えた)。APIは Bearer トークンだけでは通らず cookie も必要
- `/sos/hearing` `/profile` `/change-password` はクライアント描画+ログイン必須で、curlでは中身を検証できない。パスワード変更の実操作検証は人手のブラウザ操作しかない(Playwright未導入)
- 8/21セッションの教訓(継続): 負債メモは着手時に周辺をgrepし直す/`t()` を触ったら6言語のキー数一致を確認/本番psqlはユーザーが `!` で実行/`docs/staging_users_*.csv` はコミット禁止
- 前フェーズまでの教訓は git log の過去HANDOFF参照

## 次の一手
1. `docs/proposals/`(戸山十三ヒアリング資料4本・成長戦略・相談フォーム改善提案、md+pdf)と `scripts/md2pdf.sh` + `scripts/lib/` の追跡可否を決める。相談フォーム改善提案は依頼者の決定待ち(§10)
2. 拡散タスク(ユーザー作業): Resend Proアップグレード / Instagramリンク設定+投稿 / pptxスライド12とリーフレットの連絡先記入 / 八代市「郡築」表記確認
3. 技術負債: スキーマ差分照合スクリプト(read-only本番PG vs Staging)をリリース手順に組込み。`users.supporter_type` / `users.organization_name` 列のDROP migration(読み取り側が全部organizationsに寄ったことを本番で確認後)
4. 数週間問題なければ本番の `display_id_backup_20260816` テーブルをDROP(ユーザー実行)

- **`feature/account-email-change` は保留中(2026-09-01 ユーザー判断・まだdevに入れない)**。メール変更(`/change-email`)+現在パスワード確認(メール変更・パスワード変更とも)+管理ユーザー編集拡張が実装済み(+4コミット・origin push済み)。再開時: dev取り込み(衝突は profile/page.tsx のみ見込み)→ SMTP(Resend)設定 → Staging検証 → チェックポイントPR。Stagingがメール送信不可のため確認メールの実機検証はSMTP設定が前提

## 地雷・注意
- **本番Supabaseへの変更操作はユーザー明示許可なしに絶対に実行しない**(こちらはread-only接続のみ。auto modeでは本番psqlがブロックされるのでユーザーが `!` で実行)
- **パスワード変更に現在パスワード確認は未実装**(意図的に後回し)。実装するなら Supabase `updateUser` は現PWを検証しないので、入力された現PWで `signInWithPassword` を叩いて確かめる自前実装が要る
- **管理者は `/profile` に入れない**(role が `'SOS' | 'SUPPORTER'`)ため、管理者のパスワード変更は forgot-password 頼み。メール変更・退会も未整備
- Stagingテストユーザー: sos01@gmail.com / npo01_1@gmail.com(testpass123)、管理者 x25660@yahoo.co.jp(PW不明)。検収でPWを変えたらここも直す
- `users.supporter_type` / `users.organization_name` 列は未DROP(`admin/create-supporter` は両方に書く。害はない)
- 多言語再公開は `src/i18n/routing.ts` の `LANGUAGE_SWITCHER_ENABLED` + `localeDetection` の2点(旧記述「フラグ2箇所」は解消済み)。ko/vi/idは緊急語彙ネイティブ確認が前提
- 災害データは `cases.intake_qna.disaster` 配下(migration不要方針)。正本は `src/lib/constants/disaster.ts`
- ビルド検証は exit code と「Generating static pages (115/115)」で判定
- 環境差: Stagingはメール確認OFF・dev-loginゲートあり/本番はメール確認ON
- ローカルの Vercel CLI は古い個人プロジェクト(stanabe/...)にリンクされたまま。samasamaチームのデプロイ状況は `gh api repos/.../commits/<sha>/status` で見る
- チャットに貼られたResend APIキーは落ち着いたら再発行→Supabase SMTP再設定
- `docs/staging_users_20260806.csv` はユーザー一覧のためコミット禁止。docs/配布物(pptx・PDF・インスタ画像)は未追跡のまま
- 将来の招待方式を作る際、共有メモ(APPROVED_SUPPORTERS)の過去データはDBに残っている(表示のみ廃止)
- 本番にテスト用SOSアカウント(捨てアドレス)が1つ残存
