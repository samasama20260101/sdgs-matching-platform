# 多言語対応（i18n）設計方針

作成日: 2026-07-05
更新: 2026-07-05 — §5.8 追加（相談文・チャットの送信時翻訳を採用・論点3解決）
更新: 2026-07-05 — §5.8 に CHECK制約（既存慣行準拠）と再試行cron方式（閲覧時トリガー不採用）を確定
ステータス: ドラフト（実装前・migration未作成）
ブランチ: feature/multilingual-development

日本語UIのみの現行サービスを、**日本語・英語・中国語（簡体字）・韓国語・ベトナム語**
（将来: インドネシア語）で切り替えられるようにするための設計書。

---

## 0. 結論サマリ（最初に読む）

1. **UI文言は「メッセージID方式」を採用する。ただし格納先はDBテーブルではなく、
   リポジトリ内のJSONメッセージカタログ（next-intl）とする。**（§3で理由を詳述）
2. DBが文言まわりで持つもの:
   - チャットに保存される**システムメッセージ**（現在日本語文がDBに焼き込まれている）
     → メッセージID＋パラメータをDBに保存し、**表示時に閲覧者の言語で組み立てる**方式へ変更。
     ここはまさに「メッセージIDのテーブル」的発想が正しい領域。
   - **動的文言（相談文・チャット）の訳文**: 送信時にAI翻訳し、原文＋訳文を二言語で
     DB格納する。**都度翻訳（閲覧時にAIを呼ぶ）はしない**（§5.8）。
   - ユーザーの**言語設定**（`users.locale` 新設）と案件の言語スナップショット（`cases.locale`）。
3. URLは `/[locale]` プレフィックス方式（日本語はプレフィックスなし＝**既存URL不変**）。
4. 多言語（locale）とバリアント（版）は**直交する別の軸**。両方が `src/proxy.ts` と
   文言レイヤーに触るため、実装順序を §6 で整理する。
5. 対象ユーザーの優先度から、**公開ページ＋認証＋SOSフローを第1弾**とし、
   サポーター・管理者UIは当面日本語のままでよい（§8）。
   → その後、サポーターUIの静的文言も実施済み（2026-07-11、§6 Phase 3参照）。管理者UIは日本語のまま。
6. **緊急度判定の単語リスト（現在 日本語＋英語のみ）の多言語化は、翻訳作業より先に行う**。
   人命に関わるため（§5.6）。

---

## 1. 目的とスコープ

### なぜ多言語か

- SOSユーザー＝社会的困難を抱える相談者。在留外国人はまさに
  「制度の枠の外」に落ちやすい層であり、「最後のセーフティネット」という
  サービス思想（AGENTS.md）の中心的な受益者になり得る。
- 選定言語（英・中・韓・越）は在留外国人の主要言語圏と一致する。
- AGENTS.md の将来対応に「日本語⇔インドネシア語」が明記されているため、
  **言語追加が設定1件＋翻訳ファイル1式で済む構造**にする。

### 対象言語とロケールコード

| ロケール | 言語 | URL例 | 備考 |
|---|---|---|---|
| `ja` | 日本語 | `/sos/dashboard`（プレフィックスなし） | 既定・正本 |
| `en` | 英語 | `/en/sos/dashboard` | |
| `zh` | 中国語（簡体字） | `/zh/sos/dashboard` | 在日中国人は大陸出身が多数のため簡体字から。繁体字（`zh-TW`）は将来 |
| `ko` | 韓国語 | `/ko/sos/dashboard` | |
| `vi` | ベトナム語 | `/vi/sos/dashboard` | |
| `id` | インドネシア語 | （将来） | AGENTS.md 将来対応。構造上は追加のみで対応可 |

### スコープ外（このドキュメントでは扱わない）

- 団体紹介文など公開プロフィールの**自動翻訳** → 需要を見て将来判断（§5.8末尾）。
  ※相談文・チャットの翻訳は当初スコープ外候補だったが、**送信時AI翻訳として採用決定**（§5.8）。
- 管理者UI（`/admin/*`）の多言語化 → 運営は日本語話者のため対象外のまま。

---

## 2. 現状分析

### 2.1 文言の所在マップ（2026-07-05 調査）

