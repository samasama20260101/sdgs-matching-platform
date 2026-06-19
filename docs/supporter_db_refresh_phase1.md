# サポーター団体DB刷新 Phase 1

## 目的

サポーターを「個人アカウント」ではなく「団体」として扱えるようにする。

基本方針:

```text
organizations = サポーター団体
users = ログインする個人
organization_memberships = 団体に所属する個人と権限
```

SOSに見える主体は団体、内部の操作履歴は個人として残す。

## 今回守る本番データ

Productionでは以下を壊さない。

- SOSユーザー
- cases
- messages
- messages の送信者表示履歴
- inquiries（必要に応じて保持）

サポーターは再登録前提のため、以下は整理・作り直し対象。

- 旧サポーターAuth
- 旧サポーターの public.users
- supporter_service_areas
- offers
- supporter_badges
- featured supporter設定

## 追加される主なDB要素

- `organizations`
- `organization_memberships`
- `organization_invitations`
- `audit_logs`
- `messages.sender_organization_id`
- `messages.sender_display_name_snapshot`
- `messages.sender_role_snapshot`
- `messages.sender_organization_name_snapshot`
- `offers.supporter_organization_id`
- `offers.created_by_user_id`
- `offers.accepted_by_user_id`
- `offers.declined_by_user_id`
- `supporter_service_areas.organization_id`
- `supporter_badges.supporter_organization_id`
- `case_internal_notes`

## 案件内部メモ

SOSには表示しない、支援者・運営向けの案件メモを保持する。

用途:

```text
ORGANIZATION_ONLY     自団体内だけの対応メモ
APPROVED_SUPPORTERS  その案件で承認済みのサポーター団体間の共有メモ
ADMIN_ONLY           運営だけが確認するメモ
```

アクセス方針:

```text
SOSユーザー: 読めない、書けない
未承認サポーター: 読めない、書けない
承認済みサポーター: APPROVED_SUPPORTERS を読める/書ける
同じ団体のメンバー: 自団体の ORGANIZATION_ONLY を読める/書ける
ADMIN: 全て読める
```

注意:

- 内部メモは本人非公開の支援記録であり、監査対象とする。
- 物理削除せず `deleted_at` で非表示にする。
- UI/API実装時は、本人に直接伝えるべき内容を内部メモに閉じ込めない注意書きを入れる。
- 初期実装ではテーブルのみ追加し、読み書きはサーバーサイドAPIで制御する。

## メンバー所属解除・移籍の第一弾仕様

複数団体所属は今回扱わない。ACTIVE所属は常に1団体のみとする。

```text
停止:
  organization_memberships.status = SUSPENDED
  users.is_suspended は変更しない
  users.is_suspended / Supabase Auth ban は管理者による全体アカウント停止専用
  団体のメンバー一覧に残る
  OWNERが復帰できる

所属解除:
  organization_memberships.status = LEFT
  users.is_suspended は true にしない
  通常メンバー一覧から外し、所属解除中として表示する
  有効な所属団体がないユーザーはログインできるが、サポーター機能は使えない

所属復活:
  同じユーザーが他団体にACTIVE/SUSPENDED所属していない場合のみ、LEFTからACTIVEに戻せる

他団体への移籍:
  所属解除中のユーザーを、別団体のOWNER/ADMINが同じメールアドレスでメンバー追加できる
  追加された時点で新しい団体のACTIVE所属になる
  元団体のメンバー一覧からは非表示になる

追加不可:
  既にどこかの団体にACTIVEまたはSUSPENDED所属しているユーザーは追加できない
```

所属がないサポーターユーザーには `/supporter/no-organization` を表示する。
管理者画面からの物理削除は行わず、全体アカウント停止・停止解除を基本操作とする。

## Dev 適用順

1. 対象 project ref が Dev/Staging `fzawgdmqewmwdqjsqjwt` であることを確認する。
2. `migrations/add_supporter_organizations.sql` を Supabase SQL Editor で実行する。
3. `migrations/add_case_internal_notes.sql` を Supabase SQL Editor で実行する。
4. サポーター団体・所属メンバーの作成を確認する。
5. アプリのサポーター関連APIを団体ベースで確認する。

確認SQL:

```sql
select count(*) as organizations_count
from organizations;

select count(*) as active_memberships_count
from organization_memberships
where status = 'ACTIVE';

select count(*) as messages_without_snapshot
from messages
where sender_display_name_snapshot is null;

select count(*) as case_internal_notes_count
from case_internal_notes;
```

## Production 適用順

Productionでは必ずバックアップ後に実行する。

1. Supabase project ref が Production であることを確認する。
2. DBバックアップを取得する。
3. Authユーザー一覧を確認する。
4. `migrations/add_supporter_organizations.sql` を適用する。
5. `migrations/add_case_internal_notes.sql` を適用する。
6. `messages` の snapshot が埋まっていることを確認する。
7. 旧サポーター関連データを整理する。
8. 新しい運営サポーター団体を登録する。

## 旧サポーター整理の考え方

今回の本番状況:

```text
解決済み案件なし
MATCHED案件なし
サポーターは運営1件のみ
```

そのため、サポーター関連データは再登録でよい。

ただし、`messages` を残す場合は旧サポーター削除前に snapshot を保存する。
今回のmigrationでは既存メッセージに以下をバックフィルする。

```text
sender_display_name_snapshot
sender_role_snapshot
sender_organization_name_snapshot
```

## 今後のStep

```text
Step 1: DB基盤追加
Step 2: API認可を organization_memberships ベースへ移行
Step 3: 団体プロフィールUI
Step 4: メンバー管理・招待UI
Step 5: サポーター公開ページ・一覧を organizations ベースへ移行
Step 6: Productionで旧サポーター整理・新サポーター再登録
```

## Rollback 方針

Devでは以下で戻せる。

```sql
drop table if exists case_internal_notes;
drop table if exists audit_logs;
drop table if exists organization_invitations;
drop table if exists organization_memberships;
alter table messages drop column if exists sender_organization_id;
alter table messages drop column if exists sender_display_name_snapshot;
alter table messages drop column if exists sender_role_snapshot;
alter table messages drop column if exists sender_organization_name_snapshot;
alter table supporter_badges drop column if exists supporter_organization_id;
alter table offers drop column if exists declined_by_user_id;
alter table offers drop column if exists accepted_by_user_id;
alter table offers drop column if exists created_by_user_id;
alter table offers drop column if exists supporter_organization_id;
alter table supporter_service_areas drop column if exists organization_id;
alter table users drop column if exists is_legacy_supporter;
drop table if exists organizations;
```

Productionでは、rollbackよりもバックアップ復元を優先する。
