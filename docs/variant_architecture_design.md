# バリアント（版）アーキテクチャ設計書

作成日: 2026-06-12
ステータス: ドラフト（実装前・migration未作成）

「全国版」「神奈川県版」「老人版」のように、同一プラットフォーム上で
**UI/UXだけをカスタマイズした専用版（バリアント）** を量産できる構造にするための設計書。

---

## 1. 目的とゴール

- DB構造・ロジック・機能は**共通のまま**、見た目・文言・設問・入口だけを版ごとに変える。
- カスタマイズ要件（「○○市版を作りたい」等）が来たとき、**設定ファイルの追加だけでモックが立ち上がる**構造にする。
- 版ごとにユーザー・案件のプールを**完全分離**する（同じ版同士しか見えない）。

### 用語

| 用語 | 意味 |
|---|---|
| バリアント（版） | 全国版・神奈川県版・老人版など、入口とプールの単位 |
| 皮（スキン） | テーマ色・ロゴ・文言・設問セット・ランディング構成。版ごとに差し替える |
| 仕切り（スコープ） | どの版のユーザー・案件が見えるかのアクセス制御。サーバー側で強制 |

---

## 2. 基本コンセプト

```
┌─────────────────────────────────────────────────┐
│ 1つの Next.js アプリ / 1つの Supabase / 1つの認証基盤 │
├─────────────────────────────────────────────────┤
│ 入口URL（版ごと）→ proxy.ts が版を判定               │
│   main.samasama.site      → 全国版                │
│   kanagawa.samasama.site  → 神奈川県版             │
│   senior.samasama.site    → 老人版                │
├─────────────────────────────────────────────────┤
│ 皮: バリアント設定（コード側） … 版ごとに定義          │
│ 仕切り: variant_code（DB側）   … APIで必ず絞り込み    │
└─────────────────────────────────────────────────┘
```

### 決定事項（本会話での合意）

1. **完全分離モデル**: SOS1（全国版）はサポーター1（全国版）しか見えない。サポーター2（神奈川版）はSOS2しか見えない。
2. **SOSユーザーは1版固定**: 登録した入口の版で確定。変更不可（運営による移動は別途）。
3. **サポーター（団体）は複数版に所属可**: 「複数の顔」。中間テーブルで管理。
4. **ログイン後の版切替**: デフォルト版で開き、ヘッダーの切替UIで版を変更。切替時は**ページ全体リロード**。
5. **認証は1つ**: メール＋パスワードはどの入口でも共通。入口を分けてもアカウントは分けない。
6. **本体（全国版）も1つの版として扱う**: `'main'` コード。「NULL＝本体」にはしない。
7. **管理者は全版横断**: 版フィルタ付きで全版を閲覧・操作できる。
8. **運営による案件の版移動**: 誤った入口から入った相談を適切な版へ移せる（variant_code の付け替え）。

### 完全分離の既知のトレードオフ（了承済み・再掲）

- 軸の掛け合わせ不可: 「神奈川在住の高齢者」はどちらかの入口を選ぶ。神奈川×老人が必要になったら第4の版として追加。
- プール細分化によるマッチング機会の減少 → 運営介入（版移動・セーフティネット導線）で補う。

---

## 3. データ設計（DDLドラフト）

> ⚠️ 以下は**ドラフト**。実装時に migration SQL として正式作成し、
> AGENTS.md の手順（Staging適用 → 確認 → 本番はrunbook）に従うこと。

### 3.1 versions マスタ: `variants`

```sql
CREATE TABLE variants (
  code        text PRIMARY KEY,          -- 'main' / 'kanagawa' / 'senior'
  name        text NOT NULL,             -- '全国版' / '神奈川県版' / '老人版'
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO variants (code, name, sort_order) VALUES
  ('main', '全国版', 0);
```

- 版の**コードと存在**だけをDBで管理。テーマ・文言などの中身はコード側（§5）。
- FK制約により typo がアクセス制御の穴になるのを防ぐ。