| # | 所在 | 規模 | 例 |
|---|---|---|---|
| A | ページ・コンポーネントのハードコードUI文言 | **84/97ファイル、日本語含有 約2,200行**（コメント含む） | `src/app/page.tsx`、各ダッシュボード |
| B | 定数のラベル | `src/lib/constants/sdgs.ts` に集中 | `SDG_NAMES`、`CASE_STATUS.label`、`SUPPORTER_BADGES`、`STATUS_STEPS`、`REGION_BLOCKS` |
| C | APIレスポンスのエラーメッセージ | 36ルートファイル | `{ error: '相談内容が必要です' }` |
| D | **DBに保存されるシステムメッセージ** | `messages.content` に `__SYSTEM__` プレフィックス＋日本語文 | `__SYSTEM__サポーターから解決報告が届きました。…` |
| E | **AI生成文（DBに保存）** | `cases.title`・`cases.ai_sdg_suggestion`（summary / per_goal / keywords） | Geminiプロンプトが日本語出力を指示（`src/lib/gemini.ts`） |
| F | SOSヒアリング設問 | `src/app/sos/hearing/page.tsx` の `QA_QUESTIONS`。回答は日本語文のまま `intake_qna` に保存 | |
| G | 緊急度判定の単語リスト | `hearing/page.tsx:190`。**日本語＋英語のみ** | `'死にたい', 'suicide', …` |
| H | メタデータ・OGP | `src/app/layout.tsx`（`lang="ja"` 固定、title/description） | |
| I | 日付フォーマット | `formatRelativeDate()` が `'今日'` `'ja-JP'` を焼き込み | |
| J | 認証メール | Supabase Auth（GoTrue）のテンプレート。単一言語 | 確認メール・パスワードリセット |
| K | 郵便番号→住所 | 日本語住所を返す外部API | 翻訳不要（日本の住所は日本語のまま扱う） |

### 2.2 技術的な前提

- `next-intl@^4.7.0` は **package.json に導入済み・未使用**。ブランチ名どおり、ここから実装開始の状態。
- App Router。tsxの 34/44 がクライアントコンポーネント（next-intl はRSC/Client両対応なので問題なし）。
- `src/middleware.ts` はなく、Next.js 16 のため **`src/proxy.ts`** が存在
  （メンテナンスモード＋本番パスワード保護を実装済み）。next-intl のミドルウェアはここに統合する。
- 一部APIは既に `{ error: 'MESSAGE_TOO_LONG', message: '日本語文' }` の
  **コード＋文言の二重構造**になっており（`offer/route.ts` 等）、エラーコード方式への移行素地がある。

---

## 3. 方式選定 — 「メッセージIDでDBテーブル管理」への回答

検討した3方式:

| 方式 | 内容 | 評価 |
|---|---|---|
| **(a) JSONメッセージカタログ**（採用） | メッセージID → 訳文 の対応をリポジトリ内JSONで管理（next-intl標準） | ◎ |
| (b) DB翻訳テーブル | `translations(key, locale, text)` テーブルを持ち実行時に引く | △ 限定採用 |
| (c) ハードコード分岐 | `locale === 'ja' ? '…' : '…'` | ✕ 論外（保守不能） |

**「メッセージIDで管理する」という発想自体は正しい。** 問題は格納先で、UI文言については
DBテーブルより**コードと同じリポジトリのJSONファイル**が優れる:

1. **文言はコードと同時に変わる。** 画面を変えるPRで訳文も同時にレビュー・デプロイでき、
   「新画面がデプロイされたがDBの訳文がまだない」という不整合が構造的に起きない。
2. **型安全。** next-intl はメッセージ構造からTypeScript型を生成でき、
   存在しないIDの参照や翻訳漏れをビルド時に検出できる。DBだと実行時まで分からない。
3. **性能。** ビルドに焼き込まれるためDBラウンドトリップなし。
   全ページの描画で数十〜数百キーを引くため、実行時DB参照はコスト・障害点になる。
4. **変更履歴。** 訳文の変更がgit履歴・PRレビューに残る。
5. 本プロジェクトの規則「クライアントからDBテーブルを直接読み書きしない」とも整合
   （翻訳テーブルを作ると読み取りAPIかRLS設計が余計に必要になる）。

**DBテーブル方式が正しい領域**（限定採用）:

- **チャット内システムメッセージ**（§5.5）: メッセージは「過去に発生したイベント」であり、
  閲覧者ごとに言語が違う。文言をDBに焼き込む現行方式のままでは多言語化できないため、
  **イベントのID＋パラメータをDBに保存し、表示時にカタログで訳文を組み立てる**。
  DBに置くのは訳文ではなく**メッセージIDと変数**である点が肝。
- 将来、運営が画面から編集したい文言（お知らせ等）が出てきたらDB管理を検討。現状は存在しない。

---

## 4. アーキテクチャ

### 4.1 ライブラリ: next-intl（導入済み依存を使用）

App Router・RSC対応・Next.js 16対応・メッセージID方式・ICU MessageFormat
（複数形・変数埋め込み）対応。デファクトであり追加選定は不要。

### 4.2 ルーティング: `/[locale]` セグメント＋`localePrefix: 'as-needed'`

