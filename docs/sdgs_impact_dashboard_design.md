# SDGsカウント・インパクトダッシュボード 実装設計書

作成日: 2026-07-06
ステータス: ドラフト（実装前・migration未作成）
前提調査: `docs/sdgs_counting_investigation.md`
正本方針: `AGENTS.md` 機能4・機能5 / バリアント設計 §3.4 / i18n設計 §5.7-5.8

---

## 0. 方針サマリ（2026-07-06 ユーザー指示を反映）

1. **カウントは公式のSDGs指標体系に沿って行う**: 17ゴール → 169ターゲット → 指標
   （国連指標は231〜248件と数え方が揺れる。本システムのIDは公式指標ID「1.3.1」形式に揃え、
   **定義文だけを個人向けに独自整備**する = AGENTS.md「個人向けGI」方式。
   これにより行政報告・助成金審査で公式フレームワークにそのまま対応づけられる）。
2. **UIは17ゴールが入口であり、それ自体が完結した画面**。
   興味がない人・ライトユーザーは17タイルを見て満足して終われる。
   詳しく見たい人だけがタイル→ターゲット→GI→案件一覧へドリルダウンする（段階的開示）。
3. GIは細かすぎるため一覧の主役にしない。**デフォルト表示は常にゴールレベル**。

---

## 1. データモデル（migration ドラフト）

AGENTS.md 機能4のドラフトを、バリアント（§3.4）と多言語（ラベルjsonb化）を織り込んで確定する。

```sql
-- ─── ターゲットマスタ（169件・表示用） ──────────────────────
CREATE TABLE sdg_targets (
  id          text PRIMARY KEY,          -- '1.3'（公式ターゲットID）
  goal_id     integer NOT NULL CHECK (goal_id BETWEEN 1 AND 17),
  labels      jsonb NOT NULL,            -- {"ja": "社会保護制度の実施", ...} 当面jaのみ
  sort_order  integer NOT NULL DEFAULT 0
);

-- ─── 個人向けGI定義マスタ ───────────────────────────────────
CREATE TABLE sdg_indicators (
  id                 text PRIMARY KEY,   -- '1.3.1'（公式指標ID）
  goal_id            integer NOT NULL CHECK (goal_id BETWEEN 1 AND 17),
  target_id          text NOT NULL REFERENCES sdg_targets(id),
  labels             jsonb NOT NULL,     -- {"ja": "生活保護など公的支援につながった"}
  definition_ja      text NOT NULL,      -- AI②のプロンプト入力（個人向け定義文・日本語のみ）
  owner_variant_code text NULL,          -- NULL=共通GI / 値=版独自指標（バリアント§3.4）
  is_active          boolean NOT NULL DEFAULT true,
  sort_order         integer NOT NULL DEFAULT 0,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ─── 分類結果（正式カウントの源泉） ─────────────────────────
CREATE TABLE case_sdg_classifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             uuid NOT NULL REFERENCES cases(id) UNIQUE,  -- 1案件1行（最新のみ保持）
  goal_ids            integer[] NOT NULL,   -- 該当ゴール（複数可）
  indicator_ids       text[] NOT NULL,      -- 該当GI（Top5まで・スコア0.5未満除外）
  confidence_scores   jsonb,                -- {"1.3.1": 0.82, ...}
  ai_reasoning        jsonb,
  is_manual_review    boolean NOT NULL DEFAULT false,
  supporter_confirmed boolean NOT NULL DEFAULT false,
  is_effective        boolean NOT NULL DEFAULT false,  -- RESOLVED確定でtrue（カウント対象フラグ）
  classified_at       timestamptz NOT NULL DEFAULT now(),
  confirmed_at        timestamptz
);

-- 集計用インデックス（配列のunnest集計・案件規模なら十分高速）
CREATE INDEX idx_csc_goal_ids ON case_sdg_classifications USING GIN (goal_ids);
CREATE INDEX idx_csc_indicator_ids ON case_sdg_classifications USING GIN (indicator_ids);
CREATE INDEX idx_csc_effective ON case_sdg_classifications (is_effective) WHERE is_effective;

-- バリアント別の利用設定（§3.4どおり・variants導入後に有効化）
-- CREATE TABLE variant_indicator_settings ( ... );  -- variant Phase 2 と同梱

-- 全テーブル ENABLE ROW LEVEL SECURITY（service_role経由APIのみ）
```

設計判断:
- **`is_effective` フラグを追加**（AGENTS.mdドラフトへの追加提案）。
  「SOS承認 or 自動解決 → 有効化 / SOS拒否 → 破棄 / CLOSED → 対象外」の状態遷移を
  1フラグで表現し、集計クエリは常に `WHERE is_effective` だけで済む。
