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
- **テスト用ユーザーは `supabaseAdmin.auth.admin.createUser()` で作る。** SQL で直接入れると Auth の identities ができずログインできない。消す順番: messages → offers → cases → public.users → auth.users。
- **v2.0 はパスワードを持たない**(メールのコードと Google)。相談する人について DB に持つのは呼び名・年齢と基準日・国と地域・言語だけで、メールは Auth の中だけ。users に氏名やメールを書き足さない。
- **AI に渡す相談文は `maskPii` と `fenceConsultation` を通す。** 大項目と緊急度は AI に決めさせない。
- **AI は `src/lib/ai/client.ts` の `generateJson` だけから呼ぶ。** 提供元の SDK を直接 import しない(提供元とモデルは `src/lib/ai/config.ts` が環境変数から決める)。
- **体験ページ `/trial` が呼ぶのは「近いもの」の API(`/api/public/trial/suggest`)だけ。** 相談の保存・届け出はしない。AI に渡す前に伏せる・何も保存しない・回数の上限(DB の `hit_rate_limit`、10 分に 10 回・1 日 300 回)を外さない(2026-11-06 代表。それまでは API・DB・AI を呼ばない作りだった)。
- Next.js 16 の `params` は Promise。`src/proxy.ts` が middleware の役(メンテナンスモード・Staging の入口パスワード・言語)。
- 地域(`regions`)は外部キーの JOIN を使わず、2 回に分けて取る。
- 画面の言語は ja・en・es(v2.0、11/5 定例。中国語は入れない)。相談する側と支える側の画面は 3 言語、運営の画面は日本語だけ。文言は `messages/<言語>/app|consult|support.json` に足し、`npm run check:i18n` で 3 言語のキーをそろえる。
- 災害SOS(2026-09-16 に受付終了)の画面と処理は v2.0 で外した。再開するときは v1(main の履歴)から取り出して v2 の形で作り直す。
- 支え手は 1 件の相談に 3 者まで(`src/lib/domain/offers.ts`、DB の `accept_sos_offer`)。最初に選ばれた 1 者が中心。中心は相談した人の同意を得てほかの支え手を招く(招かれた申し出は INVITED)。
- **団体の申し出の `offers.supporter_user_id` は「受け持つメンバー」**(#118)。管理の人と本人が替えられ、知らせ(選ばれた・新しいやりとり)とありがとうの宛先になる(`src/lib/domain/caseMember.ts` の `offerMemberUserId`)。申し出た人は `created_by_user_id` に残る。相談とやりとりは受け持つメンバーに限らず、団体の今いるメンバー全員が読める。
- 解決したときの社会貢献の記録は DB の `record_case_resolution` だけで付ける(手で確定・14 日の自動・運営が指標を直したとき、すべて同じ関数)。
- 画面の横スクロール化は、右端が切れて見えるとユーザーに却下されたことがある。
- 作業の前後に `npm run lint -- --max-warnings 0`・`npx tsc --noEmit`・`npm run test:units`・`npm run check:i18n`・`npm run build` を通す。PR では CI(`.github/workflows/ci.yml`)が同じものと Workers 向けのビルド(`npm run build:cf`)を通す。画面で読み込むデータは `src/lib/client/useLoad.ts`、端末に覚える値は `src/lib/client/storedValue.ts` を使う(副作用の中で同期的に状態を変える書き方は lint が止める)。
- **v2.0 の作業中(#72)。Staging の DB は 2026-11-05 から v2 の形**(`migrations/v2_0*.sql`)。dev の v1 の画面は v2 の画面に置き換わるまで Staging で動かないところがある。本番(main)は v1 の DB のまま。
- **支える側から見える相談の決まりは `src/lib/domain/visibility.ts` だけで判定する。** API ごとに条件を書き直さない(個人の支え手に個人の相談を出さない・機微は2つ目の確認・自分の相談を出さない)。
- **支える側として活動できるのは18歳以上**(2026-11-06 代表。どの国でも同じ)。判定は `src/lib/domain/age.ts` の `canSupportAtAge` だけ。支える側の API は `requireFace` を通し、相談にかかわる API は `caseAccess` を通す(どちらも年齢を見る)。`loadFaces` は会社・地域として相談するときにも使うので、年齢で絞らない。
- **`contributions` は追記だけ。** UPDATE は DB が断る。直すときは CORRECTION の行を足す。消すのは退会のときだけ。
- Cloudflare Workers への載せ替え中(v2.0、#72)。Vercel と Workers の両方で動く書き方にする: 環境の判定は `src/lib/deployEnv.ts`(`VERCEL_ENV` を直接見ない)、Workers で読めない Node のネイティブ部品(sharp など)を静的に import しない。**手元でビルドした Workers の成果物をデプロイしない**(OpenNext が `.env.local` の秘密キーを Worker のコードに焼き込む。`docs/operations.md` §2.1.1)。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
