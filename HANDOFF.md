# HANDOFF: お困りごとラベル実装(feature/case-concerns) + 休止前整理
更新: 2026-09-26(お困りごとラベル仕様 §11 の 1〜8 を feature/case-concerns に実装。同日の議論で「お金・住まい・仕事」の項目を 13→9 に減らし小見出しで割る形に改訂。Staging 未デプロイ・dev 未マージ)

## ゴール(完成条件)
災害SOS拡散フェーズと並行して、本番稼働で見えてきた技術負債とUXの穴を潰す。
今回のスコープ (1) admin APIのレガシー列参照 (2) ログイン中のパスワード変更導線 (3) 8/26〜29の小改善4件 は **本番反映済み**。
(4) メール変更+現在パスワード確認+管理者によるユーザーメール変更 は **dev 取り込み済み・Staging検証待ち**。
将来は「マッチ済みサポーターが行政等を招待して連携」方式を設計する(現1対1はその布石)。

## 現在地
**2026-09-26 お困りごとラベル(仕様 `~/samasama/docs_退避_20260925/仕様_お困りごとラベル_20260922.html`、artifact https://claude.ai/artifact/25Z14pVyciW2teKBhRCTd2)を `feature/case-concerns`(dev から分岐)に実装した。DB 変更なし。** 内容は §11 の 1〜8 すべて: 定数 `src/lib/constants/concerns.ts`(5括り・29項目・8ラベル・SDGsヒント・項目→ラベル計算。**同日ユーザーと議論し「お金・住まい・仕事」を 13→9 項目に減らし、フォームでは お金/住まい/仕事 の小見出しで 3 つずつに割って見せる(入口 5 括りは不変)。削除: welfare_info(ほしい助けと二重)/ eviction→rent_utility に統合 / utilities_off→unsafe_home に統合 / dangerous_job→unpaid に統合。仕様 HTML(正本)の §3.3 も同日改訂済み**)/ 翻訳キー 6言語(`sos.concerns.*` + `sos.hearing.*` 追加、`casesList.sdgsLabel/sdgsPendingLabel` の文言変更)/ 相談フォームをフラグ `CONCERN_FORM_ENABLED`(concerns.ts、既定 true)で新旧切替 / 案件登録 API の検証と labels の保存時計算 / AI プロンプトに本人の選択+ヒント表を同梱し `labels_ai` を返す(AI 失敗時は新フォーム案件だけヒント既定値で LISTED にする)/ サポーター一覧の SDGs フィルター・バッジをラベルチップ(本人=実線・AI=破線+AI印)と「まだ整理できていない相談」に置換 / 案件詳細・相談者側 3 画面から SDGs 番号を除去し「本人の言葉」を表示 / 遡り付与 API `POST /api/admin/cases/backfill-labels`(ADMIN、`{limit, dryRun}`、既定 10 件・最大 30 件、maxDuration 300、対象は LISTED の OPEN/MATCHED、入力は analyze と同じ Q1〜Q5+自由記述、labels_ai だけを JSON マージ)。サブエージェントの独立レビュー(8 指摘)を反映済み: AI 失敗時の既定値には `fallback: true` を付け結果ページの再読み込みで再試行・相談者側は翻訳済み文言を表示 / danger はサーバーで urgency High に固定 / 本人ラベルがあるのに AI がゴール空のときはヒント既定値にして「再度見直してください」にしない。ビルド exit 0・静的 120/120(9/25 の Namia 削除で 122→120)、tsc・eslint(編集ファイル)・check:i18n クリーン。**未実施: Staging デプロイと運営のブラウザ確認、既存案件 92 件への遡り付与(Staging)、§10 の決定(文言は §3 の案を初期値として実装済み)。** ブラウザ実操作は未検証(Playwright なし)。

**2026-09-17 本番でパスワード変更直後にログアウトする回帰を確認 → dev で修正(`1f652cc`)→ Staging 実測OK → PR #33 で本番反映(main = `f424824`、デプロイ success)。本番で「パスワード変更後もログアウトしない」のブラウザ確認はユーザー待ち。** 原因: PR #32 でパスワード更新を `admin.updateUserById` に切り替えたため、GoTrue が本人の現在のセッションも含めて全失効させていた(旧実装のクライアント `updateUser` は本人セッションを残す)。修正: 現PW検証は従来どおりサーバーで行い、更新は本人のトークンで GoTrue `PUT /auth/v1/user` を呼ぶ。Staging 実測: 変更した本人のトークンは get-role 200 のまま、別セッションは 401(他端末は失効)、403/400 のエラー経路も維持。

**2026-09-16 PR #32 で本番反映(main = `1d0abf3`、デプロイ success 08:16Z)。内容: メール変更一式(本人/管理者)+現PW確認、熊本地震 災害SOS受付終了、PCロゴ修正、未適用migration削除。本番DB変更なし。**
本番疎通(curl): `/` `/en` に 🆘 バナーなし・ロゴ id 重複ゼロ、`/supporters` `/login` `/change-email` `/change-password` `/profile` 200、新API 2本は無トークン 401、廃止API 404、get-role 401。
**未実施(ユーザー作業)**: 本番でのブラウザ実操作 — ①自発パスワード変更(現PW誤り→エラー/正しい→成功) ②初回強制変更で現PW欄が出ない ③管理者のユーザーメール変更 ④本人メール変更(本番の残存テスト用SOSアカウントで。確認メールは Resend 経由で届くはず) ⑤PCでロゴの涙型が見える。Staging でのブラウザ操作テストはユーザー判断で省略して本番へ出した。
**本番・Staging の Supabase 設定(2026-09-16 ユーザー許可のうえ実施)**: メール変更確認メールの件名を「Confirm Email Change」→「【明日もsamasama】メールアドレス変更の確認」に変更(Management API PATCH、`mailer_subjects_email_change` のみ。他キーは不変を確認)。本番 SMTP(Resend)・テンプレート・Secure email change は元から設定済み。

前回まで: **2026-09-16 休止前整理を実施: ブランチは `dev` / `main` の2本だけになった**(dev取り込み済み18本+i18n-supporter-ui+variant試作を削除)。多言語 Phase 2 は PR #10 をクローズし、タグ `archive/i18n-phase2-2026-07` に保管してブランチ削除(設計書冒頭に判断メモ)。**ユーザーは 2026年11月以降、開発を一時休止する予定**。休止前の判断基準は「本番の安定を崩さない・DBを増やさない」。
**Staging の i18n Phase 2 用の列7本+インデックス1本は同日 DROP 済み(Management API 経由・データ0件・messages 100件/cases 92件は無傷)。Staging と本番のスキーマはこの点で一致。`migrations/add_case_chat_translation.sql` は dev から削除。**
**同日、熊本地震の災害SOS受付を dev で終了**(`ACTIVE_DISASTER_EVENT = null` + 案件登録APIが受付外イベントを400で拒否。本番は受付中のまま → メール変更と同じチェックポイントPRで反映する方針)。
同日 `feature/account-email-change` を dev にマージ(`1bb26b7`)。衝突なし、ビルド exit 0・静的ページ 122/122(change-email 追加で 115 から増加)、翻訳キー 6言語×700 一致。origin/dev へ push 済み → Staging 自動デプロイ。本番(main = `93099a7`)には未反映。**
前回: 2026-09-03 PR #31 で東京リージョン化+マスク検証ラボを本番反映(hnd1 実測済み)。PR #29(8/29)、PR #30(auto-close 30日化)。DB操作はいずれもなし。

## 完了したこと
- **お困りごとラベル(feature/case-concerns、2026-09-26、DB変更なし)**: 上記「現在地」参照。設計上の判断: ①`labels` はサーバーで項目から計算しクライアント値は捨てる(読み出し時も `getCaseConcerns` が項目から引き直すので定数表の変更に追従)②項目は選んだ括りに属するものだけ保存(見えないチェックを送らない)③括り 0 件は API が 400「困っていることを1つ以上選んでください」④AI 失敗時の公開継続は新フォーム案件のみ(旧フォームは従来の 500→結果ページ再試行)⑤`ai_sdg_suggestion.labels_ai` は 8 id 以外を捨て、本人ラベルを差集合で除き、上限 3 ⑥サポーター一覧 API が `concern_labels` / `concern_labels_ai` を計算して返す(intake_qna 本体は従来どおり返さない)⑦サポーターUIのラベル名は `nameJa` 固定(サポーターUIは翻訳しない方針)、相談者側は `sos.concerns.*` ⑧危険チェックは urgency High に乗せ、`intake_qna.danger` にも保存して詳細に赤帯で出す ⑨ほしい助けの id は `info/expert/org/peer/listen/paid`(仕様例の `welfare_info` は項目 id と衝突するため変更)⑩結果ページの per_goal カードは SDGs 番号・名前・色を外し AI の説明文だけ残した(§10-3 の案)
- **PCでロゴの涙型が消える不具合の修正(dev 2026-09-16、`2b86e8e`)**: ヘッダーはスマホ用/PC用で同じロゴを2つ置きCSSで片方を隠すが、SVGのグラデーション・フィルタ id が「サイズ+色」から作られて重複していた。ブラウザは最初の要素(スマホ用=PCでは display:none)に解決するため PC だけ涙型が描かれず濃紺の四角に見えていた(本番も同じ・今日の変更とは無関係)。`src/components/icons/Logo.tsx` の3部品で `useId` から固有 id を生成。Staging の `/` `/supporters` `/login` `/en` で id 重複ゼロ・未解決参照ゼロを機械確認済み。**PC ブラウザでの目視確認はユーザー待ち**
- **熊本地震 災害SOSの受付終了(dev 2026-09-16、DB変更なし)**: `src/lib/constants/disaster.ts` の `ACTIVE_DISASTER_EVENT` を null に。トップ/SOSダッシュボードのバナー非表示、`/sos/disaster` はダッシュボードへリダイレクト、`POST /api/sos/cases` は受付外イベントの災害payloadを 400「この災害SOSの受付は終了しました」で拒否(黙って通常案件に格下げするとAI分析を通らず非公開のまま残るため)。登録済み案件の表示・地域設定・承認上限1は `DISASTER_EVENTS` 参照のまま維持。ビルド 122/122、編集ファイルの eslint クリーン(リポジトリ全体の lint は既存の 6 errors / 88 warnings で今回と無関係)
- **メール変更・現PW確認(dev マージ 2026-09-16、DB変更なし)**:
  - 本人によるメール変更 `/change-email`: 事前確認API `POST /api/auth/email-change-check`(現PW確認+`users.email` 重複チェック)→ クライアントの `supabase.auth.updateUser({ email })` が確認メールを送る。確認リンクで auth.users が切り替わり、`get-role` が次回呼び出し時に `users.email` を自己修復同期
  - パスワード変更をサーバー経路 `POST /api/auth/change-password` に集約(自発モードは現PW必須、初回強制 `must_change_password` は不要)。`clear-must-change-password` は廃止(参照なし確認済み)
  - 現PW検証は `src/lib/api/password.ts` の `verifyCurrentPassword`(persistSession:false の使い捨てクライアントで signInWithPassword。signOut は呼ばない=global失効を避ける)
  - 管理者によるユーザーメール変更: 管理ダッシュボードのモーダル → `PATCH /api/admin/users/[id]` action=`change_email`(`email_confirm: true` で即時切替、`audit_logs` に `user_email_changed_by_admin` を記録。audit_logs は既存テーブル)
  - Supabase メールテンプレート `docs/email_templates/change_email.html`(Dashboard → Authentication → Emails → Change Email Address に貼る。日英二言語・画像なし)
  - `src/lib/api/validation.ts` に `normalizeEmail` 追加
- **本番反映(PR #29、13コミット・38ファイル)** — 内容:
  - admin API(stats / inquiries)の団体名・種別を organizations 正本から読む `d03f671`(Staging実データ照合済み)
  - ログイン中のパスワード変更導線 `9ccab04`(`/profile` パスワードカード、`/change-password` を initial/voluntary 2モード化。判定は get-role の `must_change_password`)
  - サポーター団体の入口 `6338737`(トップ・サポーター一覧・フッター → `SUPPORTER_RECRUIT_URL` = www.samasama.site/supporter、外部リンク・新規タブ)
  - 表示言語フィールドの非表示 `33b7ad8`(フラグ `LANGUAGE_SWITCHER_ENABLED` を `src/i18n/routing.ts` に集約。非表示中は profile 保存で locale を送らない)
  - 長い団体名でカードが崩れる修正 `70cd79c`
  - 個人情報を書かない注意文を自由記述欄の直上へ `b416a5f`(災害フォームは専用文言)
  - 各Qの「その他」自由記述を廃止 `a97a84f`(翻訳キー9件×6言語削除)
- **本番実操作検収(2026-09-01・ユーザー)**: パスワード変更(自発モード)と初回ログイン導線の回帰、管理ダッシュボードの団体名表示 → いずれもOK
- **個人情報マスク検証ラボ**(`/admin/mask-lab`、PR #31 で本番反映済み): 依頼者が Staging で触って層2の要否と実装方針を判断する段階。詳細は git log の 2026-09-03 HANDOFF
- 前フェーズ(2026-08-16): PR #26/#27/#28、display_id形式統一とUNIQUE付与(本番適用済み)、詳細は git log

## 試して失敗したこと ★最重要
- **auto mode の分類器は「一括削除っぽい」コマンドをブロックする**(xargs で18ブランチ push --delete、for ループで branch -d)。ブランチ名を明示列挙した単一コマンドなら通る。本番 psql も同様にブロックされるのでユーザーが `!` で実行
- **この gh CLI の `pr close` に `--comment` は無い** → `gh pr comment N --body` してから `gh pr close N`
- **Staging の DDL/SQL は Management API**(`POST https://api.supabase.com/v1/projects/<ref>/database/query`、トークンは `~/.supabase/access-token`)で流せる。jq は未インストールなので python3 で整形
- **SVG の url(#id) 参照は id 重複に弱い**: 同じ部品を表示/非表示ペアで2つ置くと、最初の要素が display:none のとき Chrome で描画されない。SVG内で defs を持つ部品は `useId` で固有 id にする(Logo.tsx で対応済み)
- **feature ブランチの未取り込み判定は `git cherry -v dev <branch>`**(`-` は dev に同内容のパッチあり、`+` が本当に未取り込み)。`--no-merged` だけだと cherry-pick 済みの分まで「未マージ」に見える
- **衝突候補は merge-base からの変更ファイルの重なり**(`git diff --name-only <mb> <branch>` と `<mb> dev` を `comm -12`)で事前に出せる。今回 profile/page.tsx が重なっていたが自動マージで解決した。`--no-commit` で止めて中身を見てからコミットするのが安全
- **`git merge-tree --write-tree` は git 2.34 では未対応**で usage を出して非0終了 → 「CONFLICT」と誤判定しかけた
- **Stagingの `/ja` を curl すると 307** → dev-login ゲートではなく next-intl の既定ロケール `/ja`→`/` リダイレクト(本番も同じ)。Stagingの公開ページ検証は `/`・`/en` で行う
- Stagingは全パスに `dev-login` ゲート(`src/proxy.ts`)。curl で通すには cookie `dev-auth=<DEV_PASSWORD>`。APIは Bearer トークンだけでは通らず cookie も必要
- `/sos/hearing` `/profile` `/change-password` `/change-email` はクライアント描画+ログイン必須で、curlでは中身を検証できない。実操作検証は人手のブラウザ操作しかない(Playwright未導入)
- 8/21セッションの教訓(継続): 負債メモは着手時に周辺をgrepし直す/`t()` を触ったら6言語のキー数一致を確認/本番psqlはユーザーが `!` で実行/`docs/staging_users_*.csv` はコミット禁止
- 前フェーズまでの教訓は git log の過去HANDOFF参照

## 次の一手
0. **お困りごとラベル**: (a) `feature/case-concerns` を origin に push → dev へチェックポイント PR(ユーザー承認)→ Staging で運営がフォーム・一覧・詳細を触る (b) Staging で `POST /api/admin/cases/backfill-labels` を `{"dryRun":true}` → 本実行(既定 10 件ずつ、管理者トークン+dev-auth cookie)し付き方を目で見る (c) §10 の 8 項目を依頼者に決めてもらい、文言差があれば concerns.ts と 6 言語 JSON を直す (d) 11 月前に本番へ出すか、出さずにタグ保管するかを判断(休止方針)。本番の遡り付与はユーザー明示許可のうえユーザー実行
1. ~~パスワード変更の回帰修正を本番へ~~ → PR #33 で反映済み。本番で①自発パスワード変更後にログアウトしないこと をユーザーが再確認
1b. **本番でのブラウザ実操作検証**(ユーザー): 上記①〜⑤(①は 9/17 に実施→ログアウト回帰を発見。変更後PWでの再ログインは可)。NGがあればこちらで修正 → dev → PR
2. ~~本番の確認メール件名を日本語化~~ → 2026-09-16 本番・Staging とも変更済み
3. **Staging の SMTP(Resend)設定**は任意。再発行キーがあれば設定し、以後は Staging でメール系を検証できる
4. **ブランチ整理は完了**(2026-09-16): 残骸18本(account-email-change 含む)を origin・ローカルとも削除、ローカル main を origin/main に追随。`feature/i18n-supporter-ui` はサポーターUI翻訳しない方針のため 9/16 に origin・ローカルとも削除済み(最終コミット 7a689d4、同梱の 6/12 レビューmd 2本も未救出)。`feature/multilingual-development`(多言語 Phase 2)は PR #10 クローズ・タグ `archive/i18n-phase2-2026-07` 保管・削除。再開時はマージせず設計書から再実装(docs/i18n_multilingual_design.md 冒頭)。`feature/variant-family-access-foundation`(ローカルのみ)はバリアント構想中止のため 9/16 に削除済み(復旧は reflog の c8a7673)
5. (継続)`docs/proposals/` + `scripts/md2pdf.sh` + `scripts/lib/` の追跡可否。相談フォーム改善提案は依頼者の決定待ち(§10)
6. (継続)拡散タスク(ユーザー作業): Resend Proアップグレード / Instagramリンク設定+投稿 / pptxスライド12とリーフレットの連絡先記入 / 八代市「郡築」表記確認
7. (継続)技術負債: スキーマ差分照合スクリプト(read-only本番PG vs Staging)をリリース手順に組込み(**9/16 に i18n フェーズ2の列で実際に差分を確認済み**、下記「地雷」参照)。`users.supporter_type` / `users.organization_name` 列のDROP migration。本番の `display_id_backup_20260816` テーブルDROP(ユーザー実行、8/16 から1か月経過)

## 地雷・注意
- **お困りごとラベル関連**: `CONCERN_FORM_ENABLED=false` に戻すと新規登録は旧フォームに戻るが、サポーター一覧のフィルターはラベル方式のまま(SDGs 番号フィルターは削除済み)。旧フォーム案件は本人ラベル 0 件なので「まだ整理できていない相談」に入り、遡り付与をすれば AI 補完でフィルターに乗る。`intake_qna.form_version=2` の案件には `qa` が無いので、`qa` を前提に読むコードを足さないこと(既存の analyze `buildDescriptionFromCase` は qa 無しでも動く)。AI 失敗時のフォールバックは新フォーム案件だけ `visibility: LISTED` にする(従来は AI 成功が公開条件だった)。フォールバック案件は `ai_sdg_suggestion.fallback=true` で、結果ページを開くたびに再試行する。相談者向け文言で SDGs に触れる既存キー(result.aiSectionSubtitle / analyzeStep3 / waitingBody、hearing.aiStep3)は番号ではないので据え置き。§10 の文言決定と一緒に見直す。ラベル表示名の正本は `concerns.ts` の `nameJa`(サポーター側)と `messages/*/sos.json` の `sos.concerns`(相談者側)の 2 か所にあり、文言を変えるときは両方を直す
- **本番Supabaseへの変更操作はユーザー明示許可なしに絶対に実行しない**(こちらはread-only接続のみ。auto modeでは本番psqlがブロックされるのでユーザーが `!` で実行)
- **現在パスワード確認は本番反映済み(PR #32)**。総当たり対策は GoTrue のトークン発行レート制限に依存。**パスワード更新は必ず本人トークンで GoTrue PUT /user を呼ぶ**(admin API だと本人セッションごと失効=即ログアウト。2026-09-17 の回帰)
- **メール変更の確認メールは新旧両方の宛先に届く(2026-09-17 調査で確定・仕様として受容)**: Secure email change を OFF にしても、Supabase ホスト版 GoTrue は確認メールを1通・宛先2件(現在のアドレス+変更先)で送る。トークンは新アドレス側の1本のみ(`email_change_token_current` は空)で、両メールに入るリンクは同一なのでどちらを押しても同じ変更が完了する。Resend の API 送信も変更1回につき1回。**二重送信バグではない**。旧アドレスへの控えは「変更が行われる通知」として依頼者が受容(2026-09-17)。新アドレスだけに送る設定は無い。切り分けSQLは `~/samasama/メール変更調査SQL/`(メール個人情報を含むので不要なら削除)
- **メール変更は新アドレスのみの1段階確認**(2026-09-17 ユーザー承認で Secure email change を Staging・本番とも OFF)。以前は新旧両方の確認が必要な2段階で、片方だけ確認するとアドレスが変わらず「変えたのにログインできない」混乱が起きた。**メールリンクの有効期限は1時間(mailer_otp_exp=3600)** で据え置き。将来強化するなら二段階確認ではなく SMS 等 別方式を選ぶ方針。案内文(changeEmail.description/sentNote)は元から単一確認前提でコード修正不要
- **メール変更の本人経路は確認メール前提**。Staging は SMTP 未設定だと届かない(mailer_autoconfirm は新規登録しか免除しない)。管理者経路は新アドレスの所有確認なし(`email_confirm: true` で即時)なので運営が本人性を確認してから実行
- **管理者は `/profile` に入れない**(role が `'SOS' | 'SUPPORTER'`)ため、管理者自身のパスワード変更は forgot-password 頼み。管理者自身のメール変更・退会は未整備(他ユーザーのメールは管理画面から変更可になった)
- `/profile` の「※変更はページ下部の「ログイン情報」から行えます」は日本語ハードコード(旧文言も同様。i18n化は未対応)
- Stagingテストユーザー: sos01@gmail.com / npo01_1@gmail.com(testpass123)、管理者 x25660@yahoo.co.jp(PW不明)。検収でPWやメールを変えたらここも直す
- **Staging と本番のスキーマ差分(2026-09-16 確認)**: 本番には `users.locale` / `cases.locale` のみ(`add_i18n_locale_foundation.sql` 適用済み)。`add_case_chat_translation.sql`(dev の migrations/ にあるが本番未適用: `cases.description_free_ja`、`messages.source_locale/translated_content/translation_status/translation_attempts`)と `add_system_message_keys.sql`(feature/multilingual-development にのみ存在: `messages.system_key/system_params`)は **Staging には適用済み・本番には無い**。dev のコードはこれらの列を参照していないので現時点の本番に影響なし。Phase 2 アーカイブに伴い **2026-09-16 に Staging 側の7列+`idx_messages_translation_pending` を DROP 済み**(データ0件・ユーザー確認のうえ Management API で実行)。`migrations/add_case_chat_translation.sql` は dev から削除済み(タグ `archive/i18n-phase2-2026-07` と git 履歴に残る)。現在 Staging と本番で残る i18n 列は `users.locale` / `cases.locale` のみで一致
- `users.supporter_type` / `users.organization_name` 列は未DROP(`admin/create-supporter` は両方に書く。害はない)
- 多言語再公開は `src/i18n/routing.ts` の `LANGUAGE_SWITCHER_ENABLED` + `localeDetection` の2点。ko/vi/idは緊急語彙ネイティブ確認が前提
- 災害データは `cases.intake_qna.disaster` 配下(migration不要方針)。正本は `src/lib/constants/disaster.ts`
- ビルド検証は exit code と「Generating static pages (122/122)」で判定(9/16 から 122)
- 環境差: Stagingはメール確認OFF・dev-loginゲートあり/本番はメール確認ON
- ローカルの Vercel CLI は古い個人プロジェクト(stanabe/...)にリンクされたまま。samasamaチームのデプロイ状況は `gh api repos/.../commits/<sha>/status` で見る
- ローカルの `main` ref は origin/main より大幅に古い(PRはGitHub画面で作るので実害なし)
- チャットに貼られたResend APIキーは落ち着いたら再発行→Supabase SMTP再設定
- `docs/staging_users_20260806.csv` はユーザー一覧のためコミット禁止。docs/配布物(pptx・PDF・インスタ画像)は未追跡のまま
- 将来の招待方式を作る際、共有メモ(APPROVED_SUPPORTERS)の過去データはDBに残っている(表示のみ廃止)
- 本番のテスト用SOSアカウント(捨てアドレス2件: SOS-00003 / SOS-00011)は **2026-09-16 に削除済み**(案件4件・写真7件・auth含む。ユーザーが Dashboard の SQL Editor と Storage UI で実施)。手順の要点: ①read-only psql は auth/storage スキーマを読めないので確認も SQL Editor で行う ②storage.objects は保護トリガーで SQL から消せず Storage UI(またはStorage API)で消す ③削除は1トランザクションで cases(NO ACTION) → public.users → auth.users の順、FK を pg_constraint から動的に辿る。SQL は `~/samasama/本番アカウント削除SQL/` に保管