```
src/app/
├── [locale]/            ← 既存ページを全てこの下へ移動
│   ├── layout.tsx       ← NextIntlClientProvider・lang属性・メタデータ
│   ├── page.tsx
│   ├── (auth)/…
│   ├── sos/…
│   ├── supporter/…
│   └── admin/…          ← 移動はするが翻訳は当面しない（ja文言のまま）
├── api/                 ← [locale] の外（URL不変）
└── maintenance/         ← [locale] の外に残す選択肢あり（要検討）
```

- `as-needed`: 既定ロケール（ja）はプレフィックスなし。**既存の全URL・ブックマーク・
  チラシ記載URLが無変更**で動き続ける。他言語のみ `/en/...` 等が付く。
- 公開ページ（LP・story・supporters・terms・privacy）はSEO・共有URLの観点で
  言語がURLに現れることが必須。`hreflang` は next-intl の `getAlternateLinks` 相当で自動生成。
- ログイン後画面もURL方式に統一する（Cookie方式との併用はキャッシュ・共有時の言語ずれ事故のもと）。

**代替案（不採用）**: Cookieのみでロケール切替（URL不変）。
ディレクトリ移動が不要になる利点はあるが、公開ページのSEO不可・言語付きURLを
共有できない・Vercelのキャッシュと相性が悪い、により不採用。

### 4.3 proxy.ts への統合

`src/proxy.ts` に next-intl のミドルウェアを組み込む。処理順:

```
1. メンテナンスモード判定（現行・最優先）
2. 本番パスワード保護（現行）
3. next-intl ロケール解決・rewrite/redirect（新規）
4. （将来）バリアントのホスト名判定 → x-variant ヘッダ付与
```

- ロケール解決順: **URLプレフィックス → NEXT_LOCALE Cookie → Accept-Language → ja**。
- ログイン済みユーザーは `users.locale`（§4.5）を優先し、初回アクセス時に
  Cookieへ同期する（proxy はDBを引かない。Cookie経由で反映）。
- `/api/*`・静的ファイルはロケール処理の対象外。

### 4.4 メッセージカタログ構成

```
messages/
├── ja/                  ← 正本（source of truth）
│   ├── common.json      # ボタン・共通ラベル・ステータス名
│   ├── landing.json     # LP・story
│   ├── auth.json        # ログイン・登録・パスワード系
│   ├── sos.json         # ヒアリング・ダッシュボード・結果画面
│   ├── supporter.json   # （第2弾以降）
│   ├── errors.json      # APIエラーコード → 表示文言
│   ├── system.json      # チャット内システムメッセージ
│   ├── sdgs.json        # SDG_NAMES 等の定数ラベル
│   └── legal.json       # terms / privacy（長文・§5.11参照）
├── en/ … ko/ … zh/ … vi/（同一構造）
```

- `src/i18n/request.ts` で namespace を結合してロードする（next-intl 標準構成）。
- キー命名: `<namespace>.<画面>.<要素>`（例: `sos.hearing.submitButton`）。
- **ja を正本**とし、他言語は ja のキー集合と常に一致させる。
  差分検出スクリプトを `scripts/check-i18n-keys.ts` として用意し、lint と同時に実行。

### 4.5 DB変更: `users.locale`（migration 1本）

```sql
-- migrations/add_user_locale.sql（ドラフト。Staging適用 → 確認 → 本番はルール通り）
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'ja'
  CHECK (locale IN ('ja', 'en', 'zh', 'ko', 'vi', 'id'));
```

用途:
- ログイン後の言語復元（デバイスが変わっても言語が維持される）。
- 将来のメール・通知の言語決定（§5.9）。
- **サポーターへの「相談者の言語」表示**（§5.7）。
- rollback: `ALTER TABLE users DROP COLUMN IF EXISTS locale;` のみ。追加のみの変更で旧コード非破壊。

---

## 5. 領域別の設計（§2.1のマップに対応）

### 5.1 [A] UI文言 → next-intl `useTranslations` / `getTranslations`

最大ボリューム（約2,200行）だが機械的な置換作業。

```tsx
// Before
<h1>あなたの困りごとを聞かせてください</h1>
// After
const t = useTranslations('sos.hearing');
<h1>{t('title')}</h1>
```

- 画面単位で移行し、**移行済み画面リストをこのドキュメント末尾で管理**する。
- 未移行画面は日本語のまま表示される（壊れない）。段階移行が可能。

### 5.2 [B] 定数ラベル → ラベルだけキー化、ロジック値はコードに残す

`CASE_STATUS` 等は「表示ラベル」と「色・遷移・step等のロジック値」が同居している。
**ラベルのみ**メッセージキーに置き換える:

```typescript
// constants/sdgs.ts — labelKey に変更。色・icon・stepはそのまま
OPEN: { labelKey: 'caseStatus.open', color: 'bg-blue-100 …', icon: '⏳', step: 1 },
```

