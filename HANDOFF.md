# HANDOFF: 技術負債返済 + アカウント設定の穴埋め
更新: 2026-08-21

## ゴール(完成条件)
災害SOS拡散フェーズと並行して、本番稼働で見えてきた技術負債とUXの穴を潰す。
今回のスコープは (1) admin APIのレガシー列参照 (2) ログイン中のパスワード変更導線。
将来は「マッチ済みサポーターが行政等を招待して連携」方式を設計する(現1対1はその布石)。

## 現在地
**dev に2コミット済み・未検収。** `d03f671`(admin API organizations参照化) と `9ccab04`(パスワード変更導線)。
いずれもビルド検証済みだが **Stagingでの目視検収がまだ**。本番へのPRは検収後。
前フェーズ(災害SOS拡散 + マッチング1対1化)の本番反映は 2026-08-16 に完了済み・ユーザー確認済み。

## 完了したこと
- **技術負債①: admin APIのレガシー列参照を解消**(`d03f671`・ビルド検証済み・Staging実データ照合済み)
  - `src/lib/organizations.ts` に `getOrganizationsByUserIds()` を新設(ACTIVE所属・複数なら最古、`getActiveOrganizationForUser` と同じ規則。FK JOINは使わず2ステップ)
  - `admin/stats` と `admin/inquiries` がこれを使い、団体名・種別を organizations 正本で上書き。users側の列は団体未所属時のフォールバックとして残置
  - Staging 41サポーターで照合: 団体名のズレ4件が解消、種別のズレ0件、団体未所属1件はフォールバック動作
- **ログイン中のパスワード変更導線**(`9ccab04`・ビルド検証済み・Staging実データでモード判定確認済み)
  - `/change-password` を2モード化。判定は `get-role` の `must_change_password`(クエリパラメータにすると初回ユーザーがURL書き換えで規約同意を飛ばせるため)
    - initial: 従来どおり(規約同意チェック・初回文言・ロール別ダッシュボードへ)
    - voluntary: 規約同意なし・専用文言・`/profile` へ戻す・「プロフィールに戻る」リンクあり
  - `/profile` に「パスワード」カードを追加。保存フォームの**外**に配置(遷移で未保存の編集が消えるため)
  - 6言語に文言追加。あわせて `auth.changePassword.errorGeneric` を補完(コードが参照しているのに全6言語で未定義だった=更新失敗時にキーパスが画面に出る状態)
- **前フェーズ(2026-08-16完了・本番反映済み)**: PR #26/#27/#28、display_id形式統一とUNIQUE付与、ケアラーズカフェ モンステラのOTHER化。詳細は `git log` の過去HANDOFF参照

## 試して失敗したこと ★最重要
- (前フェーズまでの教訓は git log の過去HANDOFF参照。今回セッション分↓)
- **HANDOFFに書いた負債メモのスコープを信じすぎた**: 「`admin/stats` が `users.supporter_type` を読んでいる」と書いてあったが、実際は `users.organization_name` も同じ欠陥(profile更新は organizations にしか書かない)で、さらに `admin/inquiries` にも同じ読み方が残っていた。**教訓: 負債メモは発見時点で見えた範囲しか書かれていない。着手時に必ず周辺をgrepし直す**
- **翻訳キーの参照と定義のズレは tsc も build も検出しない**: `t('errorGeneric')` が全6言語で未定義のまま本番に乗っていた(next-intlの既定フォールバックでキーパスが表示される)。**教訓: `t()` を足す/触るときは、同じ回でカタログ側の存在を確認する。6言語のキー数一致チェックが有効**
- 本番read-onlyのpsql照会がauto modeの分類器にブロックされた → 迂回せず、ユーザーが `!` で実行する形に切り替え。本番DB確認はユーザー実行前提で組むこと
- Playwrightが未インストールでブラウザ目視検証ができなかった → 環境に130MB足すのを避け、Stagingデプロイ後の手動確認に回した(下の「次の一手」)

