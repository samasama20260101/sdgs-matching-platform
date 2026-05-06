# CLAUDE.md — 明日もsamasama | SDGs Match

ClaudeCode がこのプロジェクトで作業する際の入口ファイル。

このリポジトリの作業ルール・サービス思想・環境情報・DB運用方針は、Codex / ClaudeCode 共通で `AGENTS.md` を正本とする。

作業前に必ず以下を読むこと。

- `AGENTS.md`

特に重要:

- 通常作業は `dev` ブランチ + Staging Supabase で行う。
- Production Supabase への変更操作は、ユーザーの明示許可なしに実行しない。
- DB変更は migration SQL として残し、Staging確認後に本番適用を検討する。
