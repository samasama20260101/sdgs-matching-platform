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

- **サーバーの API は `supabaseAdmin`(RLS を通らない)で DB を読み書きする。認可は API のコードで必ず行う。** 新しい API では `requireActiveAppUser()`(`src/lib/api/auth.ts`)を使う。ブラウザから DB を直接読まない。詳細は `docs/operations.md` §7。
- **テスト用ユーザーは `supabaseAdmin.auth.admin.createUser()` で作る。** SQL で直接入れると Auth の identities ができずログインできない。消す順番: messages → offers → cases → public.users → auth.users。
- **パスワード更新は本人のトークンで GoTrue の `PUT /user` を呼ぶ。** admin API で変えると本人のセッションごと失効して即ログアウトする。
- **AI に渡す相談文は `maskPii` と `fenceConsultation` を通す。** 大項目と緊急度は AI に決めさせない。
- **体験ページ `/trial` に fetch を足さない。** API・DB・AI を呼ばない作り。
- Next.js 16 の `params` は Promise。`src/proxy.ts` が middleware の役(メンテナンスモード・Staging の入口パスワード・言語)。
- 地域(`regions`)は外部キーの JOIN を使わず、2 回に分けて取る。
- 公開している言語は ja・en・zh だけ。資料で「6 言語対応」と書かない。サポーター・運営の画面は翻訳しない。
- 災害SOSは受付終了中。再開するときは `src/lib/constants/disaster.ts` の `ACTIVE_DISASTER_EVENT` と `DISASTER_CASES_SHOWN_TO_SUPPORTERS` を両方戻す。
- 承認できるのは 1 案件 1 団体(`MAX_SUPPORTERS_PER_CASE = 1`)。並列マッチングには戻さない。2 団体目以降を足すなら「承認済みの団体が招待する」形(未着手)。
- 画面の横スクロール化は、右端が切れて見えるとユーザーに却下されたことがある。
- 作業の前後に `npx tsc --noEmit`・`npm run test:units`・`npm run check:i18n`・`npm run build` を通す(CI はない)。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