### 3.2 SOSユーザー・案件: 1カラム追加

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS variant_code text NOT NULL DEFAULT 'main'
  REFERENCES variants(code);

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS variant_code text NOT NULL DEFAULT 'main'
  REFERENCES variants(code);

CREATE INDEX IF NOT EXISTS idx_cases_variant_status ON cases (variant_code, status);
```

- 既存データはすべて `'main'`（全国版）に自動的に属する → 既存機能への影響なし。
- **案件の variant_code はクライアントから受け取らない**。案件作成APIがサーバー側で
  所有者（SOSユーザー）の variant_code を引き継いで焼き込む。
- オファー・メッセージ・バッジは案件にぶら下がるため**版カラム不要**。案件の版が唯一の真実。

### 3.3 サポーター団体の複数所属: 中間テーブル

```sql
CREATE TABLE organization_variant_memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  variant_code    text NOT NULL REFERENCES variants(code),
  is_default      boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE / SUSPENDED
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, variant_code)
);

-- デフォルト版は団体ごとに1つだけ
CREATE UNIQUE INDEX idx_org_variant_default
  ON organization_variant_memberships (organization_id)
  WHERE is_default;

-- 既存団体を全国版デフォルト所属にする初期データ
INSERT INTO organization_variant_memberships (organization_id, variant_code, is_default)
SELECT id, 'main', true FROM organizations;
```

- 版への参加・脱退＝行の追加・status変更のみ。**コード変更不要の運用作業**。
- 将来「版ごとの顔」（版別の表示名・bio）が必要になったら、このテーブルに
  上書きカラムを足すだけで拡張できる（フラグ方式では不可能だった拡張）。

### 3.4 指標管理 — 共通マスタ＋版別設定（2026-06-12 合意）

「版ごとに指標を管理したい」要件への方針: **定義（マスタ）は共通、利用設定は版ごと**。
版ごとに指標マスタを別領域にすると、全体インパクトレポート（行政報告・助成金審査）で
同一指標の横断合算ができなくなり、GI定義文（AI分類のプロンプト入力）の保守も版数分に
増えるため、完全分離はしない。

指標は2種類に分けて扱う:

1. **集計指標**（案件数・解決数・マッチング率等）: 専用領域は不要。
   案件に variant_code が付くため、ダッシュボードの集計を版で絞るだけで版別の数値が出る。
2. **指標マスタ**（SDGs GI定義のような「何を測るか」の定義 — AGENTS.md 機能4の
   `sdg_indicators`）: 以下のハイブリッド構成。

```sql
-- 計画済みの sdg_indicators に1列追加
ALTER TABLE sdg_indicators
  ADD COLUMN owner_variant_code text NULL REFERENCES variants(code);
  -- NULL = 共通指標（SDGs GI）/ 値あり = その版の独自指標（県の施策KPI等）

-- 版ごとの利用設定（membership と同じパターン）
CREATE TABLE variant_indicator_settings (
  variant_code   text NOT NULL REFERENCES variants(code),
  indicator_id   text NOT NULL REFERENCES sdg_indicators(id),
  is_active      boolean NOT NULL DEFAULT true,
  sort_order     integer NOT NULL DEFAULT 0,
  label_override text NULL,   -- 版向けの言い換え（老人版のやさしい表現等）
  PRIMARY KEY (variant_code, indicator_id)
);
```

- 版ごとに「使う指標の選択・並び・言い換え」だけを設定する（老人版は健康・福祉系を中心に有効化等）。
- 版独自指標は `owner_variant_code` 付きの行として同じマスタに追加。
  分類・集計のパイプラインは共通のまま使える。
- AI 2段階分類は「案件の版で有効な指標」を候補としてAIに渡す（パイプラインは1本）。
- `case_sdg_classifications`（分類結果）に版カラムは持たせない。案件経由で版が引ける
  （「案件の版が唯一の真実」原則）。
- 全体報告は `owner_variant_code IS NULL` の共通指標で全版を合算する。

### 3.5 migration適用計画・rollback（2026-06-12 追記）

**索引・RLS**:

```sql
CREATE INDEX idx_cases_variant_status ON cases (variant_code, status)
  WHERE visibility = 'LISTED';   -- サポーターダッシュボードの主クエリに対応
