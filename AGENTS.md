# AGENTS.md — 明日もsamasama | SDGs Match

Codex / ClaudeCode がこのプロジェクトで作業するときに必ず読む文書。作業ルールと、知らないと事故になることだけを書く。
2026-11 から少人数で運営する。開発を続けるかは未定。今の状況は `HANDOFF.md` にある。

| 知りたいこと | 見る文書 |
|---|---|
| サービスが今何をしているか | `docs/service_specification.md` |
| 環境・リリース・DB・API の作り方 | `docs/operations.md` |
| 相談フォームの選択肢(正本) | `docs/intake_indicators.md` |
| お知らせ欄の設計・決定ログ | `docs/news_section_design.md` |
| 今の状況・次の担当者への申し送り | `HANDOFF.md` |
| v2.0 で何をどう作るか(決まり・データ・未決) | `docs/v2_design.md` |

---

## サービスの考え方(変えない)

- **SDGs はサービスの言語であって、相談者の言語ではない。** 相談者に SDGs を意識させない。分類はサービス側が裏で行う。
- **サポーター側には SDGs を前に出す**ことで注目を集め、より多くの人が助かるようにする。
- **行政・NPO・企業が混在する意味**: 行政は制度の枠でしか動けない。NPO はその枠の外を救う。両方がいることに意味がある。
- **最後のセーフティネット**: 何度マッチングが失敗しても運営につながれる道を残す。
- 利用者向けの文言では「管理者」でなく「運営」と書く。

## 作業ルール(最重要)

- 普段の作業は **`dev` ブランチ(から分けたブランチ)+ Staging Supabase** で行う。
- **本番 Supabase への変更操作は、ユーザーの明示の許可なしに実行しない。** SQL 実行・データ更新・RLS・Auth・環境変数を勝手に変えない。本番の確認は読み取りだけ。
- **DB の変更は `migrations/` に SQL として残し、Staging で確かめてから本番を検討する。** 本番に流す前に project ref・SQL 全文・影響・戻し方を示す。
- **dev → main(本番反映)はユーザーが GitHub の画面で行う。** dev へのマージもユーザーの承認を取る。
- 使わなくなった機能・止めた構想は本番に入れず、`archive/<名前>-<年月>` タグに残して消す。
- 秘密情報(`.env.local`、キー)をコミット・出力しない。`docs/staging_users_*.csv` はコミットしない。

## 知らないと事故になること

