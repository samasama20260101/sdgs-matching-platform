# Supabase IO・DBアクセス運用ガイド

最終更新: 2026-06-09

## 1. 目的

本書は、Supabase Staging / ProductionでDisk IO BudgetやDBリクエストが増えたときの調査手順と、同じ問題を再発させないための実装ルールをまとめるものです。

現在のSupabaseはPro契約の最小構成で運用しています。ローンチ直後は十分でも、ユーザー数、開きっぱなし画面、チャット、通知、AI分類、管理画面検索が増えると、将来的にDBリソースのアップグレードが必要になる可能性があります。

## 2. 今回の教訓

2026年6月のStagingでは、以下がIO/DBアクセス増加の主なリスクとして確認されました。

| 問題 | 原因 | 対応 |
|---|---|---|
| DB/Auth requestsが24時間ほぼ一定で増える | 15秒ポーリングが開きっぱなしタブで動き続けた | 60秒へ変更し、非表示タブでは停止 |
| チャット画面が勝手に下へ移動する | ポーリング更新時にページ全体へscrollIntoViewしていた | チャット枠内だけスクロール |
| `invalid input syntax for type uuid: ""` | UUIDカラムに空文字を渡した | `src/lib/api/validation.ts` で入口検証 |
| 所属停止・復帰が管理者停止と混線する | 団体内停止と全体アカウント停止が同じフラグを触った | `organization_memberships.status` と `users.is_suspended` を分離 |

## 3. Supabaseリソース前提

現時点の前提:

- Staging / ProductionはDBが別。
- Production DBへは、ユーザーの明示確認なしにSQL実行しない。
- Supabase Proの最小構成は、開発・初期運用には十分でも、常時アクセス・検索・チャット・AI集計が増えるとDisk IO / CPU / DB接続数が先に詰まりやすい。
- リソース不足はコード不具合とは限らない。利用量が増えれば、最適化後でもアップグレード判断が必要になる。

アップグレードの前に必ず確認すること:

1. 無駄なポーリングや開きっぱなしタブ由来ではないか。
2. 重い一覧・検索に必要なindexがあるか。
3. 不正値や空文字UUIDでエラーを大量発生させていないか。
4. Storage / Realtime / Auth / Databaseのどこが増えているか。
5. Stagingだけのテスト負荷か、Productionの実利用負荷か。

## 4. 実装ルール

### 4.1 DBアクセスはAPI経由

ブラウザからDBテーブルを直接読み書きしません。

- ブラウザ: Supabase anon keyは認証・セッション取得に使う。
- API Route: `supabaseAdmin` を使う。
- API Routeでは、DBアクセス前に認証・認可を行う。
- 新規APIでは `src/lib/api/auth.ts` の `requireActiveAppUser()` を優先する。

`supabaseAdmin` はRLSをバイパスするため、API側の認可漏れはそのまま情報漏えいになります。

### 4.2 UUIDはDBへ渡す前に検証

URL params、query string、request bodyのIDは信用しません。

必須ルール:

- UUIDカラムへ `''` を渡さない。
- `id`, `case_id`, `offer_id`, `organization_id`, `membership_id`, `note_id` はDBアクセス前に検証する。
- 新規APIでは `src/lib/api/validation.ts` の `isUuid()` / `normalizeUuidList()` を使う。
- 不正なIDはDBへ投げず、`400` または公開APIなら `404` で返す。

例:

```typescript
const { id } = await params
if (!isUuid(id)) {
  return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
}
```

### 4.3 ポーリングは最小限

Realtime直接購読は原則使わず、認証済みAPI経由で再取得します。ただし、ポーリングはDB/Auth requestsを増やすため慎重に扱います。

基本ルール:

- 定期更新は原則60秒以上。
- `document.visibilityState !== 'visible'` のときは停止する。
- タブ再表示時に1回だけ再確認する。
- 送信直後、承認直後などユーザー操作直後は明示的に再取得してよい。
- ページ本体データとチャットメッセージを両方ポーリングする場合、頻度と取得内容を分ける。
- 管理画面一覧・検索画面は自動ポーリングしない。必要なら手動更新を優先する。

避ける実装:

```typescript
window.setInterval(loadData, 15000)
```

推奨:

```typescript
const intervalId = window.setInterval(() => {
  if (document.visibilityState !== 'visible') return
  void loadData()
}, 60_000)
```

### 4.4 重いAPIは取得範囲を絞る

DB IOを増やしやすい処理:

- `select('*')` の多用
- 検索条件なしの一覧取得
- 大量行に対する `order by created_at`
- API 1回で複数テーブルを順番に取得するN+1クエリ
- チャット履歴の全件取得

新規APIでは以下を意識します。