-- 新テーブル3枚（variants / organization_variant_memberships /
-- variant_indicator_settings）はすべて ENABLE ROW LEVEL SECURITY
-- （アクセスはservice_role経由APIのみ。anon直アクセス遮断目的）
```

**rollback（逆順に落とすだけで完全復元・既存データ無傷）**:

```sql
DROP TABLE IF EXISTS variant_indicator_settings;
ALTER TABLE sdg_indicators DROP COLUMN IF EXISTS owner_variant_code;
DROP TABLE IF EXISTS organization_variant_memberships;
ALTER TABLE cases DROP COLUMN IF EXISTS variant_code;
ALTER TABLE users DROP COLUMN IF EXISTS variant_code;
DROP TABLE IF EXISTS variants;
```

追加のみの変更のため、旧コードのままでも壊れない（デプロイとmigrationの順序に非依存）。

**適用順序**:

1. D案本番適用（runbookどおり・2Wテスト後）
2. `accept_sos_offer` 修正版は同じ作業窓で適用（修正済みmigrationファイルに含まれる。
   Stagingには事前に CREATE OR REPLACE を再実行しておく）
3. バリアント基盤（variants / variant_code / memberships）→ variant Phase 2 着手時にStagingへ
4. 指標（sdg_indicators + variant_indicator_settings）→ 機能4実装時に同梱
5. 3・4 それぞれStaging検証後に本番適用

### 3.6 拡張予約（今は作らない）

- 版ごとのプロフィール上書き: `organization_variant_memberships` に `display_name_override` / `bio_override` 等。
  メッセージの `sender_organization_name_snapshot` には「案件の版に対応する顔」を焼き込む。
- 神奈川×老人のような掛け合わせ版: 新しい variant 行として追加（軸の合成はしない）。

---

## 4. アクセス制御（仕切り）

### 4.1 大原則

> **すべての案件系クエリは、必ず1つの variant_code で絞る。絞り込みはサーバー側（APIルート）でのみ行う。UIの出し分けはアクセス制御ではない。**

現状の `GET /api/supporter/dashboard` は `visibility = 'LISTED'` のみで全件取得しており、
版スコープなしでは全サポーターが全案件を見られる。版対応時に必ず修正する。

### 4.2 認証ヘルパーへの一点集中

版の解決ロジックは各ルートにコピペせず、`src/lib/api/auth.ts` の
`requireActiveAppUser()` を拡張して一箇所で行う:

```typescript
type AuthSuccess = {
  token: string
  authUser: User
  appUser: ActiveAppUser
  variant: {
    active: string          // いま有効な版コード（検証済み）
    memberships: string[]   // サポーターの場合: 所属する全版
  }
}
```

解決手順:

1. リクエストの Cookie（またはヘッダー）から「選択中の版」を読む。
2. **SOS**: `users.variant_code` が常に active。Cookie は無視。
3. **SUPPORTER**: 選択中の版が `organization_variant_memberships`（ACTIVE）に存在するか検証。
   - 所属していれば active に採用。
   - 所属していなければ **is_default の版へフォールバック**（エラーにしない）。
4. **ADMIN**: 任意の版を選択可（無指定なら横断）。

> クライアントが申告した版を鵜呑みにしない。Cookie書き換えだけで他版が見える穴を作らないこと。

### 4.3 スコープ適用が必要なAPI一覧

| API | 適用内容 |
|---|---|
| `GET /api/supporter/dashboard` | `cases.variant_code = active` を追加 |
| `GET/PATCH /api/supporter/cases/[id]` 系 | 案件の版 ≠ active なら 404/403 |
| `POST /api/supporter/cases/[id]/offer` | 同上 |
| `GET/POST /api/messages` | 案件経由のため案件の版チェックに含まれる |
| `POST /api/sos/cases` | サーバー側で `variant_code = appUser.variant_code` を焼き込み |
| `GET /api/sos/cases` ほかSOS系 | 所有者チェックで実質スコープ済み（変更最小） |
| `GET /api/public/supporters` 系 | 入口の版に所属する団体のみ返す |
| `GET /api/public/featured-supporters` | 同上（おすすめは版ごとに選定） |
| 管理系 `/api/admin/*` | 版フィルタパラメータ追加（任意・無指定は横断） |

### 4.4 前提となる先行修正（コードレビュー指摘との接続）

版対応の前に以下を済ませる（`docs/code_review_improvements_2026-06-12.md` 参照）:

1. **#1 `POST /api/sos/cases` のマスアサインメント修正** — variant_code をクライアントに
   注入されない前提条件。許可カラムのホワイトリスト化。
2. **#3 `requireActiveAppUser()` への統一** — 版解決を一点集中させる土台。
   26ルートのコピペ認証のままでは版スコープの実装漏れが必ず出る。

---

## 5. 皮（スキン）の構造 — モックをサクッと作るための仕組み

### 5.1 バリアント設定ファイル

版ごとの違いをすべて1つの設定オブジェクトに集約する。**新しい版のモック＝このファイルを1つ書くだけ**。

```
src/variants/
├── index.ts          # レジストリ（code → config の解決、ホスト名 → code の解決）
├── types.ts          # VariantConfig 型定義
├── main/
│   ├── config.ts     # 全国版（現行の値をここへ移す）
│   └── questions.ts  # 現行の QA_QUESTIONS をここへ外出し
├── kanagawa/
│   ├── config.ts
│   └── questions.ts
└── senior/
    ├── config.ts
    └── questions.ts
```

```typescript
// src/variants/types.ts（案）
export type VariantConfig = {
  code: string                      // 'kanagawa' — variants.code と一致
  name: string                      // '神奈川県版'
  hosts: string[]                   // ['kanagawa.samasama.site']

  branding: {
    siteTitle: string               // <title> / OGP
    headerBadge: string | null      // ヘッダーに出す「神奈川県版」表示
    logo: string                    // /brand/ 配下のパス
    ogImage: string
  }

  theme: {
    cssClass: string                // <html> に付与（'variant-kanagawa'）
                                    // globals.css 側で --primary 等を上書き
    accessibilityPreset?: 'default' | 'senior'
                                    // senior: root font-size 拡大・高コントラスト
  }

  copy: {                           // 版ごとに差し替える文言（必要分のみ上書き）
    heroTitle: string
    heroDescription: string
    // …デフォルト(main)へのフォールバック付きで参照する
  }

  intake: {
    questionnaireId: string         // 'kanagawa-v1' — intake_qna に記録
    questions: QaQuestion[]         // 版専用の設問セット
    regionCountry: string           // 'JP' 等（現行ハードコードの置き換え）
    defaultRegionCode?: string      // '14'（神奈川）等
  }

  features?: {                      // 将来の版別機能フラグ
    [key: string]: boolean
  }
}

export type QaQuestion = {
  id: number
  question: string
  options: Array<{
    id: string                      // 'q4_2' — 集計キー（文言と分離）
    text: string
    urgent?: boolean                // 緊急度判定フラグ（文字列一致を廃止）
  }>
  otherPlaceholder: string
}
```

### 5.2 設問セットの扱い（重要な実装変更）

現行 `src/app/sos/hearing/page.tsx` からの変更点:

1. `QA_QUESTIONS` 定数をページから `src/variants/<code>/questions.ts` へ外出し。
   描画ロジックは既に配列を回すだけの作りなので、**画面コンポーネントは共通のまま**。
2. 緊急度判定の `selectedAnswers[4]?.has('死にたいと思うことがある')`（文字列一致）を
   廃止し、選択肢の `urgent: true` フラグで判定する。
   **版ごとに言い回しを変えても緊急アラートが壊れない**ようにするため。必須。
3. 回答保存時、`intake_qna` に版とバージョンを記録する（DBスキーマ変更不要・jsonb内）:

```json
{
  "questionnaire": "kanagawa-v1",
  "variant": "kanagawa",
  "qa": {
    "1": [{ "id": "q1_2", "text": "安全に暮らせる住まいがない" }]
  }
}
```

   選択肢IDを併記することで、版間で文言が違っても横断集計できる。
4. `region_country: 'ID'` のハードコード（hearing/page.tsx:280）を
   `config.intake.regionCountry` からの注入に置き換える。

### 5.3 入口URLと版の解決

- **方式: サブドメイン推奨**（`kanagawa.samasama.site`）。チラシ・行政案内で
  「このURL」と言い切れる。Vercel にドメイン追加 + `src/proxy.ts` でホスト名 → 版コード判定。
- パス方式（`/kanagawa/...`）も `proxy.ts` の rewrite で可能。設定は楽だが別感が弱い。
- 解決した版コードはリクエストヘッダ（例: `x-variant`）でアプリへ引き渡し、
  ルートレイアウトがテーマクラス・metadata・ヘッダーバッジに反映する。

### 5.4 テーマ（老人版の要件）

- 配色: `globals.css` は shadcn 方式のCSS変数（`--primary` 等）で既にトークン化済み。
  `html.variant-kanagawa { --primary: …; }` の上書きブロックを版ごとに追加するだけ。
- 老人版の文字拡大: Tailwind のサイズは rem 基準のため、
  `html.a11y-senior { font-size: 112.5%; }` で**全画面が一括拡大**できる
  （個別の `text-sm` 797箇所を書き換える必要なし）。レイアウト崩れの確認は必要。
- 高コントラスト・行間も同じCSS変数ブロックで対応。

### 5.5 新しい版を追加する手順（モック作成チェックリスト）

カスタマイズ要件が来たら、以下だけで動くモックが立つ状態を目指す:

```
□ 1. src/variants/<code>/config.ts を作成（main からコピーして差分だけ変更）
□ 2. src/variants/<code>/questions.ts を作成（設問が同じなら main を re-export）
□ 3. src/variants/index.ts のレジストリに登録
□ 4. globals.css に .variant-<code> のテーマ変数ブロックを追加
□ 5. variants テーブルに1行 INSERT（Staging）
□ 6. Vercel にサブドメイン追加（モック段階では ?variant=<code> 等の
     プレビュー用クエリで代替可にしておくと、ドメインなしでデモできる）
```

→ ロジック・API・DB構造・画面コンポーネントには一切手を入れない。
ここに手を入れないと作れない要件が出たら、それは「皮」ではないので個別に設計する。

---

## 6. サポーターの版切替UX

1. ログイン → `is_default` の版で表示。
2. ヘッダーに現在の版を常時表示（例:「神奈川県版」バッジ）。所属が複数あれば切替メニュー。
3. 切替時: Cookie の選択版を更新 → **ページ全体をリロード**。
   - 理由: 各画面はマウント時fetchの大型クライアントコンポーネントのため、
     状態のホットスワップは前の版のデータ残留バグを招く。最初はリロードが安全。
4. 切替後はダッシュボード・案件一覧・テーマ・ヘッダーがすべて新しい版で取得される。
5. 版をまたぐ深いリンク（全国版モード中に神奈川版の案件URLを開く）:
   - **推奨**: 所属があれば自動でその版に切り替えて表示（ヘッダーの版表示が前提）。
   - 所属がなければ 404 相当（存在を漏らさない）。

### 入口とアカウントの動線

| ケース | 挙動 |
|---|---|
| 所属外の版の入口からログイン | ログイン成功 → 本人のデフォルト版へリダイレクト（締め出さない） |
| 登録済みメールで別版に新規登録 | 「登録済みです。ログインしてください」→ ログイン後「この版への参加は運営にお問い合わせください」 |
| サポーターの版追加 | 当面は管理者が管理画面から membership 行を付与。将来: 申請フロー |
| SOSユーザー | 登録入口の版で固定。切替UIなし |

---

## 7. 運営機能（管理画面への追加）

1. **版フィルタ** — 管理ダッシュボードの案件・ユーザー一覧に版の絞り込みを追加（無指定＝横断）。
2. **案件の版移動** — 誤入口の相談を適切な版へ移す（`cases.variant_code` 更新＋システムメッセージ記録）。
   完全分離の硬さを補う逃がし弁。「最後のセーフティネット」思想（AGENTS.md）との整合に必須。
3. **団体の版所属管理** — membership の付与・停止・デフォルト変更。
4. **版マスタ管理** — variants 行の追加・無効化（画面は後回し可。当面SQLでも運用可能）。

---

## 8. 実装ロードマップ

| フェーズ | 内容 | 依存 |
|---|---|---|
| 0. 先行修正 | sos/cases マスアサインメント修正・requireActiveAppUser統一・admin/layout配置修正 | なし（コードレビュー指摘） |
| 1. 皮の土台 | QA設問の外出し＋urgentフラグ化、バリアント設定の仕組み、proxy.ts の版判定、テーマ変数ブロック | 0 |
| 2. 仕切りの土台 | migration作成（variants / variant_code / memberships）→ Staging適用、auth.ts の版解決、API版スコープ適用 | 0, 1 |
| 3. 切替UX | ヘッダー版表示・切替メニュー・Cookie・リロード、入口別ログイン/登録動線 | 2 |
| 4. 運営機能 | 版フィルタ・案件版移動・所属管理 | 2 |
| 5. 1号版リリース | 神奈川県版 or 老人版の config 作成・サブドメイン設定・Stagingテスト | 1〜4 |

- フェーズ1まででも「見た目・設問が違うモック」は出せる（仕切りなし・デモ用）。
- フェーズ2の本番適用は、進行中の**サポーター団体DB刷新（D案）の本番適用が完了してから**
  着手する（migration の衝突回避。AGENTS.md の優先順位とも整合）。
- 指標管理（§3.4）は SDGs分類システム（AGENTS.md 機能4）の `sdg_indicators` 実装と
  同時期に行う。フェーズ2で variants マスタさえ入っていれば、機能4の migration に
  `owner_variant_code` / `variant_indicator_settings` を最初から含められる（後付け改修不要）。

---

## 9. 未決事項

| # | 論点 | 暫定方針 |
|---|---|---|
| 1 | サブドメイン or パス方式の最終決定 | サブドメイン推奨（要: ドメイン・Vercel設定の確認） |
| 2 | 版ごとの「顔」（表示名・bio の版別上書き）をやるか | フェーズ外。必要になったら membership にカラム追加 |
| 3 | 他版の新着通知（神奈川版作業中に全国版のオファー通知） | フェーズ外。件数APIのみ横断にする例外として将来検討 |
| 4 | サポーターの版参加申請フロー | 当面は運営付与。需要が出たら設計 |
| 5 | 版ごとのおすすめサポーター・公開統計の扱い | featured / public/stats を版スコープにする（フェーズ2に含めるか要判断） |
| 6 | 老人版の対象定義・入口の案内方法 | サービス設計側の論点（神奈川在住高齢者の入口選択問題を含む） |

---

## 10. 関連ドキュメント

- `AGENTS.md` — 作業ルール・本番保護ルール・D案の現在地
- `docs/code_review_improvements_2026-06-12.md` — 先行修正の詳細（特に #1, #3, #4）
- `docs/production_supporter_db_refresh_runbook.md` — D案本番適用（フェーズ2の前提）
