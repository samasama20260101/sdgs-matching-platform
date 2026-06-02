# Production サポーター団体DB刷新 手順書

## 目的

サポーターを個人単位ではなく団体単位で扱うDB刷新をProductionへ適用する。

```text
organizations             サポーター団体
users                     ログインする個人
organization_memberships  個人と団体の所属関係
```

SOSユーザー、相談案件、チャット履歴は保持する。
サポーターの操作担当者IDも監査用に保持する。

## 本番保護

- 対象Project RefはSupabase DashboardとVercel Production環境変数で作業直前に再確認する。
- Staging Project Ref `fzawgdmqewmwdqjsqjwt` へ誤って接続していないことも確認する。
- 過去資料のProduction Project RefとSupabase CLIのプロジェクト一覧に不一致が見つかっている。照合が終わるまでSQLを実行しない。
- ProductionへのSQL実行、Auth操作、データ削除は、作業直前に内容を再確認してから行う。
- DBバックアップを取得してから開始する。
- SOSユーザー、相談内容、メッセージ、認証情報、支援履歴を一括削除しない。

## 現在把握しているProductionの状態

2026年6月2日時点の前提:

```text
サポーター: 運営団体 1組
SOSユーザー: 2組
解決実績: 0件
```

運営サポーターは再作成してよい。
ただし、作業直前に件数と案件状態を再確認する。

## 事前確認SQL

```sql
select count(*) as sos_users
from users
where role = 'SOS';

select count(*) as supporter_users
from users
where role = 'SUPPORTER';

select status, count(*) as count
from cases
group by status
order by status;

select status, count(*) as count
from offers
group by status
order by status;

select count(*) as messages_count
from messages;
```

想定外の `MATCHED`、`RESOLVED`、サポーター関連データがある場合は、適用前に個別確認する。

## Production適用順

Supabase DashboardのProduction SQL Editorで、以下を上から順に1本ずつ実行する。

1. `migrations/add_accepted_order_to_offers.sql`
2. `migrations/add_supporter_organizations.sql`
3. `migrations/add_case_internal_notes.sql`
4. `migrations/add_supporter_workflow_guards_and_member_details.sql`
5. `migrations/finalize_supporter_organization_ownership.sql`
6. `migrations/harden_supporter_organization_foundation.sql`
7. `migrations/add_admin_search_foundation.sql`

各SQLの完了を確認してから次へ進む。
`finalize_supporter_organization_ownership.sql` は孤立データがある場合に停止するため、エラー時はデータを削除せず状況を確認する。
`harden_supporter_organization_foundation.sql` は重複所属や地域不整合がある場合に停止するため、エラー時はデータを削除せず状況を確認する。
`harden_supporter_organization_foundation.sql` は廃止済みの案件ステータス `IN_PROGRESS` が残っている場合、現行の `MATCHED` へ統合する。
`add_admin_search_foundation.sql` は案件へ `CASE-00001` 形式の管理用番号を付与し、ユーザーメールの大小文字を無視した重複登録を禁止する。

### 6本目の実行前確認SQL

5本目の完了後、6本目の強化migrationを実行する前に確認する。

```sql
select user_id, count(*) as current_memberships_count
from organization_memberships
where status in ('ACTIVE', 'SUSPENDED')
group by user_id
having count(*) > 1;

select organization_id, country, region_code, count(*) as duplicate_service_areas_count
from supporter_service_areas
group by organization_id, country, region_code
having count(*) > 1;

select organization_id, coalesce(country, 'JP') as country
from supporter_service_areas
group by organization_id, coalesce(country, 'JP')
having bool_or(is_nationwide = true)
   and bool_or(is_nationwide = false);
```

3つとも `0件` であることを確認する。

## 適用後確認SQL

```sql
select count(*) as organizations_count
from organizations;

select status, count(*) as memberships_count
from organization_memberships
group by status
order by status;

select count(*) as messages_without_snapshot
from messages
where sender_display_name_snapshot is null
   or sender_role_snapshot is null;

select count(*) as service_areas_without_organization
from supporter_service_areas
where organization_id is null;

select count(*) as offers_without_organization
from offers
where supporter_organization_id is null;

select count(*) as badges_without_organization
from supporter_badges
where supporter_organization_id is null;

select count(*) as duplicate_organization_offers
from (
    select case_id, supporter_organization_id
    from offers
    group by case_id, supporter_organization_id
    having count(*) > 1
) duplicates;

select count(*) as duplicate_organization_badges
from (
    select case_id, supporter_organization_id, badge_key
    from supporter_badges
    group by case_id, supporter_organization_id, badge_key
    having count(*) > 1
) duplicates;

select count(*) as case_internal_notes_count
from case_internal_notes;

select count(*) as organizations_without_display_id
from organizations
where display_id is null;

select count(*) as invalid_message_types
from messages
where message_type not in ('USER', 'SYSTEM');

select count(*) as cases_without_display_id
from cases
where display_id is null;

select relname, relrowsecurity
from pg_class
where relname in (
    'organizations',
    'organization_memberships',
    'organization_invitations',
    'audit_logs'
)
order by relname;
```

以下はすべて `0` であることを確認する。

```text
messages_without_snapshot
service_areas_without_organization
offers_without_organization
badges_without_organization
duplicate_organization_offers
duplicate_organization_badges
organizations_without_display_id
invalid_message_types
cases_without_display_id
```

`relrowsecurity` は4テーブルすべて `true` であることを確認する。

## 運営サポーターの扱い

migration適用後、既存の運営サポーターが正常に移行されている場合は、そのまま利用できる。

再作成する場合:

1. メッセージsnapshotが補完済みであることを確認する。
2. SOSユーザー、cases、messagesを削除しない。
3. 旧サポーターのAuth削除やデータ整理は、対象IDを確認して個別に行う。
4. 管理画面から新しい運営サポーター団体を登録する。
5. OWNERでログインし、団体プロフィールと活動地域を設定する。

同じメールアドレスを再利用する場合、Authの一意制約があるため、旧Authを残したまま新規登録しない。

## アプリ反映後の確認

1. 運営サポーターOWNERでログインできる。
2. 団体プロフィールと団体公開ページを表示できる。
3. メンバー追加、停止、復帰、所属解除を操作できる。
4. SOS案件へ申し出できる。
5. SOS側で承認できる。
6. チャットに団体名と担当者名が表示される。
7. 内部メモの `自団体のみ` と `担当サポーター間` を使い分けられる。
8. SOS側に内部メモが表示されない。

## Rollback

Productionでは手動で一部テーブルだけを戻さず、原則として適用前バックアップから復元する。
アプリ反映前でSQL適用後に問題が見つかった場合も、追加の削除SQLを即時実行せず状況を保存して判断する。