- `SDG_NAMES` → `sdgs.json` の `goal.1` 〜 `goal.17`（SDGs17ゴールには各国語の公式訳が存在する。国連広報の公式訳を使用）。
- `REGION_BLOCKS`・都道府県名: **DB・ロジック上の値は日本語のまま維持**し、
  表示時のみ翻訳マップを噛ませる（値を変えるとデータ移行が発生するため）。
- `formatRelativeDate()` → next-intl の `useFormatter().relativeTime()` へ置換。

### 5.3 [C] APIエラーメッセージ → エラーコード方式へ統一

サーバーは翻訳しない。**コードとパラメータを返し、クライアントが翻訳する**:

```typescript
// Before
return NextResponse.json({ error: '相談内容は10文字以上入力してください' }, { status: 400 })
// After
return NextResponse.json(
  { error: 'CONSULTATION_TOO_SHORT', params: { min: 10 } }, { status: 400 })
// クライアント: t(`errors.${code}`, params) で表示。未知コードは errors.UNKNOWN にフォールバック
```

- 一部ルート（offer等）は既に `error: 'MAX_REACHED', message: '…'` の形になっており、
  この方式の完成形。**移行中は `message`（ja文）を併記**して未対応クライアントを壊さない。
- サーバー側で翻訳しない理由: API層にロケール伝搬が不要になり、
  同じレスポンスを言語の違う画面で使い回せる。

### 5.4 [F] SOSヒアリング設問 → バリアント設計の「設問外出し」と統合

`docs/variant_architecture_design.md` §5.2 が既に計画している
**QA設問の外出し＋選択肢ID化（`q4_2` 等）＋`urgent` フラグ化**は、多言語でも同じ前提になる:

- 設問・選択肢の**文言はメッセージキー**（`sos.questions.q4.options.q4_2`）にする。
- `intake_qna` への保存は現計画どおり **`{ id, text }` のスナップショット**。
  `text` はユーザーが見た言語の文言が入る。**IDがあるから言語横断で集計できる**
  （バリアント設計の「版間で文言が違っても横断集計できる」と完全に同型の解決）。
- 案件の言語は `cases.locale` へスナップショットする（§5.8）。`intake_qna` 側にも
  `"locale"` を併記してよいが、正本は `cases.locale`。
- 緊急判定 `selectedAnswers[4]?.has('死にたいと思うことがある')` の**文字列一致は多言語化で確実に壊れる**。
  バリアント設計で必須とされた `urgent: true` フラグ化を、多言語Phase 0の前提作業とする。

### 5.5 [D] DB保存システムメッセージ → **ID＋パラメータ方式へ（本設計の核心）**

現状: `messages.content = '__SYSTEM__サポーターの解決報告から14日が経過したため、…'`
→ 日本語文がDBに焼き込まれ、閲覧者の言語で出せない。

新方式:

```sql
-- migrations/add_system_message_keys.sql（ドラフト）
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS system_key text NULL,
  ADD COLUMN IF NOT EXISTS system_params jsonb NULL;
```

```typescript
// 書き込み側（例: オファー取り下げ）
{
  message_type: 'SYSTEM',
  system_key: 'offerWithdrawn',
  system_params: { organizationName: '…', reason: '…' },
  content: '__SYSTEM__〇〇が対応をキャンセルしました。…',  // ja文も引き続き保存（後方互換・監査用）
}
// 表示側: system_key があれば t(`system.${key}`, params) で閲覧者の言語で描画。
//        なければ（過去データ）content の __SYSTEM__ を剥がして表示（現行動作）。
```

- **同じ1行のメッセージを、SOSユーザーはベトナム語で、サポーターは日本語で見られる**ようになる。
- 過去データのバックフィル不要（フォールバックで日本語表示継続）。
- 対象キー（現行5種）: 解決報告到着 / 未解決の返答 / 自動解決 / 自動終了 / オファー取り下げ。
- 注意: `system_params` に入る団体名・理由文はユーザー生成のため翻訳されない（それで正しい）。

### 5.6 [G] 緊急度判定の多言語化 — **最優先・翻訳作業より先**

`urgentWords` リストは現在 日本語＋英語のみ。中国語・韓国語・ベトナム語で
「死にたい」と書かれても検出できない状態で他言語の入口を開けるのは危険。

- Phase 0 で `zh` / `ko` / `vi`（＋`id`）の危機語彙を追加する。
  訳語はネイティブ話者または専門機関の資料で必ず検証する（機械翻訳のみは不可）。
- 中期的には単語一致ではなく、既存のGemini分類フローに緊急度判定を組み込む
  （AGENTS.md 将来対応「緊急度判定AI」と接続）。単語リストはそれまでの安全網。

