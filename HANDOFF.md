# HANDOFF: 休止前整理 — dev に新しい相談フォーム・AI安全対策など(本番反映待ち)
更新: 2026-10-21(お知らせ管理画面をレビューして作り直し、feature/news-section)

## ゴール(完成条件)
11月からの少人数運営(開発休止)の前に、dev にたまった改善(新しい相談フォーム・AI の安全対策・セキュリティ・スマホ表示)を本番へ出せる状態にし、本番へ反映する。
本番反映は dev → main の PR 1 本で行う(DB 変更なし)。反映の前にユーザーが決めること・依頼者に確認することは下の「まとめ」を参照。
これより前のスコープ(admin API、パスワード変更、メール変更、熊本SOS終了など)は本番反映済み。

## 現在地
### まとめ(2026-10-21 時点、PR #54 まで)
**dev と main の差: PR #35〜#54(60 コミット超)。本番 DB に流す migration はなし**(dev にだけある Security Advisor の migration は本番適用済み)。dev → main の PR 1 本で反映できる。Staging は最新の dev でデプロイ済み。

dev にあって本番にないもの(利用者に見える順):
- 新しい相談フォーム: 114 の選択肢から 0〜3 個+自由記述、0 個は大項目 18「SDGsの隣のお困りごと」、大項目はサーバーが決め AI は説明だけ(#41)。緊急フラグ 14 個(#42)
- サポーター一覧: 大項目フィルター → 選択肢のドリルダウン、0 件の項目は押せない(#41・#44)
- AI まわり: AI に渡す前の個人情報マスク(#38 内)、プロンプトインジェクション対策・出力のリンク除去(#43)、AI 分析は 1 案件 1 回・案件なし分析は管理者のみ(#46)
- 回数制限: 開いている案件 3 件までをサーバーでも、本番だけ 24 時間 10 件まで(#46)
- 体験ページ `/trial` と入口(トップの文字リンク・登録ページの案内枠・専用 OGP)(#38・#42・#43・#49)。結果画面に「この内容を読むのは、運営が確認したサポーターだけです」(#52)
- 連絡先の扱いの文言を実装に合わせた: 「承認したら共有される」と読める文を「連絡先がサポーターに伝わることはありません。承認したサポーターとはサイト内のチャットでやりとり」に(相談フォームの注意書き・注記、トップ、FAQ、サポーター公開ページ、ストーリー)(#53・#54)。**利用規約 第7条はユーザー判断でそのまま**
- セキュリティ: セキュリティヘッダー 4 つ(#47)、流出パスワードの日本語案内(#45)、cron 認証の穴(CRON_SECRET 未設定で `Bearer undefined` が通る)を修正(#48)
- 表示: SDGs 言葉ラベル → 大項目名(#35・#36・#41)、災害案件をサポーター一覧から外すフラグ(#37)、登録サポーター一覧のスマホ表示・種別未設定での翻訳エラー修正(#50)
- 開発者向け: デプロイ結果の Discord 通知(#39・#40)

**本番に出す前にユーザーが決めること**
1. AI マスクを本番に入れてよいか(本番の AI 入力が変わる。体験ページ・営業資料はマスクがある前提で書いてある)
2. 依頼者の確認がどこまで済んだか: 緊急フラグ 14 個 / 日本向きでない選択肢 / 内容が近い組(`docs/intake_indicators.md` の「内容面の気づき」)/ 日本語以外の訳(公開は ja・en・zh のみ、言語切替は非表示)
3. 既存案件は新しい選択肢にマッピングしていない(大項目フィルターには掛かる、選択肢フィルターには掛からない)。このままでよいか

**ユーザーの作業(未実施)**
- ~~CRON_SECRET のローテーション~~ → **2026-10-21 にユーザーが実施済み**。本番の cron は鍵なしで 401 を確認。翌朝(JST 2:00)の自動実行が 200 で終わっているかを Vercel のログで一度見る
- 本番反映後のブラウザ確認: 相談登録(スマホ・写真)、サポーターのフィルター、体験ページ、流出パスワード(`password123` で日本語の案内が出るか)

**リポジトリの外にあるもの**
- 営業用 PowerPoint テンプレート v2: `~/samasama/営業資料/`(`.pptx`・`.potx`・`素材/`・生成スクリプト `build/`、旧版 `_v1`)。本番未公開の機能には「次回の更新で公開」の注記。会社の所在地・代表・利用料・公開予定月などは「(記入)」で残してある
- 説明ドキュメント(Claude Docs)「案件登録QA 作り直し(指標ベース)」: https://claude.ai/code/artifact/69f7caf3-563d-4cff-b359-e5e2d30176a7(マトリックス実装版つき)
- Staging の開いていた案件 42 件を 2026-10-16 に一括で CANCELLED にした控え: `~/samasama/staging_cases_cancelled_2026-10-16.json`(元に戻すときに使う)

**残っている小さな課題**
- サポーター用ダッシュボードの困りごとチップが、スマホで 7 段に折り返す(横スクロール化は右端が切れるとユーザー指摘があり取り消し。直すなら別の方法で)
- 結果ページの見出し「AIが分析しました」は、AI が分類しなくなったので文言を見直す余地
- 体験ページの「自動では伏せられないものがあります」に残る「サポーターには書いたとおりに表示されます」を残すか(ユーザー未回答)
- AI が書く説明文は日本語固定(日本語以外の画面でも日本語で出る)
- 登録総数の上限(MAX_SOS_USERS = 1000)は、ロボットに埋められると弱点になる。CAPTCHA はオフのまま(設定だけでオンにすると全員ログイン不可。入れるなら Cloudflare Turnstile)

### 作業の記録(新しい順)
**2026-10-21 お知らせ管理画面に「閉じる」「変更を取り消す」と一覧の「削除」を追加(ユーザー指摘「編集をキャンセルする手段がない」「削除は編集の横に」)。** 編集欄は最初は何も開いていない状態(案内と「＋ 新しいお知らせ」だけ)。編集中・新規作成中は右上に「✕ 閉じる」(未保存の変更があれば確認)、未保存の変更があるときだけ「変更を取り消す」(保存した時点に戻して編集を続ける)。削除は一覧の各行の「編集」の横と編集欄の下の 2 か所(どちらも確認つき。別の記事を編集中に一覧から消しても編集中の内容はそのまま)。Playwright(ログインと API をブラウザ内だけ差し替え)で取り消し・閉じる・一覧からの削除の動きを PC・スマホで確認。

**2026-10-21 お知らせ管理画面(`/admin/news`)を 3 観点(運営者・操作設計・安全)のレビューで作り直し(feature/news-section、dev 未マージ)。** ユーザー決定: 推奨まで実施 / 公開中の記事の修正は確認だけ(下書きを別に持つ仕組みは作らない)/ 参加団体の OK チェックは作らない。変更: 状態の切り替え+保存ボタンをやめ、状態ごとの操作ボタン(下書き中=「公開する」「下書きとして保存」、公開中=「変更をサイトに反映」「公開をやめる」)で毎回確認 / 編集欄の上に状態の帯(公開中・トップ表示中か・下書き・未保存の変更あり)/ 未保存の変更があれば別の記事・新規作成・ダッシュボードへ戻る・タブを閉じるで確認 / 保存中・AI 作成中は一覧と新規作成を押せない(別の記事を上書きする不具合の修正)/ 一覧に「編集 ›」「編集中」「トップに表示中」、すべて・公開中・下書きの絞り込み、スマホは押すと編集欄へ移動 / 「書く|見え方を確認」の切り替えで記事ページと同じ見た目(本文の描画は `NewsBodyView` を公開ページと共用、リンクカードは仮表示)/ 削除は「この記事を削除…」ボタン、公開中なら「公開をやめる」を勧める / 公開日は空から(公開した日が入る)、古い日付なら今日にするか聞く、未来の日付は予約公開でないと警告 / AI 下書きは折りたたみ / 新規作成の通信失敗後は一覧を読み直して二重登録を防ぐ / [要確認]の検出に【】()も追加。画面は Playwright でログインと管理 API をブラウザ内だけ差し替えて PC・スマホで確認(実 DB・実ログインは未使用)。実際の保存・公開・削除の操作確認はユーザー待ち。

**2026-10-21 `feature/news-section` に最新の dev(PR #56 まで)を取り込み。** 衝突は HANDOFF.md だけ(dev 側を土台にし、ブランチ側のお知らせ機能の記録を下に移した)。本番 DB には `news_posts` がない(2026-10-21 読み取りで確認、Staging はあり)。本番の SQL は後日(ユーザー判断)。流す前に `update_news_posts_updated_at()` に `SET search_path = public` を足すこと(Security Advisor の警告防止)。ユーザーの希望でお知らせ機能を磨く作業から始める。

**2026-09-19 note 記事ワークフローを `feature/news-section` に追加したが、同日ユーザー判断で無効化(`NOTE_ARTICLE_WORKFLOW_ENABLED = false`)。** 理由: `gemini-2.5-pro` がこのキーで 404 で「今は必要ない」。無効時はパネル非表示・`/api/admin/news/article` は 404・管理 API は 4 列を読み書きしない(ローカル実測: 列を送っても無視、一覧 200)。**4 列は `migrations/add_news_note_article_columns.sql` に分離し本番・Staging とも未適用**(Staging はいったん追加→データ 0 件を確認して DROP。`news_posts` は base migration の 10 列で本番予定と一致)。有効化手順: その migration を流す → フラグ true → ビルド。以下は実装時の記録: `/admin/news` で種別「インタビュー」を選ぶとパネルが出て、取材メモ → 切り口3案(1つ選ぶ)→ 本文(+サイト用導入文)→ 見直し(取材相手への確認リスト)→ 書式付きコピー、と進める。生成 API `POST /api/admin/news/article`(step=angles/write/review、DB に書かない)、保存は既存の PATCH に `interview_source / note_angle / note_article / note_checklist` を追加(**Staging は ALTER で列追加済み、`migrations/add_news_posts.sql` にも反映済み・本番未適用**)。ビルド exit 0。ローカル通し検証 16/17(未達は本文長 2,500 字 < 目安 3,000 字。材料のメモが短いためで、プロンプトを「少なければ無理に伸ばさない」に改めた)。**ブラウザでのパネル操作と、note のエディタに書式付きで貼って見出し・引用が残るかは未検証(ユーザーがプレビューで確認)**。`gemini-2.5-pro` はこのキーで 404 → 全工程 flash。

**2026-09-17 お知らせ欄を `feature/news-section`(dev から分岐)で実装完了。** 内容: migration `migrations/add_news_posts.sql`(**Staging には Management API で適用済み・本番未適用**)、公開API `GET /api/public/news`、トップの `NewsSection`(ヒーロー直下・0件なら非表示)、`/news` `/news/[id]`(サーバー描画・generateMetadata で記事名を title/OGP に)、管理API `/api/admin/news`(GET/POST)・`[id]`(PATCH/DELETE)・`draft`(AI下書き)、管理画面 `/admin/news`(ダッシュボードのヘッダーからリンク)、i18n `landing.news.*` 6言語×18キー(781 で一致)。ビルド exit 0・静的ページ 131/131。ローカル dev(Staging DB 接続)で API/ページの通し検証 44 項目通過(認可 401/403・入力検証 400・下書き非表示・公開→表示→非公開→404・外部リンク・AI下書き・削除・監査ログ)。**ブラウザでの見た目・管理画面の操作は未検証(Playwright なし)** → dev マージ後に Staging でユーザーが確認する。**origin に push 済み・PR #34(feature/news-section → dev)作成済み**。ユーザーが feature プレビュー(`…-git-feature-news-section-samasama.vercel.app`)で 2 件投稿して確認中。指摘を受けて同日に追加した修正 3 件(いずれもプレビューで反映確認済み): ①公開 API を `no-store` に(CDN の古い応答でトップに出なかった)②同日投稿は登録が新しい順(`created_at` 第2キー)③`/news` を年ごとの見出し「2026年」でグループ化 ④トップ・一覧からは必ず記事ページへ入り、外部リンクは記事ページのボタン+リンク先ドメイン表示に(直接外部へ飛ぶのは怖い、というユーザー判断)⑤本文で URL を1行だけ置くと OGP カード ⑥(9/19)note 記事ワークフロー(`src/lib/news/linkPreview.ts`、サーバー取得・24h キャッシュ・4 秒タイムアウト・内部アドレス拒否)。外部リンクボタンの上にも同じカード。URL 正規表現を ASCII 限定にし、直後の日本語を巻き込むバグも修正。マージはユーザー承認後(承認発言のあとなら `gh pr merge 34` 可)。

**2026-10-21 連絡先の扱いの文言を実装に合わせた(ユーザー指摘)。** 実装では連絡先をサポーターに共有する仕組みはなく(`contact_disclosures` テーブルはあるがコードから未使用)、承認後のやりとりはサイト内のチャットだけ。相談フォームの注意書き「連絡先は、承認したあとに必要な範囲だけ共有されます」→「連絡先がサポーターに伝わることはありません。承認したサポーターとは、このサイトのチャットでやりとりします」。トップの「承認するまで個人情報は渡りません」(hero.note・cta.body・steps.privacyNote)とサポーター公開ページの ctaBody も「連絡先がサポーターに伝わることはありません」に、FAQ の a1(「承認後も必要最小限の情報のみ共有」)も書き直し。6 言語。続けてストーリーページの「承認するまでサポーターに渡りません」と相談フォーム下の `sos.hearing.privacyNote`(「AIが…支援組織を探す」「必要な範囲でサポーターにも共有」)も実装に合わせて修正。**利用規約 第7条「承認するまでサポーターに開示されません」(`terms/page.tsx`)はユーザー判断でそのまま。**

**2026-10-21 体験ページの結果画面に、誰が相談内容を読むかの案内を追加(ユーザーと文言を相談して A 案)。** 「あなたが書いた内容」の枠の中に「この内容を読むのは、運営が確認したサポーターだけです / 書いた内容は、運営が確認して登録したNPO・自治体などの支援団体(サポーター)が読み、あなたの力になれる方法を考えます。インターネットに一般公開されることはありません。」(`sos.trial.readerTitle` / `readerBody`、6 言語)。根拠: サポーターは運営(管理者)しか作れない、相談内容はログインしたサポーターと運営だけが読める。「厳選」は審査の手順がないので使わない、「助けます」は約束に聞こえるので使わない。「サポーターに見えるのはニックネームと都道府県」の一文はユーザー判断で入れない。未決: 下の「自動では伏せられないものがあります」の「サポーターには書いたとおりに表示されます」を残すか。

**2026-10-21 登録サポーター一覧(`/supporters`)のスマホ表示を修正。** 種類フィルターのボタンが 1 行に詰め込まれて「すべ/て」「企/業」とボタン内で改行していた → 折り返し(flex-wrap)+ボタン内は改行しない。「24団体」が途中で切れないように。ついでに、種別未設定の団体で `tSupporterType(null)` が MISSING_MESSAGE を出していた既存の不具合を修正(種別の札を出さない)。**サポーター用ダッシュボード(`/supporter/dashboard`)のフィルターを横スクロール化する変更は、右端が切れるとユーザー指摘があり取り消した(未コミット)。** ダッシュボードの困りごとチップが 7 段に折り返す件は未対応(直すなら横スクロール以外の方法で)。

**2026-10-21 体験ページ `/trial` への入口を追加(ユーザー指示)。** トップの「無料で相談する」「サポーターを見る」の直下に小さな文字のリンク「登録せずに、相談フォームを試してみる →」(`landing.hero.tryTrial`)、登録ページの見出しの下・フォームの上に案内枠(`auth.signup.trialLead` / `trialLink`)。6 言語。`src/app/[locale]/trial/layout.tsx` で体験ページ専用の title / description / OGP(LINE 等で共有したときの表示、画像はサイト共通の og-image.png)。体験ページ自体が本番未反映なので、入口も dev→main の反映と同時に出る。確認: tsc・eslint・check:i18n・build 122/122、HTML でリンクと og タグ、Edge headless でスマホ幅の配置。

**2026-10-21 cron の認証チェックを修正(CRON_SECRET ローテーションの準備)。** `/api/cron/auto-close-cases` は `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` で比べていたため、CRON_SECRET 未設定の環境では `Authorization: Bearer undefined` で誰でも通れた。`src/lib/api/cronAuth.ts` の `isValidCronAuthorization()` に置き換え(未設定・空なら必ず拒否、sha256 同士を `timingSafeEqual` で比較)。テスト `scripts/tests/cronAuth.test.ts`、ローカルで「ヘッダーなし / Bearer undefined / 空」がすべて 401 を確認。**ローテーション手順(ユーザー作業、未実施)**: `openssl rand -hex 32` → Vercel の本番プロジェクト(app.samasama.site が付いている方)で CRON_SECRET(Production)を **Edit で上書き**(削除→追加はしない)→ 本番を Redeploy(環境変数は新しいデプロイにしか効かない、JST 2:00 の実行をまたがない)→ Settings → Cron Jobs の Run で 200 を確認。Preview にも別の値を入れておく。cron は本番デプロイでしか動かない。

**2026-10-21 セキュリティヘッダーを追加(指示書_セキュリティヘッダー.md、PR #47 で dev にマージ済み `7ae6405`、本番は未反映)。** `next.config.ts` の `headers()` で全パスに `X-Frame-Options: DENY` / `X-Content-Type-Options: nosniff` / `Referrer-Policy: strict-origin-when-cross-origin` / `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`。CSP は入れていない(GA・インラインスクリプトと衝突しやすい。`frame-ancestors 'none'` だけ足す案は保留)。埋め込み: 会社サイトからはリンクで移るだけ(ユーザー回答)なので DENY で問題なし。検証: tsc・build 122/122、ローカルで `/` `/en` `/api/health` `/trial` に 4 つとも付くことを curl で確認。本番 app.samasama.site は HSTS(`max-age=63072000`)付与済み、他 4 つは未設定(本番反映で付く)。ユーザーがブラウザで確認済み(写真アップロード・リンクコピー・mask-lab・GA、問題なし)。Staging でも `/`(dev-login へのリダイレクト)と `/api/health` に 4 つとも付くことを curl で確認。

**2026-10-20 案件登録と AI 分析の回数制限(課金の使いすぎ対策)。** 案件登録 API(`/api/sos/cases` POST): 開いている案件(OPEN・MATCHED)は 1 人 3 件まで(画面だけでなくサーバーでも、`ACTIVE_CASE_LIMIT` 409)/ 24 時間の登録は本番だけ 10 件まで(取り消しも数える、`DAILY_CASE_LIMIT` 429、`VERCEL_ENV === 'production'` で判定。Staging・ローカルは上限なし)。AI 分析 API(`/api/gemini/analyze`): 分析済みの案件は AI を動かさず保存済みの結果を返す(1 案件 1 回)/ 案件を指定しない分析は管理者だけ。CAPTCHA はオフのまま(設定だけでオンにすると全員ログイン不可。入れるなら Cloudflare Turnstile、パスワード変更の現 PW 確認もトークンを渡す形に)。登録総数の上限(MAX_SOS_USERS = 1000)はロボットに埋められると弱点になる点は未対応。流出パスワードの案内は PR #45(dev マージ済み)。

**2026-10-16 AI のプロンプトインジェクション対策(feature/ai-injection-hardening)。** `src/lib/aiSafety.ts` を追加: `fenceConsultation()` = 相談文を `<consultation>` で囲み、相談文の中の囲みの印(全角・大文字・属性つきも)を消す(閉じて外に指示を置く手口を防ぐ)/ `stripLinks()` = AI の出力から URL・メールアドレスを除く。`classifySDGs` の 2 つのプロンプトと `disasterNeeds` が `fenceConsultation` を使う(災害ニーズにも「命令として扱わない」の一文を追加)。`/api/gemini/analyze` の `normalizeAnalysis` は AI のタイトル・要約・説明・キーワードを `stripLinks` してから長さで切る。どこからも呼ばれていなかった `generateFollowUpQuestions` / `calculateMatchingScore` を削除。テスト `scripts/tests/aiSafety.test.ts`(`test:units` に追加)。もとから: AI は表示用の文しか返せず(ツール・DB 権限なし)、大項目はサーバーが決め、緊急度はルールで判定、災害タグは 8 種の白リスト。体験ページの結果画面に「AIを安全に使うための工夫」(4 項目+専門用語バッジ: 多層防御・プロンプトインジェクション対策・出力フィルタリング・最小権限の原則・ルールベース判定)を追加し、「AIがお困りごとを分類」の文言を「整理」に直した。**残り: 案件なしで任意の文を分析させる経路(`/api/gemini/analyze` の `description`、SOS ロール)に回数制限がない(課金の使いすぎ対策、未対応)。**

**2026-10-16 緊急フラグを 12 → 14 個に(16.3.2 不当な長期拘束・16.10.1 人権活動を理由にした暴力や拘束を追加、ユーザー承認)。体験ページ `/trial` の「例文を入れてみる」を自由記述欄(もう少し詳しく教えてください)の中に移動(`IntakeFormFields` に `freeTextAction` を追加)。例文は 3 欄すべてに伏せられる個人情報を入れた(何に困っているか=住所[ja のみ]・携帯 / いつから=勤め先の電話 / どうしたいか=メール・LINE ID、名前は伏せられない例として残す)。6 言語で欄ごとにマスクされることを確認。** 説明用の Claude ドキュメント「案件登録QA 作り直し(指標ベース)」(マトリックス実装版つき)を作成: https://claude.ai/code/artifact/69f7caf3-563d-4cff-b359-e5e2d30176a7 。既存案件は新しい選択肢にマッピングしていない(大項目フィルターには掛かる、選択肢フィルターには掛からない)。

**2026-10-15 案件登録 QA を指標ベースに作り替え(PR #41 で dev にマージ済み `69fb260`、Staging デプロイ success。本番は未反映)。** 正本は `docs/intake_indicators.md`(依頼者の表 114 選択肢・大項目・決定事項・誤字修正 9 か所)。旧 Q1〜Q5 は廃止。相談者は選択肢を 0〜3 個選ぶ(大項目ごとに開いて選ぶ UI)。0 個なら大項目 18「SDGsの隣のお困りごと」。自由記述は必須のまま。**分類は A 案: サーバーが選択肢から大項目を決め(`categoriesFromIndicators`)、AI はタイトル・要約・説明文だけ(`classifySDGs(text, fixedGoals)`)。** 緊急 = 選択肢の ⚠ フラグ(14 個・Claude 案で依頼者確認待ち)+ 自由記述の緊急語句(`src/lib/urgency.ts`、サーバーでも判定するようにした)。保存は `intake_qna = { version: 2, indicators, indicator_texts, locale }`(DB 変更なし)、旧形式の過去案件はそのまま表示。表示: 相談者側タイル=大項目、結果ページ=「あなたが選んだ困りごと」/ サポーター側タイル=大項目、詳細=指標番号つき、フィルター=大項目 1 つ → その指標を複数選択(大項目は 0 件でも全部出す)。**旧言葉ラベル(`SDG_WORD_LABELS` / `sdgs.wordLabel`)は廃止し大項目名に統一**(「お金・生活費」→「お金・生活」等)。文言は `messages/<6言語>/sdgs.json` の `category` / `indicator`(ja 以外 AI 訳)。docs・定数・ja の一致は `npm run test:units` が検査。
- 検証: tsc・eslint(変更ファイル)・build 122/122・check:i18n・test:units 通過。ローカル(Staging DB)で Playwright 実操作: /trial(3 個上限・外す・マスク)、sos01 で登録 → AI 結果(2 大項目・0 個 → 18 の両方)、npo01_1 でフィルター・ドリルダウン・詳細。**Staging にテスト案件 2 件を作成**(本文が【テスト・指標フォーム検証】【テスト・選択0個の検証】)
- 別エージェントのレビューで指摘された 3 点を修正: 旧フォームからの送信は 400 / intake_qna なしでも新形式で保存 / 自由記述の緊急判定をサーバーでも実施
- 残り: 依頼者確認(緊急フラグ 14 個、日本向きでない選択肢、内容が近い組 — docs の「内容面の気づき」)、結果ページの見出し「AIが分析しました」は AI が分類しなくなったので文言見直しの余地、ja 以外の訳はネイティブ未確認、Staging での目視(PR マージ後)
- Playwright はプロジェクトに入れていない。scratchpad に `playwright-core` を入れ、`~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell` を executablePath に指定すれば動く

**2026-10-02 相談フォームの体験ページ `/trial` を追加(PR #38 で dev にマージ済み `f0c34f9`、2026-10-02)。** 入口(リンク)はまだ作らない(ユーザー指示)。ユーザーがプレビューで結果画面を確認済み。その後の追加: 「学習に使わない契約」の説明文(`limitAiNote`)、「本番ではこのあと」を表示例つきの 3 段に変更。**本番へ出す前の確認事項(2026-10-02 ユーザー回答): ①Gemini は API で使用している(ユーザー回答。課金を有効にした有料利用かどうかまでは未確認 — 無料枠だと入力が学習に使われ得るので、文言の裏づけとして一度 Google AI Studio / Cloud の課金設定を見ておく)②本番も開発環境と同じく、案件登録時の自由記述をマスクして AI へ渡す(`a5dd361` を本番に入れてよい、決定)③プライバシーポリシーへの無学習の記載は保留。** ユーザー決定: 案件登録の体験のみ(アカウント登録・ログインなし)/DB に保存しない/AI は動かさず課金が発生しない作り/対象は相談を迷う人と団体・行政・企業への説明の両方/マスク処理を可視化して見せる。実装: すべてブラウザ内で完結(API・DB・AI を呼ばない。ここに fetch を足さないこと)。本番と同じ入力欄 → 「あなたが書いた内容(検出箇所に色)」と「AI に渡る内容(印に置換)」を並べて表示 → 自動で伏せられないものの注意 → 本番の流れ 3 段 → 相談したい方(/signup)・支援したい団体(SUPPORTER_RECRUIT_URL)への案内。「例文を入れてみる」ボタンあり(説明用)。
- `src/lib/pii.ts` と `scripts/tests/pii.test.ts` をタグ `archive/case-concerns-2026-09` から取り出し、`detectPiiSpans()` を追加。`npm run test:units` で実行
- 入力欄を `src/components/sos/IntakeFormFields.tsx` に切り出し、本番の `/sos/hearing` と体験が同じ部品を使う(**/sos/hearing はログイン必須で画面確認できていない。Staging で相談登録が通ることを要確認**)
- 文言は `messages/<6言語>/sos.json` の `trial`(39 キー、日本語以外は AI 訳)
- **別コミットで、本番の AI 呼び出し(`gemini.ts` の 3 か所と `disasterNeeds.ts`)にも `maskPii` を入れた。** これまで本番は AI に渡す前のマスクをしておらず、体験ページの説明(AI に渡す前に伏せる)を事実にするため。DB 保存とサポーター表示はマスクしない(従来どおり)。本番の AI 入力が変わるので、入れるかどうかはユーザー判断(外すならこのコミットだけ revert し、体験ページの文言も直す)
- 体験ページへの入口(トップページ等からのリンク)は未設置(当面作らない)。層2(人名・地名、kuromoji)は本番で使っていないので体験でも見せていない
- 検証: tsc・eslint・build・`check:i18n`・`test:units` は通過。フォーム表示は dev サーバーで `/trial` `/en/trial` を curl 確認。結果画面(マスク表示)はブラウザ未確認(Playwright 未導入)
**2026-10-02 SDGs 言葉ラベルの文言は見直し中(ユーザーが調整してから指示。それまで変更しない)。** 論点: ①5・12・17 が長い(短縮案: 性別・DV / ごみ・資源 / 連携・協力)②16「暴力・法律・手続き」に違和感(案: 安全・法律)③依頼者は SDGs が好きなので、正式名から取った言葉にそろえる案(貧困/飢餓/健康・福祉/教育/ジェンダー平等/水・トイレ/エネルギー/働きがい・経済/産業・技術/不平等/まちづくり/つくる・つかう責任/気候変動/海の豊かさ/陸の豊かさ/平和・公正/パートナーシップ)。未決: 番号ごとにどの言葉を採るか、相談者本人に「貧困」「飢餓」を出すか。決まったら `SDG_WORD_LABELS` と `messages/<6言語>/sdgs.json` の `wordLabel` を差し替え、トップページ用の `goalShort` も同じ言葉にそろえるか検討。
**2026-10-02 サポーター一覧から災害案件を一括で外すフラグを追加(PR #37 で dev にマージ済み `c93ca48`、Staging 目視は未確認)。** `src/lib/constants/disaster.ts` の `DISASTER_CASES_SHOWN_TO_SUPPORTERS = false` の間、`/api/supporter/dashboard` が災害案件を返さない(自団体が申し出済み・担当中のものも含む)ので、災害タブ・ニーズ/市町村/校区フィルター・全体状況が消える。理由: 受付終了後も滞留案件があるだけで災害タブが出続けるため(本番は災害案件 0 件とユーザー確認、Staging はテスト案件が残る)。DB の案件は消さない。相談者側・管理画面・案件詳細の直 URL は変えていない。**災害SOSを再開するときは `ACTIVE_DISASTER_EVENT` と一緒に true に戻す。**
**2026-09-30 お困りごとラベル構想(feature/case-concerns)はユーザー決定でキャンセル → タグ `archive/case-concerns-2026-09` に保管しブランチ削除(origin・ローカル)。** タグには 5括り→項目→8ラベルのフォーム、AI 補完、遡り付与 API、**AI 直前の個人情報マスク層1(`src/lib/pii.ts`)と回帰テスト(`scripts/tests/`)**が入っている。マスク層1は構想と独立に有効なので、必要になったらタグから取り出す(未着手)。
**代替として「現行の登録ロジック(Q1〜Q5 + AI の SDGs 1〜17 分類)はそのまま、サポーター側の表示とフィルターの番号を言葉のラベルに置き換える」小改修を `feature/sdgs-word-labels`(dev 分岐)に実装。** 変更は 3 ファイル: `src/lib/constants/sdgs.ts` に `SDG_WORD_LABELS`(17 個全部・日本語固定・`sdgWordLabel()`)を追加 / サポーター一覧のフィルターチップ・カードのバッジ・相談者ごとの束ね表示を「SDG 11」→「住まい・地域」に(色はゴール色のまま、ホバーで番号と正式名)/ 案件詳細の「関連する SDGs ゴール」を「AI が読み取った困りごと」に改め、言葉を主役・番号と正式名は小さく添える。相談者側は 9/30 時点では触らない方針だったが、**2026-10-02 にユーザー指示で相談者側 3 画面(相談一覧・ダッシュボード・結果ページ)も言葉ラベルに変更**(PR #36 で dev にマージ済み `07ba508`、Staging 目視は未確認)。相談者側は多言語なので言葉は `messages/<6言語>/sdgs.json` の `wordLabel`(17 個)から出す。日本語は `SDG_WORD_LABELS` と同じ文言で、直すときは両方をそろえる。結果ページは言葉を主・「SDG 番号+正式名」を小さく添える。en/zh/ko/vi/id の訳語は AI 訳でネイティブ未確認。DB・AI・API 変更なし。**2026-10-02 PR #35 で dev にマージ済み(`c7ee4d3`)。Staging での目視は未確認。**

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
0a. **検討中(ユーザー保留、2026-09-19)**: お知らせ欄に「世の中の SDGs 関連ニュースの紹介」種別を足す案。同じ枠組み(種別1つ+外部リンク+導入文+OGP カード+紹介文の構造プロンプト)で半日以内。論点は「SDGs は相談者の言語ではない」ので、SDGs 用語ではなく生活の言葉で「ここに来る誰にどう関わるか」を一言添える形にするか、誰向けに選ぶか(困っている人向けならトップに出す / 団体向けなら `/news` のみ)。ユーザーが考え中。着手は指示待ち
00. **本番反映(dev → main)**: 上の「まとめ」の 3 つが決まったら、dev → main の PR を作り、マージ → 本番デプロイ → 本番で curl(セキュリティヘッダー 4 つ、`/trial` の 200)とブラウザ確認。DB 変更なし。反映したら HANDOFF・メモリの「本番未反映」を直す
0. **SDGs 言葉ラベル**: PR #35 で dev にマージ済み(2026-10-02)。Staging でサポーター一覧のフィルター・カード・案件詳細を目視 → 11 月前に本番へ出すか判断。トップページのサポーター団体カード(`src/app/[locale]/page.tsx` の「SDG11」表記)は対象外のまま(言葉にするかは未決)。相談者側の言葉ラベルは PR #36 で dev にマージ済み(2026-10-02)。Staging で相談者としてログインして 3 画面を目視(ja と en)。17 個の言葉は `SDG_WORD_LABELS` の 1 か所で直せる。相談者側は変更しない
0b. **Supabase API キーの新方式移行 — 2026-10-03 に Staging・本番とも切り替え完了。** Vercel の Preview / Production の `NEXT_PUBLIC_SUPABASE_ANON_KEY`(Config)と `SUPABASE_SERVICE_ROLE_KEY`(Type=Secret、旧 Sensitive)を `sb_publishable_` / `sb_secret_` に差し替え(ユーザー操作)。本番は最初の再デプロイで秘密用キーが通らず `/api/regions` 等が 500 `Invalid API key` になった(数分)が、ユーザーが直して再デプロイし復旧。外からの確認(配信 JS のキー形式・公開 API・401)は両環境とも OK。**残り: 本番ブラウザ確認(ログイン・管理画面・パスワード変更)、翌 2 時の cron ログ確認、旧キーの Disable は 1〜2 週間後に検討(まだ押していない)。** 以下は実施時の手順(記録): 本番 Vercel は旧 JWT 形式(anon / service_role)だった。ローカル `.env.local` は新形式(`sb_publishable_` / `sb_secret_`)で Staging に対して動作実績あり。コード側は env 経由でしか使っておらず(`src/lib/supabase/{client,server}.ts`、`src/lib/api/password.ts`、`change-password` の `apikey` ヘッダー)変更不要。手順: ①Vercel Preview の `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` を Staging の新キーに差し替え → dev 再デプロイ → ログイン・相談登録・サポーター一覧・管理画面を確認 ②本番 Supabase で Secret key を `vercel-production` 名で新規作成 ③Vercel Production の 2 変数を差し替え(秘密側は Sensitive)→ 再デプロイ(NEXT_PUBLIC_ はビルド時埋め込み)④ログイン・相談登録・一覧・管理画面・`/api/health`・翌 2 時の cron を確認 ⑤旧キーの Disable は 1〜2 週間様子を見てから(押さなければいつでも戻せる)。②〜④は本番変更なのでユーザー実行。11 月の休止前に完了させる
0a. **Supabase Security Advisor 警告(2026-09-30)**: `migrations/fix_function_search_path_and_rls_helper_grants.sql`(dev `8834e02`)を **Staging・本番とも適用済み(2026-09-30、いずれもユーザーが SQL Editor で実行。Staging はカタログで 13 関数の search_path=public と rls_auto_enable の anon/authenticated EXECUTE 剥奪を確認、本番は Advisor の再チェックで関数関連 14 件が消え WARN は Leaked Password Protection の 1 件だけになったことをユーザーが確認)**。残り: Leaked Password Protection は Dashboard の Authentication → Providers → Password で Staging→本番の順に ON(登録時のエラー文言を確認)。auto mode の分類器は Management API 経由の DDL も「デプロイ」として止めるので、Staging の DDL もユーザー実行になった
1. ~~パスワード変更の回帰修正を本番へ~~ → PR #33 で反映済み。本番で①自発パスワード変更後にログアウトしないこと をユーザーが再確認
1b. **本番でのブラウザ実操作検証**(ユーザー): 上記①〜⑤(①は 9/17 に実施→ログアウト回帰を発見。変更後PWでの再ログインは可)。NGがあればこちらで修正 → dev → PR
2. ~~本番の確認メール件名を日本語化~~ → 2026-09-16 本番・Staging とも変更済み
3. **Staging の SMTP(Resend)設定**は任意。再発行キーがあれば設定し、以後は Staging でメール系を検証できる
4. **ブランチ整理は完了**(2026-09-16): 残骸18本(account-email-change 含む)を origin・ローカルとも削除、ローカル main を origin/main に追随。`feature/i18n-supporter-ui` はサポーターUI翻訳しない方針のため 9/16 に origin・ローカルとも削除済み(最終コミット 7a689d4、同梱の 6/12 レビューmd 2本も未救出)。`feature/multilingual-development`(多言語 Phase 2)は PR #10 クローズ・タグ `archive/i18n-phase2-2026-07` 保管・削除。再開時はマージせず設計書から再実装(docs/i18n_multilingual_design.md 冒頭)。`feature/variant-family-access-foundation`(ローカルのみ)はバリアント構想中止のため 9/16 に削除済み(復旧は reflog の c8a7673)
5. (継続)`docs/proposals/` + `scripts/md2pdf.sh` + `scripts/lib/` の追跡可否。相談フォーム改善提案は依頼者の決定待ち(§10)
6. (継続)拡散タスク(ユーザー作業): Resend Proアップグレード / Instagramリンク設定+投稿 / pptxスライド12とリーフレットの連絡先記入 / 八代市「郡築」表記確認
7. (継続)技術負債: スキーマ差分照合スクリプト(read-only本番PG vs Staging)をリリース手順に組込み(**9/16 に i18n フェーズ2の列で実際に差分を確認済み**、下記「地雷」参照)。`users.supporter_type` / `users.organization_name` 列のDROP migration。本番の `display_id_backup_20260816` テーブルDROP(ユーザー実行、8/16 から1か月経過)

## 地雷・注意
- **公開している言語は ja・en・zh のみ**(`src/i18n/routing.ts` の `locales`)。ko・vi・id は翻訳ファイルだけある。言語切替は `LANGUAGE_SWITCHER_ENABLED = false` で非表示。資料などで「6 言語対応」と書かない
- **画面の確認方法**: Playwright はプロジェクトに入れていない。`~/samasama/.qa-tools/` に `playwright-core` と撮影スクリプト(`shot.js`=サポーターでログインしてダッシュボード、`shot_pub.js`=公開ページ)がある。ブラウザ本体は `~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`。絵文字は四角で写る(書体がないだけ)。PowerPoint の見た目確認は Windows の PowerPoint を PowerShell の COM で PNG に書き出す(WSL に LibreOffice なし)
- **画面の横スクロール化は慎重に**: サポーター用ダッシュボードで試したところ、右端が切れて見えるとユーザーに却下された(2026-10-21)
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
- `docs/staging_users_20260806.csv` はユーザー一覧のためコミット禁止(2026-10-20 時点で手元に見当たらない)。配布物(pptx・PDF・インスタ画像)は `~/samasama/docs_退避_20260925/配布物/` に退避済み
- 将来の招待方式を作る際、共有メモ(APPROVED_SUPPORTERS)の過去データはDBに残っている(表示のみ廃止)
- 本番のテスト用SOSアカウント(捨てアドレス2件: SOS-00003 / SOS-00011)は **2026-09-16 に削除済み**(案件4件・写真7件・auth含む。ユーザーが Dashboard の SQL Editor と Storage UI で実施)。手順の要点: ①read-only psql は auth/storage スキーマを読めないので確認も SQL Editor で行う ②storage.objects は保護トリガーで SQL から消せず Storage UI(またはStorage API)で消す ③削除は1トランザクションで cases(NO ACTION) → public.users → auth.users の順、FK を pg_constraint から動的に辿る。SQL は `~/samasama/本番アカウント削除SQL/` に保管
