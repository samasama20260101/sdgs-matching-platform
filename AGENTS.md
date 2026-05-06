# AGENTS.md — 明日もsamasama | SDGs Match

Codexがこのプロジェクトで作業する際に必ず参照するドキュメント。

---

## プロジェクト概要

**サービス名**: 明日もsamasama | SDGs MATCH
**運営**: 合同会社ｓａｍａｓａｍａ
**目的**: 社会的困難を抱えるSOSユーザーと、NPO・行政・企業（サポーター）をAIでマッチングするプラットフォーム
**対象地域**: 日本・インドネシア（グローバル展開を視野に）
**未成年定義**: 18歳未満（SDGs/国連子どもの権利条約 CRC基準）

### サービスの思想・意図（重要）

- **SDGsは「サービスの言語」であってユーザーの言語ではない**。SOSユーザーにSDGsを意識させてはいけない。分類はAIが裏で行い、ユーザーはただ「助けてほしい」と書くだけでよい。
- **サポーター側にSDGsを前面に出すことで注目を集め、より多くの人が助かる**という設計思想。
- 行政・NPO・企業が混在する理由：行政は「制度の枠」でしか動けない。NPOはその枠の外を救う。両方がいることに意味がある。
- **最後のセーフティネット**として運営への導線を常に用意する。何度マッチングが失敗しても運営に繋がれる設計が必要。

---

## 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 16.1.5（App Router） |
| 言語 | TypeScript |
| DB / Auth | Supabase（PostgreSQL + GoTrue） |
| ホスティング | Vercel Pro |
| AI | Google Gemini AI（SDGsタグ付け） |
| アナリティクス | Google Analytics G-8S5GP8P7EZ |

---

## 環境情報

### Supabase
| 環境 | Project ID | URL |
|---|---|---|
| Staging | fzawgdmqewmwdqjsqjwt | https://fzawgdmqewmwdqjsqjwt.supabase.co |
| Production | dqiqwclgzxhjxpotflvz | https://dqiqwclgzxhjxpotflvz.supabase.co |

### Vercel
| 環境 | URL |
|---|---|
| Staging | https://sdgs-matching-platform-git-dev-samasama.vercel.app |
| Production | https://sdgs-matching-platform-taupe.vercel.app / app.samasama.site |

### GitHub
- Org: samasama20260101
- リポジトリ: https://github.com/samasama20260101/sdgs-matching-platform
- devブランチ: 開発用（Stagingに自動デプロイ）
- mainブランチ: 本番用（PR必須・直接pushは不可）

### ローカル開発
- OS: Ubuntu + VSCode
- パス: ~/samasama/sdgs-matching-platform
- 環境変数ファイル: .env.local

### 管理者アカウント（Staging）
- メール: x25660@yahoo.co.jp
- 管理者ログインURL: /admin/login

---

## ユーザーロール

| ロール | 説明 | ダッシュボード |
|---|---|---|
| SOS | 相談者（支援を求める人） | /sos/dashboard |
| SUPPORTER | 支援者（NPO・行政・企業） | /supporter/dashboard |
| ADMIN | 管理者 | /admin/dashboard |

---

## 重要な技術的知見（必読）

### 1. RLSバイパスパターン
サーバーサイドAPIルートは必ず supabaseAdmin（service_role key）を使う。
クライアントの anon key は RLS により auth.uid() が NULL になりアクセス拒否される。

### 2. テストユーザー作成
SQL直接挿入では GoTrue の auth.identities が作られずログインできない。
必ず supabaseAdmin.auth.admin.createUser() を使うこと。

削除順序（外部キー制約）: messages → offers → cases → public.users → auth.users

### 3. Next.js 16 の params は Promise
```typescript
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}
```

### 4. 地域クエリ
regions テーブルへの FK JOIN は使わない。必ず2ステップクエリで取得する。

### 5. use client ディレクティブ
ファイルの最初の行（コメントより後、importより前）に記述すること。

### 6. Supabaseのbcryptハッシュ形式
GoTrue は $2a$ 形式を期待する。Admin APIを使うこと。

---

## ブランチ運用

機能開発 → devブランチ → Staging自動デプロイ → テスト確認 → PR → mainマージ → Production

- devへは直接 push 可
- mainへは PR 必須（ブランチ保護ルール）
- PRはGitHub画面から作成: https://github.com/samasama20260101/sdgs-matching-platform/compare/main...dev

## 環境操作・本番保護ルール（最重要）

このプロジェクトは Git / Vercel / Supabase DB を **開発環境と本番環境で分離**している。

- 通常の開発作業は **devブランチ + Staging Supabase** で行う。
- Production Supabase への変更操作は、ユーザーの明示許可なしに実行しない。
- Production に対して `db push` / SQL実行 / データ更新 / RLS変更 / Auth操作 / 環境変数変更を勝手に行わない。
- DB変更はまず migration SQL を作成し、内容・影響範囲・rollback方針を確認してから Staging に適用する。
- Stagingで動作確認後、本番適用前に必ず以下を確認する。
  - 対象 project ref
  - 実行SQL
  - 影響を受けるテーブル・ユーザー体験
  - rollback可能性