### 5.7 [E] AI生成文（Gemini） — 出力言語の制御と二言語生成

`src/lib/gemini.ts` のプロンプトは日本語出力前提。相談者の言語対応で2つの問題が生じる:

1. **相談者向け出力**（summary / per_goal — 寄り添いメッセージ）
   → プロンプトに「`{locale}` で出力せよ」を注入し、**相談者の言語**で生成・保存する。
   Gemini は多言語入力の分類・多言語出力とも問題なくこなす。
2. **サポーター向け表示**（cases.title・分類結果はサポーターも読む）
   → 相談者の言語だけで保存すると日本語のサポーターが読めない。

**推奨: AI出力を二言語で保存する。**

```
cases.title            → jsonb化 or title_ja カラム追加で {ja, user言語} の2つを保持
cases.ai_sdg_suggestion → 既にjsonb。{ locale: 'vi', summary: …, summary_ja: …, … } 形式に拡張
```

- 1回のGemini呼び出しで両言語を同時出力させればAPIコストは微増で済む
  （出力トークンが約2倍になるだけ。呼び出し回数は増えない）。
- `description_free`（相談原文）も案件作成時に日本語訳を1回生成して保存する（§5.8）。
  AI要約＋全文訳の両方が揃い、サポーターは相談の中身を日本語で把握できる。
- ケース詳細画面（サポーター側）に **「この相談は○○語で書かれています」** バッジを表示
  （`cases.locale` から判定。§5.8）。マッチング判断の材料として必須。
- チャット本文の翻訳は**送信時AI翻訳・二言語保存として採用**（2026-07-05 合意）。設計は §5.8。

### 5.8 [動的文言] 相談文・チャット — 送信時AI翻訳・二言語DB格納（2026-07-05 合意）

静的文言（メッセージID方式）と対になる、**ユーザーが書く自由文**の設計。
送信時にAI翻訳し、**原文と訳文の両方をDBに格納する**。都度翻訳（閲覧のたびにAIを呼ぶ）はしない。

#### 翻訳ペアの導出 — 会話言語の設定UIは作らない

サポーターは日本語話者（現状の運用前提）。よって案件ごとの言語ペアは
**「相談者の言語 ⇔ 日本語」の2言語に固定**され、専用の設定なしで自動導出できる:

```
案件作成時: cases.locale = 相談者の users.locale をスナップショット

送信者がSOS        → cases.locale ≠ ja なら ja へ翻訳
送信者がサポーター  → cases.locale ≠ ja なら cases.locale へ翻訳
cases.locale = ja  → 翻訳は一切走らない（現行の全案件・コスト影響ゼロ）
```

- **設定を増やさない理由**: SOSユーザーに「UI言語」と別の「会話言語」を選ばせるのは
  操作負担と設定ミス事故（UIはベトナム語なのにチャットは日本語で届く等）の入口になる。
  UI言語＝読める言語が最も確かなシグナル。
- **サポーター側を ja 固定にする実利**: 1案件には最大2団体＋SOSが同居する。参加者ごとに
  言語を持たせると1メッセージあたりの翻訳数が participant 数で増えるが、
  「案件 ⇔ ja」の1ペア固定なら誰が何人参加しても**翻訳は常に1方向1回**。
- 案件の途中でSOSユーザーがUI言語を変えても `cases.locale` は変えない（履歴の一貫性優先。
  新しい案件から新言語を適用）。実需が出たら管理者操作「案件の言語変更」を将来追加。
- 外国人スタッフのいるサポーター団体が将来現れても、翻訳ペアは case ⇔ ja のままとし
  ja版を読んでもらう（ペア追加はそれが実需になってから）。

#### データ設計（DDLドラフト・Phase 2）

```sql
-- migrations/add_case_chat_translation.sql（ドラフト）
-- CHECK制約は既存スキーマの慣行に合わせる（inquiries.status / offers.status 等と同形式）
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'ja'
    CHECK (locale IN ('ja', 'en', 'zh', 'ko', 'vi', 'id')),
  ADD COLUMN IF NOT EXISTS description_free_ja text NULL;  -- 相談文の日本語訳（locale='ja'ならNULL）

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS source_locale text NOT NULL DEFAULT 'ja'   -- 送信者が書いた言語
    CHECK (source_locale IN ('ja', 'en', 'zh', 'ko', 'vi', 'id')),
  ADD COLUMN IF NOT EXISTS translated_content text NULL,              -- 相手言語への訳文
  ADD COLUMN IF NOT EXISTS translation_status text NOT NULL DEFAULT 'NONE'
    CHECK (translation_status IN ('NONE', 'DONE', 'PENDING', 'FAILED')),
    -- NONE（翻訳不要）/ DONE / PENDING（再試行待ち）/ FAILED（上限到達・原文表示で確定）
  ADD COLUMN IF NOT EXISTS translation_attempts smallint NOT NULL DEFAULT 0;

-- cron の回収スキャン用（PENDINGのみの部分インデックス）
CREATE INDEX IF NOT EXISTS idx_messages_translation_pending
  ON messages (created_at) WHERE translation_status = 'PENDING';
```

