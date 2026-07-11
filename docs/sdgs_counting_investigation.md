# SDGsカウント機能 調査メモ

作成日: 2026-07-06
目的: SDGsゴール/GI別のカウント（集計・可視化）機能の現状と、実装に向けた論点整理。
正本設計: `AGENTS.md` 機能4（SDGs分類システム）・機能5（インパクトダッシュボード）

---

## 1. 現状実装されているカウント（2026-07-06 調査）

| 集計 | 実装場所 | 内容 |
|---|---|---|
| 解決済み相談数（全体） | `/api/public/stats` | `cases.status = 'RESOLVED'` の件数。LPカウンターに表示 |
| 登録サポーター団体数 | 同上 | `organizations.status = 'ACTIVE'` |
| 活動都道府県数 | 同上 | `supporter_service_areas` のユニーク региона数（全国対応なら47） |
| ステータス別件数 | `/api/admin/stats` | OPEN / MATCHED / RESOLVED を全件フェッチ後にクライアント側filterで集計 |
| 団体別 解決件数・バッジ数 | `/api/public/supporters*` | 公開プロフィール・一覧の実績表示用 |

**SDGsゴール別のカウントは存在しない。**
`sdgs_goals` は `cases.ai_sdg_suggestion`（jsonb）内にのみあり、用途は表示バッジ（LP・一覧・詳細）だけ。集計・検索には一切使われていない。

## 2. 計画済みだが未着手のもの（AGENTS.md 機能4・5）

- `sdg_indicators`（個人向けGI定義マスタ）: **テーブル未作成**（Staging確認済み）
- `case_sdg_classifications`（正式分類結果）: **テーブル未作成**
- シードデータ `src/data/sdgs/indicators_seed.json`: **ディレクトリごと存在しない**
- AI 2段階分類フロー（解決時にゴール確認→GI Top5）: 未実装
- インパクトダッシュボード（17ゴール→169ターゲット→GI→案件のドリルダウン）: 未実装
- 夜間バッチ（エラー再処理・集計）: 未実装

### カウント規則（AGENTS.md で確定済み・実装時に厳守）

```
- 1案件が複数ゴール該当 → すべてカウント（複数ヒットOK）
- 同一案件が同一ゴールの複数GIに該当 → ゴールレベルでは1件
- GIはTop5まで（関連度スコア0.5未満は除外）
- RESOLVED のみカウント対象。CLOSED（14日無活動）は対象外
- SOS拒否 → 分類データ破棄
- 注釈必須:「※1案件が複数ゴールに貢献する場合があります」
```

## 3. 他設計との接続（実装前に押さえる点）

### 3.1 バリアント設計（docs/variant_architecture_design.md §3.4）
- `sdg_indicators.owner_variant_code`（NULL=共通GI）と `variant_indicator_settings` を
  **機能4のmigrationに最初から含める**（後付け改修を避ける合意済み）。

### 3.2 多言語対応（docs/i18n_multilingual_design.md）
- **カウント自体は goal_id / indicator_id ベースで言語非依存**。外国語案件も同じパイプラインで集計できる
  （Phase 0で導入した `qa_ids` と同じ「IDで集計・文言は表示時」の思想）。
- AGENTS.md のドラフトスキーマ `label_ja / definition_ja / definition_id` は列ベース多言語で、
  6言語化した現状と不整合。**推奨**:
  - GI表示ラベル: 当面 `label_ja` のみで開始してよい（GIを見るのはサポーター確認UI・
    管理/サポーターダッシュボード＝日本語運用。SOSユーザーにGIは見せない設計）。
    将来の多言語化に備え `labels jsonb`（`{"ja": "..."}` 形式）にしておくと migration 不要で拡張可。
  - `definition_*`（AIプロンプト入力）: **日本語のみでよい**。分類対象の相談文は
    Phase 2 の `description_free_ja` / `translated_content`（日本語訳）を入力に使えば、
    GI定義とプロンプトの言語が揃い、言語別の定義文整備が不要になる。
- 公開インパクトレポートB（将来）を多言語で出す場合のみ、ラベルの多言語が必要になる。

### 3.3 分類入力と Phase 2 の関係
AI①②に渡す「相談文＋メッセージ履歴」は、外国語案件では**日本語訳側**
（`description_free_ja` + `messages.translated_content`）を優先して使う。
原文でもGeminiは分類できるが、GI定義（ja）との突き合わせ精度と検証可能性で日本語入力が優位。

## 4. 実装ステップ案と規模感

| フェーズ | 内容 | 規模 | ブロッカー |
|---|---|---|---|
| A. 基盤 | migration（sdg_indicators + case_sdg_classifications + variant列 §3.4）、シード投入経路 | 1〜2日 | **GI定義文の整備**（AGENTS.md 未決事項#2:誰が・どう作るか） |
| B. 分類フロー | サポーター「解決済みにする」にAI①ゴール確認→AI② GI Top5→確定。SOS承認/自動解決で有効化・拒否で破棄 | 3〜5日 | A |
| C. ダッシュボード | 管理者（全件）/サポーター（自団体）のドリルダウン+注釈 | 3〜5日 | B |
| D. バッチ | 夜間再処理・集計キャッシュ（retry-translations と同じcronパターンが流用可能） | 1日 | B |

- AGENTS.md の優先順位では機能4は「D案本番適用後」（優先度3）。
- 最大のブロッカーは技術ではなく **個人向けGI定義文のコンテンツ整備**（169ターゲット配下、
  ゴールあたり20〜40件 → 全体で数百件の定義文。SDGs知識×現場知識が必要）。

## 5. クイックウィン（機能4を待たない暫定カウント）

正式分類（GI）を待たずに、**既にDBにある `ai_sdg_suggestion.sdgs_goals`（投稿時AI分類）**で
「暫定ゴール別カウント」は今すぐ出せる:

```
対象: cases.status = 'RESOLVED'（カウント規則に準拠、CLOSED除外）
集計: ai_sdg_suggestion->'sdgs_goals' を展開してゴール別に件数
表示: 管理ダッシュボードに17ゴールのタイル（機能5のミニ先行版）
注釈: 「※投稿時AIによる暫定分類です。1案件が複数ゴールに貢献する場合があります」
規模: 1日以内（API1本+管理画面1セクション）
```

正式分類（解決時確定・GI付き）が入ったら、このタイルのデータソースを
`case_sdg_classifications` に差し替えるだけで機能5へ育てられる。

## 6. 未決事項（着手前に決めるもの）

1. GI定義文を誰が・どう整備するか（AGENTS.md 未決事項#2 — 最大のブロッカー）
2. `sdg_indicators` のラベルを `label_ja` 列か `labels jsonb` か（推奨: jsonb）
3. クイックウィン（暫定ゴール別カウント）を先行実装するか
4. 着手タイミング（AGENTS.md では D案本番適用後。i18n本番反映との順序も要調整）