- **サーバーの API は `supabaseAdmin`(RLS を通らない)で DB を読み書きする。認可は API のコードで必ず行う。** 新しい API では `requireActiveAppUser()`(`src/lib/api/auth.ts`)を使う。**運営の API は `requireAdmin()`**(2つ目の確認まで済んだログインだけを通す)。ロールは PERSON と ADMIN だけで、支える側の顔は `src/lib/faces.ts`(所属と個人の支え手の登録)で決まる。ブラウザから DB を直接読まない。詳細は `docs/operations.md` §7。
- **テスト用ユーザーは `supabaseAdmin.auth.admin.createUser()` で作る。** SQL で直接入れると Auth の identities ができずログインできない。消す順番: messages → offers → cases → public.users → auth.users。確かめで作った団体は所属が残っていると DB が消すのを断るので `ARCHIVED` にする。
- **Workers の Staging には運営への知らせの Webhook と本物の宛先が入っている。** 確かめで団体の申し込みを通したり相談を届けたりしない。手元から Staging の DB に作った相談は取り消す。
- **v2.0 はパスワードを持たない**(メールのコードと Google)。相談者について DB に持つのは呼び名・年齢と基準日・国と地域・言語だけで、メールは Auth の中だけ。users に氏名やメールを書き足さない。**地域は国・都道府県と、市区町村の全国地方公共団体コード(`users.municipality_code`、一覧 `municipalities` から選ぶ。#173)まで。市区町村を自由入力に戻さない**(番地まで書けてしまう。「住所は持たない」)。市区町村は選んだ都道府県の中のものだけを受け付ける(`src/lib/server/municipalities.ts`)。
- **ログインのメールアドレスは本人が「わたし」で変える**(#155、2026-11-23 運営了承)。新しいアドレスに届くコードだけで確定し、古いアドレスでは確かめない(Auth の `double_confirm_changes = false`。退職などで古いアドレスを使えなくなった人のため)。変わったことは Auth が古いアドレスに知らせる。古いアドレスでログインできなくなった人は、確認済みの電話番号なら SMS のコードで入り直す(`shouldCreateUser: false`、電話番号で新規登録させない)、支援団体のメンバーなら運営が団体の管理の人に確かめてから `/admin/accounts` で変える。**相談者のアドレスは運営が変えない**(本人と確かめる手がかりがない)。運営が変えてよい人の判定は `src/lib/domain/accountEmail.ts` の `adminEmailChangeBlocker` だけで行う。ログインとアドレス変更のメールにリンクを載せない(書きかけの相談がリンク先で引き継がれない・会社のメールのセキュリティ機能がリンクを先に開くとコードも無効になる、#154)。
- **AI に渡す相談文は `maskPii` と `fenceConsultation` を通す。**
- **相談者は困りごとを選ばない。相談を届けるとき、保存する前に AI が指標を選ぶ**(#133、2026-11-17 運営了承。`src/lib/server/caseAi.ts` の `classifyConsultation`。代理の登録も同じ)。大項目は AI が選んだ指標からサーバーが決める(AI に大項目を答えさせない)。**緊急度と機微は、書いた言葉の判定(`detectUrgency`)と年齢を下限にし、AI の分類は上げる方向にだけ効かせる。AI が使えない・時間切れ・壊れた応答のときは機微(理由 `AI_UNAVAILABLE`)として届け**、運営が `/admin/cases/[id]` で直す(運営が外した相談は AI だけでは戻さない)。判定は `src/lib/domain/intake.ts` の `assessIntake`・`raiseWithAi` と `src/lib/domain/sensitivity.ts` だけで行う。分類できなかった相談は毎日の処理が分類し直す(上げる方向だけ)。AI が選んだ指標(`intake_qna.indicator_source = 'AI'`)は相談者の画面に出さない。記録のための指標の確定は、これまでどおり運営の「指標の仕分け」と解決の時点の要約(`caseKnowledge.ts`)。
- **相談を届けたあとに出すのは「相談に合いそうな支援団体」3 つ**(#138、2026-11-19 定例。v1.0.0 はこれが動いてから公開)。候補・並べ方・埋め草の決まりは `src/lib/domain/suggestions.ts` だけで判定し、作るのは `src/lib/server/suggestions.ts` の `generateSuggestions` だけ(届けた直後の after・画面を開いたとき・毎日の処理。`cases.suggestions_generated_at` を先に付けた処理だけが書く)。**地域の公的な窓口(自治体の窓口と、都道府県などが地域ごとに置く窓口)は、個人の相談で、相談者の市区町村(政令市の区は市も)と都道府県を受け持つものだけを AI に見せ、3 つのうち 1 つまで・民間の支援団体の後ろに置く**(#173。種類と説明は `src/lib/domain/localGovWindows.ts`。地区ごとの窓口は相談者の地区が分からないので出さない。AI が使えないときは出さない)。11/19 定例の「自治体は提案しない」は「市区町村まで分からない」が理由だったが、10/30 に市区町村まで聞くと代表と合意済みだったので、2026-11-27 に岡本さんが見直した。**全国の電話窓口(DV相談ナビ・189 など)は緊急と判定した個人の相談でだけ AI の候補に入れる。AI が合わないと見た団体で 3 つに埋めない。** 候補は全国から(#148): 同じ都道府県・全国の団体は手段を問わず、ほかの都道府県の団体は遠隔の手段で相談を受けているものだけ(地域の会員組織は除く)。候補は指標の重なりと、相談文と団体の要約の埋め込みの近さ(pgvector、`match_directory_by_*`)で引く。**埋め込みは保存したベクトルと同じモデルでしか比べられないので、`AI_EMBEDDING_MODEL` は版を明示し、上げるときは `scripts/embed-directory-entries.mts` で全件を作り直してから替える。** 掲載台帳を取り込んだら埋め込みのスクリプトも流す。 候補は調べが付いた団体(`accepts_consultation = YES`)だけで、調べのない行を推測で候補にしない。団体の相談の受け方は directory-data が出典の引用つきで作る(#139)。
- **掲載台帳の行と支援団体を結ぶのは運営の承認のときだけ**(#140、2026-11-19 定例)。支援団体の申し込みで「この団体でしょうか」から選んだ行は `application.directoryEntryId` に残すだけで、承認で `claim_status = CLAIMED` にし、行の名前と活動地域を申し込みの内容に合わせる(出典の列は消さない)。決まりは `src/lib/domain/directoryClaim.ts` だけで判定する。DB の `directory_entries.name_key`(v2_17)は `nameKey` と同じ作りで、どちらかを変えるときは両方を直す(単体テストが突き合わせる)。取り込みで結んだ行の名前・活動地域を戻さない。
- **相談の時点の AI の要約は作らない**(#134)。支える側にも運営にも出さない。AI が書くのは題だけ。解決の時点の要約(`caseKnowledge.ts`、運営だけが見る)は別物。
- **相談者と支え手のやりとり(messages の USER)は、運営の要約にも分析にも使わず、AI に渡さない**(2026-11-27。2026-11-26 に電気通信事業の届出をしたので、やりとりは通信の秘密で守る。規約への包括の同意では足りない)。例外は本人が「訳を見る」を押したときの訳(`/api/cases/[id]/messages/translate`)だけで、送り手の同意の要否は規約の改定で弁護士に確かめる。解決の要約は相談の内容だけから作り、`scripts/tests/caseKnowledge.test.ts` が `caseKnowledge.ts` の messages の読み取りを止める。
- **画面の呼び方**(#135、2026-11-17 運営と決定): 相談する側は個人・会社・地域とも「相談者」、支える側の団体は「支援団体」(個人は「個人の支え手」、まとめて「支え手」)。会社・地域として相談するために登録したもの(`application.purpose = CONSULT`)は「相談者の会社・地域」と書き、画面では「会社」「自治体の課・町内会」と呼ぶ。支援団体と取り違えるので、どちらも「団体」だけで書かない。英語は requester / support organization / individual supporter、スペイン語は quien consulta / organización de apoyo。規約の題「支える人と団体の決まり」は案文に合わせて残している。
- **AI は `src/lib/ai/client.ts` の `generateJson` だけから呼ぶ。** 提供元の SDK を直接 import しない(提供元とモデルは `src/lib/ai/config.ts` が環境変数から決める)。
- **体験ページ `/trial` が呼ぶのは分類の API(`/api/public/trial/classify`)だけ。** 本番と同じ分類を動かして、届けたら支援団体の画面にどう並ぶかを見せる(#133 までは「近いもの」の API だった)。相談の保存・届け出はしない。AI に渡す前に伏せる・何も保存しない・回数の上限(DB の `hit_rate_limit`、10 分に 10 回・1 日 300 回)を外さない(2026-11-06 代表。それまでは API・DB・AI を呼ばない作りだった)。
- **相談は先に書き、届けるときにログインする**(2026-11-17 岡本さん。会社・地域の登録も届けるときに求める)。`/consult/new`・`/consult/org` は `OptionalMe` で包む。書いた内容はログインの往復のあいだ端末の sessionStorage に預ける(`src/lib/domain/consultDraft.ts`。サーバーに送らない・届けたら消す)。相談を届ける API(`/api/cases`)は今までどおりログインが要る。
- Next.js 16 の `params` は Promise。`src/proxy.ts` が middleware の役(メンテナンスモード・Staging の入口パスワード・言語)。
- Tailwind のクラス名は補間や関数で組まず、完全な文字列で書く(ソースに現れないクラスは CSS が作られない)。Server Component から Client Component に関数を props で渡さない(型検査もビルドも通り、実行時に 500 になる)。
- 地域(`regions`)は外部キーの JOIN を使わず、2 回に分けて取る。
- 画面の言語は ja・en・es(v2.0、11/5 定例。中国語は入れない)。相談する側と支える側の画面は 3 言語、運営の画面は日本語だけ。文言は `messages/<言語>/app|consult|support.json` に足し、`npm run check:i18n` で 3 言語のキーをそろえる。
- 災害SOS(2026-09-16 に受付終了)の画面と処理は v2.0 で外した。再開するときは v1(main の履歴)から取り出して v2 の形で作り直す。
- 支え手は 1 件の相談に 3 者まで(`src/lib/domain/offers.ts`、DB の `accept_sos_offer`)。最初に選ばれた 1 者が中心。中心は相談者の同意を得てほかの支え手を招く(招かれた申し出は INVITED)。
- **支援団体の申し出の `offers.supporter_user_id` は「受け持つメンバー」**(#118)。管理の人と本人が替えられ、知らせ(選ばれた・新しいやりとり)とありがとうの宛先になる(`src/lib/domain/caseMember.ts` の `offerMemberUserId`)。申し出た人は `created_by_user_id` に残る。相談とやりとりは受け持つメンバーに限らず、支援団体の今いるメンバー全員が読める。
- 解決したときの社会貢献の記録は DB の `record_case_resolution` だけで付ける(手で確定・14 日の自動・運営が指標を直したとき、すべて同じ関数)。
- 画面の横スクロール化は、右端が切れて見えるとユーザーに却下されたことがある。
- **文字の大きさは `text-t13` のような名前で書く**(`globals.css` の `--text-t*`。`text-[13px]` と書かない)。名前の値は「わたし」で選ぶ文字の大きさの倍率を掛けてあり、px で書くとその文字だけ大きくならない。単体テスト(`scripts/tests/textSize.test.ts`)が px の指定を見つけると落ちる。足りない大きさは `globals.css` に足す。
- 作業の前後に `npm run lint -- --max-warnings 0`・`npx tsc --noEmit`・`npm run test:units`・`npm run check:i18n`・`npm run build` を通す。PR では CI(`.github/workflows/ci.yml`)が同じものと Workers 向けのビルド(`npm run build:cf`)を通す。画面で読み込むデータは `src/lib/client/useLoad.ts`、端末に覚える値は `src/lib/client/storedValue.ts` を使う(副作用の中で同期的に状態を変える書き方は lint が止める)。
- **v2.0 の作業中(#72)。Staging の DB は 2026-11-05 から v2 の形**(`migrations/v2_0*.sql`)。dev の v1 の画面は v2 の画面に置き換わるまで Staging で動かないところがある。本番(main)は v1 の DB のまま。
- **相談者の会社・地域(相談のための団体、`application.purpose = CONSULT`)は支え手ではない**(#131、2026-11-17 代表了承)。審査は `NOT_APPLIED`(並べない)で、支える側の顔・相談への権限・招く団体・公開の一覧・コーディネーターに出さない。判定は `isSupporterPurpose`・`isListedSupporter`(`src/lib/domain/publicSupporter.ts`)と `src/lib/domain/orgVetting.ts` だけ。支えるときは管理の人が支援団体の申し込みをする(`/api/orgs/[id]/supporter-application`)。DB も `organizations_vetting_matches_purpose` で同じ決まりを持つ。登録の `application` に `purpose` を入れさせない(`newApplication`)。
- **支援団体の写真(#178)は Storage の公開バケット `supporter-photos` に置き、`organizations.photo_path` に置き場所だけを持つ。** 画面で正方形の 512px JPEG に描き直して送り、サーバーは描き直さず(Workers で sharp を使えない)`inspectSupporterPhoto`(`src/lib/domain/supporterPhoto.ts`)で形を確かめて付帯情報(Exif の位置情報など)を外してから置く。置く・外すは `src/lib/server/supporterPhotos.ts` だけ。配信の保存(CDN)は 1 時間で、外した写真もその間は公開のアドレスで見える。**個人の支え手の顔写真は、プライバシーポリシーの改定と一緒に扱うまで足さない**(2026-11-28 岡本さん)。
- **支える側から見える相談の決まりは `src/lib/domain/visibility.ts` だけで判定する。** API ごとに条件を書き直さない(個人の支え手に個人の相談を出さない・機微は2つ目の確認・自分の相談を出さない)。
- **支える側として活動できるのは18歳以上**(2026-11-06 代表。どの国でも同じ)。判定は `src/lib/domain/age.ts` の `canSupportAtAge` だけ。支える側の API は `requireFace` を通し、相談にかかわる API は `caseAccess` を通す(どちらも年齢を見る)。`loadFaces` は会社・地域として相談するときにも使うので、年齢で絞らない。
- **`contributions` は追記だけ。** UPDATE は DB が断る。直すときは CORRECTION の行を足す。消すのは退会のときだけ。
- Cloudflare Workers への載せ替え中(v2.0、#72)。Vercel と Workers の両方で動く書き方にする: 環境の判定は `src/lib/deployEnv.ts`(`VERCEL_ENV` を直接見ない)、Workers で読めない Node のネイティブ部品(sharp など)を静的に import しない。**手元でビルドした Workers の成果物をデプロイしない**(OpenNext が `.env.local` の秘密キーを Worker のコードに焼き込む。`docs/operations.md` §2.1.1)。Next.js を上げたら Workers の Staging で画面が開くのを確かめる(OpenNext では 16.4.0 で全ページが 500 になった)。Workers の時計は計算中に進まないので、コードで測った時間に CPU は入らない(重さは Workers Logs の `cpuTimeMs` で見る)。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