> ⚠️ **言語追加時のチェックリスト**: 新言語（`id` 等）を足すときは、コード側
> （routing・messages/）に加えて **`users.locale` / `cases.locale` / `messages.source_locale`
> の3つのCHECK制約を同一migrationで更新**すること。
> （DOMAINでの一元化も検討したが、既存スキーマにCHECK直書きの慣行が確立しており、
> 言語追加は稀なため新概念は持ち込まない）

書き込みフロー（`POST /api/messages`）:

```
1. 原文を content に即保存（翻訳を待たない。送信をブロックしない）
2. Gemini（gemini-2.5-flash）で相手言語へ翻訳。失敗時は同一リクエスト内で1回だけ即時リトライ
3. 成功: translated_content へ保存・status = DONE
   失敗: status = PENDING のまま応答を返し、cron が回収する（下記）
   成功後は二度と翻訳しない — 常にDB格納に収束する
```

#### PENDING の再試行は cron（閲覧時トリガーは不採用・2026-07-05 決定）

```
vercel.json に追加: /api/cron/retry-translations   schedule: */15 * * * *（15分間隔）

処理: translation_status = 'PENDING' を古い順に最大20件処理
  成功 → DONE
  失敗 → translation_attempts をインクリメント。5回で FAILED 確定
  cases.description_free_ja が未生成の外国語案件も同じジョブで回収
FAILED の表示: 原文＋「AI翻訳できませんでした」注記（送信・閲覧は一切ブロックしない）
```

閲覧時トリガーを採らない理由:

1. 読み取りAPI（`GET /api/messages`）に外部AI呼び出しが入り、遅く・非冪等になる。
2. チャットは60秒ポーリング（プロジェクト規約）のため、翻訳が失敗し続けている間、
   **閲覧者全員のポーリングごとに再翻訳が走る**（重複呼び出し防止のロックが別途必要になり、
   コスト暴走の入口になる）。
3. cron は既存の運用パターン（`vercel.json` / auto-close-cases）に乗るだけで新概念が増えない。

表示ルール:

| 閲覧者 | 表示 |
|---|---|
| サポーター | ja版（原文が ja ならそのまま、外国語なら訳文）＋「原文を表示」トグル |
| SOSユーザー | cases.locale 版（同上の逆） |
| 管理者 | ja版＋原文（両方DBにあるため追加実装なし） |

翻訳が1回で済む理由＝メッセージは不変（append-only）。閲覧は通常のDB読み取りのみで、
コスト・速度・訳文の一貫性・Gemini障害時の可読性すべてで都度翻訳に勝る。

#### 福祉サービスとしてのUX原則（一般的なチャット翻訳との違い）

1. **原文は常に保持・常に確認可能**（「原文を表示」トグル）。訳文だけの保存は絶対にしない
   — 誤訳の検証可能性・運営介入時の証拠性のため。
2. **「AI翻訳」ラベルを訳文に明示**。誤解が生じたとき「翻訳のせいかも」と気づける導線が
   対人支援では重要。
3. **翻訳失敗で送信をブロックしない**。SOSの発信が翻訳APIの障害で止まるのは最悪ケース。
4. **緊急度判定（§5.6）は必ず原文に対して行う**。翻訳で危機表現が弱まる・落ちるリスクがある。

#### 翻訳がそもそも不要になる領域（ID化の効能・再掲）

- QA回答（`intake_qna`）: 選択肢IDから閲覧者言語のカタログ文言を引くため翻訳不要（§5.4）。
  「その他」自由記述のみ翻訳対象。
- システムメッセージ: ID＋パラメータ方式（§5.5）で翻訳不要。ただし `system_params` 内の
  自由文（辞退理由など、サポーターが日本語で書く）は翻訳対象になる点に注意。

#### スコープ外のまま残すもの

- 団体紹介文（`organizations` の bio 等）の翻訳: SOSが公開サポーター一覧を見る場面。
  更新頻度が低いので同じ「保存時翻訳」パターンを適用できるが、需要を見て将来判断。

### 5.9 [J] 認証メール（Supabase Auth）

GoTrue のメールテンプレートは1言語1テンプレート。当面の現実解:

- **Phase 1: 日英併記テンプレート**（上段ja・下段en）に差し替え。全言語話者が最低限読める。
- 将来: Supabase の Send Email Hook で `users.locale` に応じたテンプレートを送出。
- Staging / Production 両方のダッシュボード設定変更が必要（本番はルール通りユーザー許可を得て実施）。