- `labels` は jsonb（当面 `{"ja": ...}` のみ。多言語化してもmigration不要）。
- `definition_ja` は日本語のみ。**外国語案件はPhase 2の日本語訳
  （description_free_ja / translated_content）を分類入力に使う**ため、定義文の多言語整備は不要。
- ゴールのラベル・色はDBに持たない（既に `messages/*/sdgs.json` に6言語、色は `SDG_COLORS`）。

## 2. カウント規則（AGENTS.md確定分の実装仕様）

```
ゴール別件数   = SELECT goal, COUNT(*) FROM (unnest(goal_ids)) WHERE is_effective
                 → 同一案件・同一ゴールは goal_ids 内で重複しないため自然に「ゴール1件」
ターゲット別   = indicator_ids から導出（indicator '1.3.1' → target '1.3'）。
                 同一案件が同一ターゲットの複数GIに該当 → ターゲットレベルでは1件（DISTINCT case）
GI別件数       = unnest(indicator_ids) の件数
案件一覧       = indicator_ids @> ARRAY[:id] の案件（最深部のみ 自動完了/ユーザー評価あり を区別表示）
合計の注釈     = 全レベルで「※1つの相談が複数の項目に貢献する場合があります」を必ず表示
```

- 集計はオンザフライ（GINインデックス＋案件数規模なら十分）。
  将来遅くなったら夜間バッチで `sdg_goal_counts` キャッシュテーブルに移行（APIの形は不変）。

## 3. API設計

すべて service_role 経由・`requireActiveAppUser()`。スコープは2種:
**admin=全件 / supporter=自団体が関与（ACCEPTED）した案件のみ**。

| エンドポイント | 返すもの |
|---|---|
| `GET /api/impact/summary` | 17ゴール分の `{goal, count}` + 総案件数（注釈計算用）。**L1画面はこれ1本で完結** |
| `GET /api/impact/goals/[goalId]` | 配下ターゲットの `{target_id, label, count}` |
| `GET /api/impact/targets/[targetId]` | 配下GIの `{indicator_id, label, count}` |
| `GET /api/impact/indicators/[indicatorId]/cases` | 該当案件の一覧（タイトル=ja正本・解決日・自動完了/評価ありの別） |

- クエリパラメータ `scope=admin|mine`（roleで強制）。将来 `variant=` を追加（横断=無指定）。
- 暫定版（§6）は summary のみ `source=interim` で先行提供できる。

## 4. UI/UX設計（17を入口とする段階的開示）

### L1: 17ゴールタイル（デフォルト・これだけで完結する画面）

```
┌─────────────────────────────────────────────┐
│ 解決した相談 128件 が貢献したSDGsゴール         │
│ ※1つの相談が複数のゴールに貢献する場合があります │
├────┬────┬────┬────┬────┬────┐
│ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │  ← 公式カラー・ゴール番号・
│貧困 │飢餓 │健康 │教育 │ジェ │水  │     短縮名（sdgs.goalShort）
│ 24 │ 18 │ 41 │ 12 │  7 │  3 │  ← 件数（0件はグレーアウト）
├────┼────┼────┼────┼────┼────┤
│ …17まで。タイルタップ/クリックで L2 へ          │
└─────────────────────────────────────────────┘
```

- 件数降順ではなく**ゴール番号順**（SDGsホイールとしての一覧性・毎回同じ位置）。
- 0件ゴールも薄色で表示（「全17ゴールを見ている」体験を崩さない）。
- ライトユーザーはここで終了。**L1に詳細情報を混ぜない**。

### L2〜L4: ドリルダウン（興味がある人だけ）

```
L1 タイル選択
 └ L2: ゴールNのターゲット一覧（該当のあるものを上に、0件は折りたたみ「すべて表示」）
     └ L3: ターゲット配下のGI一覧（個人向けラベルで表示・件数付き）
         └ L4: 案件一覧（🤖自動完了 / 🌟ユーザー評価あり の区別は最深部のみ）
```

- パンくず: `SDGs > ゴール3 すべての人に健康と福祉を > 3.8 > GI一覧`。
- 各レベルの合計は上位と一致しない（複数ヒット）→ **全レベルに注釈を常設**。
- ターゲット・GIの件数バーは同レベル内の相対値（最大値=100%）で表示し、比較を直感的に。

### 配置