## 次の一手
1. **Stagingで `9ccab04` を検収**(15分)。ログイン → プロフィール最下部に「パスワード」カードがあるか → 押して**規約同意チェックが出ていない**こと・「初回ログインのため」文言でないこと・「プロフィールに戻る」があることを確認 → 実際に変更してプロフィールに戻り、新パスワードで再ログインできるか
2. **initial側のリグレッション確認**(最重要)。Stagingに `must_change_password=true` のサポーターが7人いる。うち1人で初回ログインし、**従来どおり規約同意チェックが出てダッシュボードへ飛ぶ**ことを確認
3. **Stagingで `d03f671` を検収**。管理ダッシュボードのサポーター一覧で団体名が正しく出るか(4件が改善対象)、問い合わせタブの団体名表示が壊れていないか
4. 検収OKなら main へPR(https://github.com/samasama20260101/sdgs-matching-platform/compare/main...dev)
5. 拡散タスク(未着手・ユーザー作業): Resend Proアップグレード / Instagramリンク設定+投稿 / pptxスライド12とリーフレットの連絡先記入 / 八代市「郡築」表記確認
6. 技術負債: スキーマ差分照合スクリプト(read-only本番PG vs Staging)をリリース手順に組込み
7. 数週間問題なければ本番の `display_id_backup_20260816` テーブルをDROP(ユーザー実行)

## 地雷・注意
- **本番Supabaseへの変更操作はユーザー明示許可なしに絶対に実行しない**(こちらはread-only接続のみ。しかもauto modeでは本番psqlがブロックされる)
- **パスワード変更に現在パスワード確認は未実装**(議論のうえ意図的に後回し)。ログイン中なら誰でも通るため、席を離れた隙の乗っ取り経路は開いたまま。実装するなら Supabase の `updateUser` は現PWを検証しないので、入力された現PWで `signInWithPassword` を叩いて確かめる自前実装が要る
- **管理者は `/profile` に入れない**(`profile/page.tsx` の role が `'SOS' | 'SUPPORTER'`)ため、パスワード変更は引き続き forgot-password 頼み。メール変更・退会も未整備
- Stagingテストユーザーのパスワードを検収で変えたら、この文書の記載も直すこと: sos01@gmail.com / npo01_1@gmail.com (testpass123)
- **未コミットの作業が2件残っている**(今回の作業とは別件、そのまま残置):
  - `src/app/api/cron/auto-close-cases/route.ts`: MATCHED無活動の自動CLOSEDを14日→30日に変更(解決報告からの自動RESOLVEDは14日のまま)
  - `docs/sdgs_impact_dashboard_design.md`: +96/-24行(§5改訂・§10、2026-08-19確定分)
- `users.supporter_type` / `users.organization_name` 列そのものはまだDROPしていない。読み取り側が全部organizationsに寄ったことを本番で確認してからmigration化する(`admin/create-supporter` は今も両方に書いているが害はない)
- 災害データは `cases.intake_qna.disaster` 配下(migration不要方針)。正本は `src/lib/constants/disaster.ts`
- ビルド検証は exit code と「Generating static pages (115/115)」で判定(prerender-manifestやhtml数では数が合わない)
- 環境差: Stagingはメール確認OFF/本番はON
- 多言語再公開はフラグ2箇所(LanguageSwitcher.tsx / routing.ts)。ko/vi/idは緊急語彙ネイティブ確認が前提
- チャットに貼られたResend APIキーは落ち着いたら再発行→Supabase SMTP再設定
- `docs/staging_users_20260806.csv` はユーザー一覧のためコミット禁止。docs/配布物(pptx・PDF・インスタ画像)は未追跡のまま
- 将来の招待方式を作る際、共有メモ(APPROVED_SUPPORTERS)の過去データはDBに残っている(表示のみ廃止)
- 本番にテスト用SOSアカウント(捨てアドレス)が1つ残存
