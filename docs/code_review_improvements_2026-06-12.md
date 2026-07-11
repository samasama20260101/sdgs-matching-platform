# ソースコード改善点レビュー（2026-06-12）

`src/` / `lib/` 配下（約17,000行）を対象としたコードレビュー結果。
重要度順に「高（セキュリティ・バグ）」「中（堅牢性）」「低（品質・保守性）」で分類。
**本ドキュメントは指摘のみで、コードの修正は行っていない。**

> **対応状況（2026-06-12 再確認）**: #1, #2, #4, #5, #8, #9, #10, #11(エラー検知のみ・
> 非トランザクションのまま) は修正確認済み。#3 は主要8ルートまで統一進行中（残り約18ルート）。
> #7 は修正対象ルート内では汎用メッセージ化済み。未対応: #6（Cookie生シークレット）、
> #12（cron部分失敗）、#13〜（中期項目）。

---

## 重要度【高】セキュリティ・バグ

### 1. `POST /api/sos/cases` のマスアサインメント脆弱性

`src/app/api/sos/cases/route.ts:61-65`

```typescript
const { data: caseData, error: caseError } = await supabaseAdmin
    .from('cases')
    .insert([{ ...body, owner_user_id: userData.id }])
```

リクエストボディ全体をそのまま `cases` テーブルへ insert している。クライアントが
`status: 'RESOLVED'` や `supporter_resolved_at`、`resolved_at` など任意のカラムを
指定できてしまう（解決件数の偽装、ステータス遷移ルールの迂回が可能）。

- 許可カラムのホワイトリスト方式に変更する（`/api/profile` の `PERSONAL_PROFILE_FIELDS` と同様のパターン、または zod スキーマ）。
- 併せてこのルートには **ロールチェックがない**（SUPPORTER / ADMIN でもSOS案件を作成できる）、**`is_suspended` チェックがない**、**本文の長さ制限がない** 点も修正対象。

### 2. `POST /api/auth/signup` のトークン検証が任意

`src/app/api/auth/signup/route.ts:17-23`

```typescript
const bearerToken = getBearerToken(request)
if (bearerToken) {   // ← トークンがある場合のみ検証
```

Bearer トークンが**付いていなければ検証をスキップ**する実装になっている。
auth_user_id（UUID）とメールアドレスの組を知っていれば、第三者が他人の auth ユーザーに
紐づく `public.users` プロフィールを作成できる。email 一致チェックで緩和されてはいるが、
トークン必須（`if (!bearerToken) return 401`）にすべき。

### 3. 認証・認可ロジックの不統一（`requireActiveAppUser` 未使用が大多数）

AGENTS.md では「新規APIでは `src/lib/api/auth.ts` の `requireActiveAppUser()` を優先」と
定めているが、実際に使用しているのは **40ルート中2ルートのみ**
（`classify-sdgs`、`gemini/analyze`）。

- 26ルートが `getAuthUser` / `checkAdmin` / `verifyAdmin` などの名前で同じ処理をコピペ実装している。
- その結果、**`is_suspended` をチェックしているルートは7ルートだけ**。停止済みアカウントでも
  `/api/sos/cases`（GET/POST）、`/api/profile`、`/api/sos/offers/[id]` など大半のAPIを呼べる。
- 各ルートを `requireActiveAppUser()` へ段階的に統一することを推奨。ロール条件は
  `options.roles` で表現できる。

### 4. `src/app/admin/layout/page.tsx` のファイル配置ミス

中身は `AdminLayout`（layout コンポーネント + metadata）だが、パスが
`admin/layout/page.tsx` になっているため:

- 管理画面全体に共通レイアウト・`title: '管理画面 | SDGsマッチング'` が**適用されていない**。
- `/admin/layout` という無意味な公開ルートが生成されている。

`src/app/admin/layout.tsx` へ移動（リネーム）が必要。ファイル先頭のコメントも
`// src/app/admin/layout.tsx` となっており、移動し損ねたものと思われる。

### 5. `lib/gemini.ts`（旧版）と `src/lib/gemini.ts` の重複

ルート直下の `lib/gemini.ts` は旧バージョン（`server-only` なし・旧プロンプト・
旧レスポンス形式）。import しているコードは存在しない（全参照は `@/lib/gemini` =
`src/lib/gemini.ts`）。混乱と誤編集のもとなので削除すべき。

### 6. dev-auth / maintenance-bypass Cookie に生のシークレットを保存

- `src/app/api/dev-auth/route.ts:12` — `DEV_PASSWORD` そのものを Cookie 値として保存。
- `src/app/api/maintenance-bypass/route.ts:31` / `src/proxy.ts:13` — `MAINTENANCE_BYPASS_TOKEN` を Cookie に保存。