- ユーザー情報、相談内容、メッセージ、認証情報、支援履歴に影響し得る操作は特に慎重に扱う。
- `supabase link` は原則 Staging に向ける。本番DB操作が必要な場合は、都度ユーザー確認を取る。
- Production Supabase の project ref は、作業直前に Supabase Dashboard / Vercel 環境変数 / CLI表示で必ず再確認する。

---

## DBスキーマ補足（Staging・Production両方に適用済み）

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false;
ALTER TABLE supporter_badges ADD CONSTRAINT supporter_badges_unique UNIQUE (case_id, supporter_user_id, badge_key);
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
```

---

## ケースのステータス遷移（重要）

```
OPEN → MATCHED → RESOLVED（カウント対象）
         ↓
      CLOSED（14日無活動・カウント対象外）
      CANCELLED
```

⚠️ IN_PROGRESS は廃止済み。

---

## サポーター承認上限

```typescript
// src/lib/constants/sdgs.ts
export const MAX_SUPPORTERS_PER_CASE = 2
```

---

## Cron ジョブ

毎日JST午前2時。vercel.json に設定済み。

| 処理 | 条件 | 結果 |
|---|---|---|
| 処理1 | supporter_resolved_at から14日経過 | RESOLVED |
| 処理2 | MATCHED のまま最終メッセージから14日無活動 | CLOSED |

---

## ローンチ前必須タスク

- [x] Production Supabase の Email Confirm 有効化
- [x] DEV_PASSWORD を Vercel の Production 環境変数から除外
- [x] Production の管理者ユーザー登録
- [ ] favicon・apple-touch-icon・OGP画像の差し替え（public/brand/ に素材あり）
- [ ] Google Analytics 動作確認

---

---

# 7月末エンハンス設計（設計確定・実装待ち）

以下は次のメジャーリリースに向けた設計。**実装前に必ずこのセクションを読むこと。**

## 実装優先順位

| 優先度 | 機能 |
|---|---|
| 1 | サポーター団体DB刷新（D案）← これが全ての前提 |
| 2 | 地域フィルター・提案 |
| 3 | SDGs分類システム（GI）← D案完了後 |
| 4 | インパクトダッシュボード ← 分類システム完了後 |
| 5 | SOS→サポーター直接アクセス ← 意思決定が先決 |

---

## 機能1：サポーター団体アカウントのDB刷新（D案）【最優先】

### 課題
現状のサポーターはSOSユーザーと同じ「人」としてDB設計されている。担当者が退職するとアカウントが利用不能になる。

### 設計方針（D案）

```
organizations テーブル（新設）← 団体エンティティ
  id, name, supporter_type, bio, service_areas ...

users テーブル（変更）← 個人のログイン情報のみ
  id, organization_id（FK）, role（ADMIN / MEMBER）
```

### 影響範囲（広大・注意）
- cases / offers / messages / supporter_service_areas / ratings など全テーブルの外部キー変更
- get-role API のロジック全面見直し
- フロント全体の userData.id 参照箇所の修正
- parent_supporter_id / member_approved_at カラム廃止
- Staging・Production 両方にマイグレーション必要

### ⚠️ サブアカウントについて
devブランチからサブアカウント機能（parent_supporter_id ベース）は意図的に削除済み。
D案実装後に正式なサブアカウントとして再実装する。parent_supporter_id アプローチは拡張禁止。

### 未解決論点
- オーナーは1人か複数か
- role の細分化（ADMIN / MEMBER か、さらに細かくするか）
- 団体削除時の cases / messages の扱い

---

## 機能2：地域情報を活用した相互提案・フィルター

### 実装方針
- 地域が入力されている場合、同地域を優先表示・提案
- 簡単にフィルターできるUIを用意

### 見せ方
SOS側（近くの団体を探す）とサポーター側（対応エリアの案件を探す）で見せ方は別設計。

---

## 機能3：SOS → サポーターへの直接アクセス機能

### 確定フロー

```
SOS相談投稿
  → AIが地域×SDGsでサポーターを提案
  → SOS側が1団体を選び声がけ（同時上限：現状1団体、将来3団体）
  → サポーターが承諾 → Matching成立
  → サポーターが辞退 → 理由を添えてSOSに通知 → 次の団体へ