### 5.10 [H] メタデータ・lang属性

- `src/app/[locale]/layout.tsx` で `<html lang={locale}>`、`generateMetadata` で
  locale別 title / description / OGP を返す。`alternates.languages`（hreflang）も設定。
- OGP画像内の日本語文字はPhase 1では共通のまま（画像の言語別出し分けは将来）。

### 5.11 [長文ページ] terms / privacy / story

- 規約・プライバシーポリシーは**法的文書**。機械翻訳での公開はリスクがあるため、
  Phase 1 では「正文は日本語であり翻訳は参考」である旨の注記を各言語で付す。
  文言量も多い（各約100行）ため、キー分割ではなく**言語別MDX/コンポーネント差し替え**
  （`terms/ja.tsx`, `terms/en.tsx`…）とし、細かいキー管理はしない。
- story（サービス紹介）も同様に言語別ファイルが管理しやすい。

### 5.12 フォント

- 現行 Geist は Latin のみ。日本語は現在もシステムフォントにフォールバックしており、
  **中・韓も同様にフォールバックで表示は成立する**（追加作業なしで破綻しない）。
- ベトナム語のダイアクリティカルマーク（ẻ, ộ 等）は Geist の Latin 拡張でカバーされるが、
  Phase 1 のQAで表示確認を行う。品質を上げたくなったら `next/font` で
  Noto Sans SC / KR を locale 別サブセット読み込み（性能とのトレードオフで判断）。

### 5.13 zodバリデーション

フォームのzodスキーマ内の日本語 `message` は、エラーコード（キー）を入れて
表示側で `t()` する方式に統一（§5.3と同じ思想）。

---

## 6. バリアント（版）構想との整合 — 重要

`docs/variant_architecture_design.md` と本設計は**直交する2軸**:

| 軸 | 問い | 解決手段 | 判定場所 |
|---|---|---|---|
| バリアント（版） | **誰の**プールに属し、どの皮を見るか | ホスト名（サブドメイン） | proxy.ts → `x-variant` |
| ロケール（言語） | **何語で**表示するか | URLパス `/[locale]` ＋ Cookie | proxy.ts → next-intl |

`kanagawa.samasama.site/vi/sos/hearing` = 神奈川県版をベトナム語で、が自然に表現できる。

### 文言解決の2次元化

バリアント設計の `copy`（版ごとの文言上書き）は、i18n導入後は
**「メッセージカタログへの版別オーバーライド」**として一本化する:

```
t('landing.heroTitle') の解決順:
  1. variant別オーバーライド（variants/<code>/messages/<locale>.json、あれば）
  2. 標準カタログ（messages/<locale>/…）
  3. ja へのフォールバック
```

- 版のcopyオーバーライドは通常ごく少数キー（heroTitle等）なので、部分ファイルのマージで実現。
- **バリアント実装がまだ先でも、この解決順を前提にした構造にしておけば後から差し込める。**

### 実装順序の調整

両設計が共通で要求する先行作業（どちらを先にやる場合でも必要）:

1. QA設問の外出し・選択肢ID化・urgentフラグ化（variant §5.2 / 本書 §5.4）
2. `requireActiveAppUser()` への認証統一（variant §4.4 — ロケール解決にも同じ一点集中が効く）

i18n Phase 0–1（§8）は**DBスキーマにほぼ触れない**（`users.locale` 1カラムのみ・独立適用可）ため、
D案本番適用やバリアントPhase 2のmigrationと衝突しない。**i18nを先行して問題ない。**

---

## 7. 翻訳の運用

| 項目 | 方針 |
|---|---|
| 正本 | `messages/ja/`。他言語はjaのキー集合と一致必須（CIで差分チェック） |
| 初回翻訳 | Gemini による機械翻訳をベースに生成（スクリプト化: `scripts/translate-messages.ts`） |
| レビュー | **SOS向け文言（sos / auth / system / errors）はネイティブレビュー必須**。トーンは「温かく・専門用語なし・やさしい表現」（サービス思想と同じ基準を全言語で） |
| SDGsゴール名 | 各言語の国連公式訳を使用（機械翻訳しない） |
| 危機語彙（§5.6） | 機械翻訳のみ不可。専門資料・ネイティブ検証必須 |
| 翻訳漏れ | キー欠落はビルド/CIで検出。訳文未着のキーはjaへフォールバック表示 |
| 用語集 | 「サポーター」「案件」「解決報告」等のサービス用語は用語集を作り訳語を固定（`docs/i18n_glossary.md` を翻訳開始時に作成） |

---

## 8. 段階導入ロードマップ

