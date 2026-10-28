# 明日もsamasama | SDGs MATCH

困りごとを抱える人(相談者)と、NPO・行政・企業などの支援団体(サポーター)をつなぐ Web サービス。本番: https://app.samasama.site

## 文書

| ファイル | 内容 |
|---|---|
| `AGENTS.md` | 作業ルールと、知らないと事故になること(最初に読む) |
| `docs/service_specification.md` | サービス仕様(今のコードが何をしているか) |
| `docs/operations.md` | 開発・運用の手引き(環境・リリース・DB・API の作り方・メンテナンスモード) |
| `docs/intake_indicators.md` | 相談フォームの選択肢と大項目の正本 |
| `docs/news_section_design.md` | お知らせ欄の設計と決定ログ |
| `HANDOFF.md` | 今の作業の現在地 |

## ローカル起動

```bash
source ~/.nvm/nvm.sh
npm install
npm run dev
```

`.env.local` に Staging の値を入れる(`docs/operations.md` §3)。

## 技術

Next.js 16(App Router)/ TypeScript / next-intl / Supabase / Vercel / Google Gemini