| 画面 | スコープ | 備考 |
|---|---|---|
| 管理ダッシュボード新タブ「インパクト」 | 全件 | 行政報告・運営把握 |
| サポーターダッシュボード新タブ | 自団体 | 活動実績。L1の文言は「あなたの団体が貢献したゴール」 |
| インパクトレポートB（公開・将来） | 全件 | 別ページ。多言語はこのときラベルjsonbに追記 |

- 月次推移はコード保持のみ・非表示（AGENTS.md方針どおり）。

## 5. 分類フロー（機能4・データを生む側）

```
サポーター「解決済みにする」クリック
  ↓ AI①: 相談文+チャット履歴（外国語案件は日本語訳側）→ 17ゴール候補
  ↓ サポーターがゴールを確認・修正（モーダル・チェックボックス）
  ↓ AI②: 選択ゴール配下のGI定義文（definition_ja）→ Top5（スコア0.5未満除外）
  ↓ サポーターが最終確認 → case_sdg_classifications へ保存（is_effective=false）
  ↓ SOS承認 or 14日自動解決 → is_effective=true（カウント開始）
    SOS拒否 → 行削除（破棄）
```

- AI①は投稿時の `ai_sdg_suggestion.sdgs_goals` を初期値として提示（サポーターの手間削減）。
- gemini呼び出しは classifySDGs / translateText と同じパターン（`src/lib/gemini.ts` に追加）。
- 夜間バッチ: 分類エラーの再処理（`/api/cron/retry-translations` と同型でOK）。

## 6. 段階導入（推奨ロードマップ）

| Step | 内容 | 規模 | 依存 |
|---|---|---|---|
| **0. 暫定カウント（クイックウィン）** | `ai_sdg_suggestion.sdgs_goals`（投稿時AI）で L1タイルのみ先行。「暫定分類」注釈付き | 1日 | なし。**今すぐ可能** |
| 1. マスタ基盤 | sdg_targets + sdg_indicators + classifications の migration・シード投入経路 | 1〜2日 | GI定義文（§7） |
| 2. 分類フロー | 解決時AI2段階+サポーター確認UI+is_effective遷移 | 3〜5日 | 1 |
| 3. ドリルダウン | L2〜L4 + サポータースコープ | 3〜5日 | 2 |
| 4. バッチ・公開レポート | 夜間再処理、レポートB | 各1〜3日 | 2〜3 |

- Step 0 の画面（L1タイル）は Step 3 でデータソースを差し替えるだけ。UI投資は無駄にならない。
- AGENTS.md の優先順位（D案本番適用後）と、i18n本番反映の順序は着手時に要調整。

## 7. GI定義文の整備プラン（最大のブロッカーへの対案）

対象規模: 17ゴール × 20〜40件 ≒ **300〜500件**の個人向け定義文（日本語のみ）。

提案ワークフロー（AI下書き＋人間レビュー）:
```
1. 公式指標リスト（総務省仮訳）から指標ID・原文を整理（機械的）
2. Geminiで「個人の相談文脈向け」定義文を一括下書き
   例) 1.3.1 原文「社会保護制度によってカバーされる人口の割合…」
       → 個人向け「生活保護・年金・手当などの公的支援制度につながった、
          または利用できるようになった」
3. 運営（SDGs×現場知識）がレビュー・修正 ← ここだけ人間必須
4. seed（src/data/sdgs/indicators_seed.json）に確定版を投入
```
- 下書きは1〜2日で全件生成可能。レビューの体制・所要が実質の律速。
- **全指標を一度に揃える必要はない**: 相談が実際に発生しやすいゴール
  （1貧困・3健康・4教育・8労働・10不平等・16平和あたり）から優先整備し、
  未整備ゴールはAI②をスキップして「ゴールのみ分類」で運用開始できる
  （ゴールレベルのカウントは全ゴールで最初から機能する）。

## 8. 未決事項

| # | 論点 | 暫定方針 |
|---|---|---|
| 1 | GI定義文レビューの体制（誰が・いつ） | AI下書き→運営レビュー（§7）。優先ゴールから段階整備 |
| 2 | Step 0（暫定カウント）を先行するか | 推奨: 先行。1日でL1が動き、UI/UXの検証が早くできる |
| 3 | 着手タイミング | D案本番適用・i18n本番反映との順序を運用と調整 |
| 4 | サポータースコープの定義 | 「ACCEPTEDオファーを持つ案件」を関与とみなす（resolved_countと同じ定義） |
| 5 | 指標の総数の数え方（231/234/248） | IDは公式に従い、収録数は「個人向けに整備した件数」を正とする（全指標の網羅を目標にしない） |