Cookie が漏れる＝シークレットが漏れる構造で、ローテーションも全ユーザー失効になる。
HMAC 署名付きトークンやハッシュ値の保存に変更するのが望ましい。
また `password !== devPassword` などの比較はタイミングセーフでない（`crypto.timingSafeEqual` 推奨・優先度は低）。
なお `dev-auth` Cookie には `sameSite` 指定がない点も追加すると良い。

### 7. DB エラーメッセージをそのままクライアントへ返している

`/api/contact`、`/api/messages`、`/api/sos/cases`、`/api/profile` など多数で
`NextResponse.json({ error: error.message }, { status: 500 })` としており、
PostgreSQL のエラー文（カラム名・制約名などスキーマ情報）が外部に漏れる。
ログには詳細を残しつつ、レスポンスは汎用メッセージ（「サーバーエラーが発生しました」）へ
統一する（`requireActiveAppUser` 系ルートは既にこの方針）。

---

## 重要度【中】堅牢性・データ整合性

### 8. `/api/contact`（未認証公開API）に長さ制限・レート制限がない

`src/app/api/contact/route.ts` は未認証で投稿でき、`message` / `name` / `email` 等に
文字数制限がなく、レート制限もない。スパム投稿・DB肥大化のリスク。
最低限の文字数上限（例: message 5,000字）と、IPベースの簡易レート制限
（Vercel の場合は Upstash 等）を検討。

### 9. メッセージ送信 `POST /api/messages` に本文の長さ制限がない

`src/app/api/messages/route.ts:110-117` — `content` は空チェックと
`__SYSTEM__` プレフィックス拒否のみ。上限（例: 5,000字）を追加すべき。

### 10. `/api/profile` の organizations 更新値が未サニタイズ

`sanitizeText()` は membership 系3フィールドにしか使われておらず、
`organization_name` / `bio` / `social_links` / `postal_code` などは
**型チェック・長さ制限なし**で `organizations` テーブルへ渡している
（`src/app/api/profile/route.ts:111-153`）。`social_links` はオブジェクト構造の検証もない。
文字列長・型・許可キーの検証を追加する。

### 11. `service_areas` の delete → insert がトランザクションでない

`src/app/api/profile/route.ts:156-187`

- 全削除後の insert が失敗すると活動地域データが**消失したまま**になる。
- さらに delete の戻り値（エラー）を確認していない（`await deleteQuery` のみ）。

Postgres 関数（RPC）化して1トランザクションで置換する、最低でも delete エラーの
チェックと insert 失敗時のリカバリ方針を入れる。

### 12. cron `auto-close-cases` が部分失敗でも 200 を返す

`src/app/api/cron/auto-close-cases/route.ts` — `updateError` / メッセージ insert 失敗時は
`console.error` のみで処理続行し、レスポンスは成功扱い。Vercel Cron の監視から
失敗が見えない。失敗件数をレスポンスに含める・1件でも失敗したら 500 を返す等の対応を推奨。
（補足: `alreadyResolvedIds.includes(...)` は O(n²)。件数増加時は `Set` へ。）

### 13. Gemini 応答のパースが脆弱（スキーマ検証なし）

`src/lib/gemini.ts` の3関数とも `text.match(/\{[\s\S]*\}/)` → `JSON.parse` のみで、

- `sdgs_goals` が 1〜17 の整数配列であることの検証がない（AIの出力をそのままDB/画面へ）。
- 依存に **zod が入っているのに未使用**。パース後のスキーマ検証に使うのが自然。
- Gemini には `responseMimeType: 'application/json'` + `responseSchema`（structured output）が
  あるため、正規表現抽出自体を不要にできる。

また、APIキー未設定時に固定のデモ応答を `success: true` で返す仕様は、本番で
キー設定が漏れた場合に「もっともらしい誤分類」が静かに流れる。サーバー起動時 or
レスポンスに `demo: true` フラグを付ける等、検知可能にすべき。

### 14. ステータス更新系の同時実行制御

`auto-close` と SOS/サポーター操作が同じ `cases.status` を更新するが、
`update ... in('id', ids)` に「現在も MATCHED であること」の条件がない
（取得→更新の間にユーザー操作が挟まると上書きする）。
`.eq('status', 'MATCHED')` を update 条件に含めるだけで楽観的に防げる。

---

## 重要度【低】コード品質・保守性

### 15. 未使用の依存パッケージ

`package.json` の dependencies のうち、`src/` / `lib/` から一切 import されていないもの:

| パッケージ | 状況 |
|---|---|
| `zod` | 未使用（→ 13. の入力検証に活用すべき） |
| `react-hook-form` / `@hookform/resolvers` | 未使用 |
| `next-intl` | 未使用（多言語対応は将来計画。使う時に入れ直せばよい） |
| `date-fns` | 未使用 |
| `dotenv` | `scripts/` のみ使用 → devDependencies へ |
| `autoprefixer` / `postcss` | ビルドツール → devDependencies へ |

削除またはdevDependenciesへの移動でインストール時間・監査対象を削減できる。

### 16. テストが1件もない

テストファイル・テストランナー・`test` スクリプトが存在しない。優先度の高い順に:

1. `src/lib/api/validation.ts` / `requireActiveAppUser` などの純粋ロジックのユニットテスト
2. 認可境界（他人の case にアクセスできない等）のAPIルートテスト
3. ケースのステータス遷移（OPEN→MATCHED→RESOLVED/CLOSED）

Vitest 導入が手軽。CI（GitHub Actions）で `lint` + `tsc --noEmit` + テストを回すことを推奨。

### 17. 巨大なクライアントコンポーネント

| ファイル | 行数 |
|---|---|
| `src/app/admin/dashboard/page.tsx` | 954 |
| `src/app/sos/result/[id]/page.tsx` | 868 |
| `src/app/supporter/members/page.tsx` | 677 |
| `src/app/supporter/case/[id]/page.tsx` | 656 |

データ取得・状態管理・UI が1ファイルに混在。タブ単位のコンポーネント分割と、
認証付き fetch の共通フック化（下記18）から着手すると効果が大きい。

### 18. 認証付き fetch の重複パターン

各ページで `supabase.auth.getSession()` → `fetch(url, { headers: { Authorization: ... } })`
が繰り返されている。`fetchWithAuth(url, options)` のような共通ユーティリティにまとめると、
セッション切れ時の扱い（リダイレクト等）も一元化できる。

### 19. APIレスポンス形式の不統一

- エラーメッセージが英語（`'Unauthorized'`）と日本語（`'権限がありません'`）混在。
- 成功時のレスポンスが `{ success: true }` / `{ ok: true }` / 素のデータ、と不統一。
- 同一の認可エラーでも 401 / 403 の使い分けがルートごとにバラバラ
  （例: `admin/users/[id]` はトークン無しでも 403、`featured-supporters` は権限無しでも 401）。

レスポンス規約を1つ決めて `src/lib/api/` にヘルパーを置くとよい。

### 20. `alert()` の使用

`src/app/admin/dashboard/page.tsx:172,246` — 他画面は toast コンポーネントを
使用しているため統一する。

### 21. テストスクリプトのパスワードハードコード

`scripts/create-test-users.ts:14` — `const PASSWORD = 'testpass123'`。
Staging 専用とはいえ、環境変数（`TEST_USER_PASSWORD`）化を推奨。
`docs/test_users.sql` は AGENTS.md で非推奨とされた SQL 直接挿入方式の名残なので、
誤用防止のため削除か「使用禁止」の注記を冒頭に追加。

### 22. その他の小さな指摘

- `src/app/api/messages/route.ts:89-92` — スナップショット表示名のフォールバック条件が
  三項演算子のネストで読みにくい。関数に抽出して意図（団体名と個人名が同一だった旧データの補正）をコメント化する。
- `tsconfig.json` の `target: "ES2017"` は古い。Next.js 16 / 対応ブラウザ前提なら `ES2022` に上げられる。
- `getBearerToken` の `authHeader.replace('Bearer ', '')` は `slice(7)` の方が安全
  （本文中に "Bearer " が再出現するケースは稀だが）。
- `.mcp.json`（Staging の project_ref のみでシークレットなし）が untracked のまま。
  チームで共有するならコミット、個人設定なら `.gitignore` へ追加して方針を明確にする。

---

## 対応の推奨順序

1. **即時**: #1（マスアサインメント）、#2（signup トークン必須化）、#4(layout 配置ミス)
2. **短期**: #3（`requireActiveAppUser` への統一 ＝ #7・suspendedチェック漏れも同時解決）、#5（旧 gemini.ts 削除）、#8・#9（長さ制限）
3. **中期**: #11（service_areas トランザクション化）、#13（zod + structured output）、#16（テスト基盤）
4. **継続**: #15（依存整理）、#17・#18（コンポーネント分割・fetch共通化）、#19（API規約統一）

サポーター団体DB刷新の本番適用前に、少なくとも 1〜2（即時対応）は済ませておくことを推奨する。
