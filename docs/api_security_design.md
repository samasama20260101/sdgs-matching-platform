# API・Supabaseアクセス設計メモ

最終更新: 2026-06-05

## 1. 本書の目的

本書は、明日もsamasama | SDGs MATCH のAPI認可、Supabase keyの使い分け、AI API、Realtime/通知まわりの実装方針を残すための設計メモです。

今後、新しいAPI、PWA通知、OAuth、メディア管理、チャット拡張を実装するときは、本書を確認してから設計します。

## 2. 基本方針

このプロジェクトでは、ブラウザからDBを直接操作しません。

原則:

| 領域 | 方針 |
|---|---|
| ブラウザ | Supabase anon key は認証・セッション取得に使う |
| DB読み書き | Next.js API Route経由で行う |
| API Route | `supabaseAdmin` を使い、API内で必ず認証・認可を判定する |
| service_role key | サーバー専用。クライアントへ出さない |
| 公開API | 返却カラムを明示し、公開してよい情報だけ返す |
| AI API | 未ログイン利用不可。用途ごとにロール・対象データを確認する |

`supabaseAdmin` はRLSをバイパスできるため便利ですが、API側の認可漏れがそのまま情報漏えいになります。

そのため、新規APIでは「DBアクセスより先に認証・認可」を必須にします。

## 3. server-only方針

以下のモジュールはサーバー専用です。

| ファイル | 役割 |
|---|---|
| `src/lib/supabase/server.ts` | `supabaseAdmin` の生成 |
| `src/lib/organizations.ts` | 団体所属コンテキスト取得 |
| `src/lib/gemini.ts` | Gemini API key を使うAI処理 |
| `src/lib/api/auth.ts` | API用の認証・認可ヘルパー |

これらには `import 'server-only'` を入れています。

クライアントコンポーネントから誤ってimportするとビルド時に検知されるため、今後もサーバー専用処理はこの考え方に寄せます。

## 4. API認証ヘルパー

新規APIでは、原則として `src/lib/api/auth.ts` の `requireActiveAppUser()` を使います。

例:

```typescript
const auth = await requireActiveAppUser(request, { roles: ['SOS'] })
if ('response' in auth) return auth.response
```

確認される内容:

- `Authorization: Bearer ...` がある
- Supabase AuthのJWTとして有効
- `public.users` に対応するユーザーが存在する
- `is_suspended` ではない
- 指定ロールに一致する

ただし、公開API、Cron API、メンテナンス用APIは別ルールです。

| 種別 | 認可方針 |
|---|---|
| ログインユーザーAPI | `requireActiveAppUser()` を使う |
| 管理者API | `roles: ['ADMIN']` を必須にする |
| SOS本人API | SOSロール + `owner_user_id` 確認 |
| サポーターAPI | SUPPORTERロール + `organization_memberships` 確認 |
| 公開API | ログイン不要。ただし返却カラムを公開情報に限定する |
| Cron API | `CRON_SECRET` などのサーバー間認証で保護する |

既存APIは段階的にこのヘルパーへ寄せます。

## 5. SOSサインアップ

`/api/auth/signup` は、クライアントから渡された `auth_user_id` をそのまま信用しません。

現在の方針:

- Supabase AuthにそのユーザーIDが実在することを確認する
- Auth上のメールアドレスとリクエストのメールアドレスが一致することを確認する
- Bearer token がある場合は、tokenのユーザーIDと `auth_user_id` の一致を確認する
- 既にSOSプロフィールがある場合は成功扱いにする
- SUPPORTER/ADMINなど別ロールの既存プロフィールにはSOS登録を許可しない

理由:

ProductionではEmail Confirmが有効なため、サインアップ直後にsessionが無い場合があります。

そのためBearer token必須にはせず、service_role側でAuthユーザー実在確認を行います。

## 6. AI API

AI APIはコストと個人情報の両面で保護が必要です。

現在の方針:

| API | 許可ロール | 追加確認 |
|---|---|---|
| `/api/gemini/analyze` | SOS / ADMIN | `caseId` がある場合、SOS本人の案件か確認 |
| `/api/classify-sdgs` | ADMIN | 開発・検証用 |

実装ルール:

- 未ログインから実行させない
- 文字数上限を設ける
- 相談本文やメッセージ履歴をAIに送る場合は、用途と範囲を明確にする
- AI結果をDBに保存する場合は、誰が確認した結果かを残せる設計にする

今後のGI分類では、分類結果をすぐ確定値にせず、サポーター確認・SOS確認・自動確定条件を分けて扱います。

## 7. Realtime / 通知方針

現時点では、ブラウザからSupabase Realtimeの `postgres_changes` を直接購読しません。

理由:

- anon key経由のDB変更通知は、RLS/Realtime設定の漏れが情報漏えいにつながりやすい
- このサービスでは相談本文、メッセージ、支援履歴など機微情報が多い
- PWA通知を入れるなら、通知専用の設計に寄せたほうがよい

現在の暫定方針:

- メッセージ、案件状態は認証済みAPI経由で再取得する
- 画面更新は短いポーリングで対応する

将来のPWA通知方針:

| 要素 | 方針 |
|---|---|
| 通知イベント | `notification_events` のような専用テーブルで管理 |
| 未読状態 | ユーザー単位または団体メンバー単位で管理 |
| Push送信 | サーバー側ジョブ/APIから送信 |
| 表示内容 | 通知本文に相談詳細を入れすぎない |
| 権限 | 通知取得APIで本人・所属団体・管理者を確認 |

## 8. 新規API実装チェックリスト

APIを追加・修正するときは、以下を確認します。

- APIは公開APIか、ログイン必須APIか
- ログイン必須なら `requireActiveAppUser()` を使っているか
- ロール確認だけでなく、対象データの所有者・所属団体を確認しているか
- `supabaseAdmin` のselectが広すぎないか
- 公開APIで個人電話、個人住所、メール、相談本文、内部メモを返していないか
- 書き込みAPIでクライアント申告の `user_id` / `organization_id` を信用していないか
- AI APIの場合、ロール、対象データ、文字数上限、保存先が明確か
- Production DB変更が必要な場合、runbookにSQL、影響範囲、rollback方針を書いたか

## 9. Stagingテストで確認すること

今回の大きなDB変更後は、通常機能に加えて以下を確認します。

| 観点 | 期待結果 |
|---|---|
| 未ログインでAI APIを叩く | `401` |
| SUPPORTERでSOS用AI分析を叩く | `403` |
| SOS AがSOS Bの `caseId` でAI分析する | `403` |
| 開発用AI分類APIを管理者以外で叩く | `403` |
| 停止ユーザーでAPIを叩く | `403` |
| 公開サポーターAPI | 団体公開情報だけ返る |
| 団体公開ページ | 担当者個人の電話・住所が出ない |
| メッセージ送信後 | 最大15秒程度で相手画面へ反映される |

## 10. 後続改善候補

すぐに必須ではありませんが、今後の大きな機能追加前に検討します。

- 既存API全体を `requireActiveAppUser()` に順次寄せる
- APIごとの軽量rate limit
- AI APIの利用ログ・エラー監視
- PWA通知用の `notification_events` / `notification_subscriptions`
- メディア管理用の `media_assets`
- 添付ファイル用の公開範囲・ウイルスチェック・署名URL方針
- チャットの引用、編集、削除、未読管理をDB設計から整理する