| フェーズ | 内容 | 規模感 |
|---|---|---|
| **0. 基盤** | next-intl設定（`src/i18n/`・proxy.ts統合・`[locale]`ディレクトリ移動）、`messages/` 骨格、LanguageSwitcherコンポーネント（全言語を自言語表記: 日本語/English/中文/한국어/Tiếng Việt）、`users.locale` migration（Staging）、**緊急語彙の多言語化**、QA設問ID化・urgentフラグ化 | ディレクトリ移動が主。機械的だが全ページに触るため単独PRで |
| **1. 公開＋SOS** | LP・story・supporters公開ページ・auth一式・SOSフロー全画面（hearing/dashboard/result/cases）・共通コンポーネント・定数ラベル・メタデータ。terms/privacyは言語別ファイル＋参考訳注記 | 翻訳対象 約800〜1,000キー × 4言語。最大の作業 |
| **2. 動的文言** | システムメッセージID化（migration＋書き込み5箇所＋表示側）、APIエラーコード化（36ルート・段階的に）、AI出力の言語制御＋二言語保存、**相談文・チャットの送信時翻訳**（§5.8: `cases.locale` / `messages` 翻訳カラムのmigration＋送信API＋原文トグルUI＋再試行cron）、相談言語バッジ（サポーター側） | DB migration 2本＋API改修 |
| **3. サポーター側** | サポーターUIの多言語化 → **実施済み（2026-07-11）**: ダッシュボード・案件詳細・メンバー管理・組織未所属・内部メモの静的文言をID化（`supporter.dashboard/caseDetail/members/noOrganization/notes`） | 約170キー × 6言語 |
| **4. 将来** | メールのlocale別送出、`id`（インドネシア語）追加、OGP画像出し分け、`zh-TW`、団体紹介文の翻訳 | プロダクト判断後 |

- 各フェーズは dev → Staging で確認後、本番へ（AGENTS.mdの通常フロー）。
- Phase 0 のディレクトリ移動は差分が大きいため、**他の機能開発PRと重ねない**よう調整する。

### 移行済み画面チェックリスト（Phase 1で更新していく）

```
☑ / （LP）         ☑ /story（注記）   ☑ /supporters, /supporters/[id]
☑ /terms（注記）    ☑ /privacy（注記）  ☑ /contact
☑ /login ☑ /signup ☑ /forgot-password ☑ /reset-password ☑ /verify-email ☑ /change-password
☑ /sos/hearing ☑ /sos/dashboard ☑ /sos/result/[id] ☑ /sos/cases
☑ /profile（共有+SOS部分。サポーター専用カードはPhase 3）  ☑ /maintenance
☑ 共通: Header（Phase 0）  ☑ MessageThread ☑ AddressForm
※ お問い合わせカテゴリはDB保存値を日本語正本のまま・表示ラベルのみ翻訳（管理画面互換）。
※（注記）= 本文は日本語のまま、閲覧言語での案内バナーを表示（JaOnlyNotice）。
   本文翻訳は法務・広報確認後に言語別ファイルへ差し替え（§5.11）。
```

---

## 9. 未決事項・要意思決定

| # | 論点 | 暫定方針 |
|---|---|---|
| 1 | 中国語は簡体字のみで開始してよいか | 簡体字（`zh`）のみ。繁体字は需要が見えたら `zh-TW` 追加 |
| 2 | ~~サポーターUI（Phase 3）をやるか~~ | **解決（2026-07-11）**: 静的文言のみ実施済み。Dev検証で「言語切替時にサポーター画面だけ日本語が残る」違和感が確認されたため前倒し |
| 3 | ~~チャットの自動翻訳~~ | **解決（2026-07-05）**: 送信時AI翻訳・二言語DB格納を採用。会話言語の設定UIは作らず `cases.locale ⇔ ja` から自動導出（§5.8） |
| 4 | terms/privacy の翻訳を弁護士等が確認するか | 「正文は日本語」注記方式で開始。要確認 |
| 5 | 危機語彙リストのネイティブ検証体制 | 要手配（各言語1名以上）。Phase 0 のブロッカー |
| 6 | AI二言語出力のコスト増（出力トークン約2倍） | 許容見込みだが、単価確認の上で判断 |
| 7 | 言語切替UIの配置（ヘッダー常設か、フッターか） | 未ログインは ヘッダー常設（地球儀アイコン＋言語名）を推奨。SOSユーザーが迷わないことを最優先 |

---

## 10. 関連ドキュメント

- `AGENTS.md` — 作業ルール・本番保護ルール・将来対応（多言語 ja⇔id）
- `docs/variant_architecture_design.md` — バリアント構想（§6で整合を定義）
- `docs/api_security_design.md` — APIエラー形式の変更（§5.3）が触る領域
- next-intl 公式: https://next-intl.dev/（App Router / `[locale]` セグメント構成）