```

既存のサポーター→SOS申し出フローは並存。Matching上限（2名）の枠は双方向から埋める。

### 声がけメッセージ
AIが相談内容から2〜3パターン生成 → SOSが選択 or 編集して送信。

### ⚠️ 最大の懸念：辞退体験の設計

| 案 | 内容 |
|---|---|
| サポーターの受付状況表示 | 🟢積極受付 / 🟡要相談 / 🔴対応困難 を事前表示 |
| 辞退時にAIが即提案 | 辞退直後に次の候補を提示 |
| 電話対応フローへの分岐 | まず電話で話を聞くルール（強制可能かが論点） |
| 3回辞退で運営アラート | 管理画面に通知し運営が介入 |

```
❌「辞退されました」
⭕「現在対応が難しい状況とのことです」
```

**⚠️ 辞退リスクが解消できない場合はこの機能自体を見送る可能性あり（要意思決定）**

---

## 機能4：SDGs分類システム（GIレベルへの解像度向上）

### 基本方針
- 232指標（原文）は国家統計用のため個人には使わない
- **個人向けGI定義**を独自整備して使用する
- 1案件が複数ゴール・GIに該当する場合はすべてカウント（複数ヒットOK）
- 同一案件が同一ゴールの複数GIに該当 → ゴールレベルでは1件としてカウント
- GIはTop5まで（関連度スコア0.5未満は除外）

### AI 2段階分類フロー

```
サポーターが「解決済みにする」を押す
  ↓
【AI ①】相談文 + メッセージ履歴 → 17ゴールから候補を抽出
  ↓
サポーターが確認・修正（ここでの修正がAI②の精度を上げる）
  ↓
【AI ②】選ばれたゴール配下のGIリスト（20〜40件）からTop5を抽出
  ↓
サポーターが最終確認・修正して完了確定
  ↓
SOS承認 or 放置自動完了 → RESOLVED → 分類データ有効化
SOS拒否 → 継続 → 分類データ破棄
CLOSED（無活動）→ 分類なし・カウント対象外
```

### 新設テーブル（2つ）

**sdg_indicators（個人向けGI定義）**
```sql
CREATE TABLE sdg_indicators (
  id            text PRIMARY KEY,    -- "1.3.1"
  goal_id       integer NOT NULL,
  target_id     text NOT NULL,       -- "1.3"
  label_ja      text NOT NULL,
  definition_ja text NOT NULL,       -- AIに渡す個人向け定義文
  definition_id text,                -- インドネシア語（将来）
  is_active     boolean DEFAULT true,
  sort_order    integer DEFAULT 0,
  updated_at    timestamptz DEFAULT now()
);
```

初期データは /src/data/sdgs/indicators_seed.json で管理しSupabaseにインポート。

**case_sdg_classifications（分類結果）**
```sql
CREATE TABLE case_sdg_classifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               uuid NOT NULL REFERENCES cases(id),
  goal_ids              integer[],
  indicator_ids         text[],
  confidence_scores     jsonb,
  ai_reasoning          jsonb,
  is_manual_review      boolean DEFAULT false,
  supporter_confirmed   boolean DEFAULT false,
  classified_at         timestamptz DEFAULT now(),
  confirmed_at          timestamptz
);
```

### バッチ処理（夜間・補完用）

```
実行時刻：毎日 JST 深夜2時
トリガー：Vercel Cron Jobs（初期）→ 案件数増加後にGitHub Actionsへ移行
処理方式：5件並列処理（Vercel Cronの300秒制限対策）
用途：エラー案件の再処理・ダッシュボード集計更新（メイン分類はリアルタイム）
```

---

## 機能5：インパクトダッシュボード

### ドリルダウン構造
```
17ゴール（タイル表示）
  ↓ クリック
169ターゲット（タイル表示）
  ↓ クリック
個人向けGI（タイル表示）
  ↓ クリック
個別案件一覧（自動完了 / ユーザー評価あり の区別は最深部のみ表示）
```

### 2種類のダッシュボード
| | 管理者 | サポーター |
|---|---|---|
| 対象 | 全案件 | 自分が関わった案件のみ |
| 用途 | 全体把握・行政報告 | 自団体の活動実績 |

### カウント注意
```
ゴールの合計件数 ≠ 実際の案件数
→ 注釈必須：「※1案件が複数ゴールに貢献する場合があります」
```

### 月次推移
**現在は非表示。将来実装のためコードのみ保持すること。**

### インパクトレポート公開
別途レポートページ（インパクトレポートB）として一般公開。行政・助成金審査・寄付者向け。

---

## 未解決・要意思決定の論点

1. **SOS→サポーター機能の辞退体験**：電話対応フローをサポーターへの強制ルールにできるか。解消できない場合は機能を見送る。
2. **GI定義文の初期整備**：誰が・どのように作成するか（SDGsと現場の両方の知識が必要）。
3. **organizations テーブルのオーナー設計**：1人か複数か。
4. **サポーター公開ページの写真・ロゴ**：Supabase Storage、設計済みだが未実装。

---

## 将来対応（7月末以降）

- AI対話型のSOS相談入力（Q1〜Q5をAIが裏で処理）
- スマホアプリ化
- 多言語対応（日本語⇔インドネシア語）
- 緊急度判定AI（管理者アラート）
- サポーター承認上限を2名→3名（MAX_SUPPORTERS_PER_CASE = 3 の1行変更のみ）
