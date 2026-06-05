# 明日もsamasama | SDGs MATCH

社会的困難を抱えるSOSユーザーと、NPO・行政・企業などのサポーターをAIでつなぐマッチングプラットフォームです。

## 主要ドキュメント

| ドキュメント | 内容 |
|---|---|
| `docs/service_specification.md` | サービス全体仕様書。説明書・機能仕様の入口 |
| `docs/staging_role_function_test_spec.md` | SOS・サポーター・管理者ごとの機能仕様とテスト観点 |
| `AGENTS.md` | 開発ルール、サービス思想、本番保護ルール |
| `docs/technical_stack.md` | 技術構成 |
| `docs/api_security_design.md` | API認可、Supabase key、AI API、通知設計方針 |
| `docs/environment_setup.md` | ローカル開発環境セットアップ |
| `docs/maintenance_mode.md` | メンテナンスモード運用 |
| `docs/production_supporter_db_refresh_runbook.md` | Production DB刷新手順 |

## 環境

| 環境 | 用途 |
|---|---|
| `dev` branch | Staging用。開発・検証 |
| `main` branch | Production用。PR経由で反映 |

Production DBへのSQL実行、環境変数変更、Auth操作、RLS変更、一括更新・削除は、事前確認なしに実施しません。

## ローカル起動

詳細は `docs/environment_setup.md` を参照してください。

```bash
npm install
npm run dev
```

ブラウザで以下を開きます。

```text
http://localhost:3000
```

## 技術概要

| 領域 | 技術 |
|---|---|
| Webアプリ | Next.js App Router |
| 言語 | TypeScript |
| UI | React / Tailwind CSS |
| DB / Auth | Supabase |
| AI | Google Gemini AI |
| ホスティング | Vercel |