- 返却カラムを明示する。
- 一覧はlimit / paginationを入れる。
- 検索条件に使うカラムはindexを検討する。
- 管理画面検索は部分一致・複数条件が増えるため、実装前にDB設計を確認する。
- チャット履歴は将来、差分取得またはページングを検討する。

## 5. IO警告が来たときの調査手順

SupabaseからDisk IO Budget警告が来たら、まず慌ててアップグレードせず、以下の順番で確認します。

### 5.1 Dashboardで見るもの

- 対象Project RefがStagingかProductionか。
- 期間はLast 24 hours / Last 7 daysのどちらか。
- Requests内訳:
  - Database Requests
  - Auth Requests
  - Storage Requests
  - Realtime Requests
- 棒グラフが山型か、平らに継続しているか。

判断:

- 山型: migration、テスト、インポート、AI集計など単発処理の可能性。
- 平ら: ポーリング、開きっぱなし画面、定期ジョブ、外部監視の可能性。

### 5.2 アプリ側で確認するもの

```bash
rg -n "setInterval|poll|loadData\\(|loadMessages\\(" src/app src/components src/lib
```

確認観点:

- 15秒以下の自動更新がないか。
- 非表示タブでも動いていないか。
- 管理画面一覧で自動更新していないか。
- API 1回で複数の重いDBアクセスをしていないか。

### 5.3 DB側で確認するSQL

Supabase SQL Editorで、Staging/Productionの対象Project Refを確認してから実行します。

```sql
-- DB内でIOが多いクエリを見る。pg_stat_statements が有効な場合。
select
  calls,
  total_exec_time,
  mean_exec_time,
  rows,
  shared_blks_read,
  shared_blks_hit,
  temp_blks_read,
  temp_blks_written,
  left(query, 800) as query
from pg_stat_statements
order by shared_blks_read + temp_blks_read + temp_blks_written desc
limit 20;
```

```sql
-- テーブル別の読み込み傾向
select
  schemaname,
  relname,
  heap_blks_read,
  heap_blks_hit,
  idx_blks_read,
  idx_blks_hit,
  toast_blks_read,
  tidx_blks_read
from pg_statio_user_tables
order by heap_blks_read + idx_blks_read + toast_blks_read + tidx_blks_read desc
limit 20;
```

```sql
-- Seq Scanが多いテーブル
select
  schemaname,
  relname,
  seq_scan,
  seq_tup_read,
  idx_scan,
  n_live_tup
from pg_stat_user_tables
order by seq_tup_read desc
limit 20;
```

```sql
-- 実行中・待機中のクエリ
select
  pid,
  usename,
  state,
  wait_event_type,
  wait_event,
  now() - query_start as age,
  left(query, 1000) as query
from pg_stat_activity
where state <> 'idle'
order by query_start asc;
```

## 6. Index追加の判断

indexは万能ではありません。読み取りは速くなりますが、書き込み時の更新コストとStorage使用量が増えます。

追加を検討する条件:

- 同じ条件の検索・並び替えが高頻度で実行されている。
- `pg_stat_user_tables` でSeq Scanが多い。
- APIのレスポンスが遅い。
- 一覧・検索・チャット履歴など、ユーザー増加で行数が増えることが明らか。

候補例:

```sql
create index concurrently if not exists idx_messages_case_created_at
  on messages(case_id, created_at);
```

```sql
create index concurrently if not exists idx_offers_case_status_created
  on offers(case_id, status, created_at desc);
```

本番でindexを追加する場合も、必ずProduction適用前にProject Ref、SQL、影響範囲、rollback方針を確認します。

## 7. アップグレード判断

以下の状態が続く場合は、コード改善だけではなくSupabase compute / DBリソースのアップグレードを検討します。

- ポーリングや不要アクセスを減らしてもDisk IO Budget警告が続く。
- Productionの通常利用時間帯にレスポンス遅延が出る。
- CPU / IO wait / DB接続数が高い状態で継続する。
- 管理画面検索、チャット、通知、AI分類、添付ファイルなど、DB負荷の高い機能を本格導入する。
- Stagingでは再現しないがProductionの実利用で負荷が上がる。

アップグレードは悪いことではありません。ユーザーが増えた結果として自然に必要になるものです。ただし、無駄なポーリングや不正クエリを残したまま上げると、上げた分だけ無駄も増えるため、まず本書の確認を行います。

## 8. Production作業時の注意

Production DBでIO・index・migration作業をする場合:

1. `docs/production_supporter_db_refresh_runbook.md` または対象作業用runbookを確認する。
2. Project RefがProductionであることを作業直前に確認する。
3. 必要に応じて `MAINTENANCE_MODE=true` にする。
4. 実行SQLをユーザーと確認する。
5. 影響テーブルとユーザー体験を確認する。
6. 実行後にDashboardと主要画面を確認する。

メンテナンスモードは強制ログアウトしません。セッションを保持したまま `/maintenance` へ誘導します。
