# HANDOFF: 多言語対応(i18n) devテストフェーズ
更新: 2026-07-11

## ゴール(完成条件)
静的文言の多言語切り替え(dev環境では ja/en/zh のみ公開)をdevで検証し、
問題がなければ動的翻訳(Phase 2 = PR #10)→本番反映へ進む。
サポーター・管理者ページ、ポリシー系(規約/プライバシー/ストーリー)は日本語のまま(ユーザー決定)。

## 現在地
静的3言語切り替え+公開ページの言語切替ボタン+タブアイコン/OGP刷新+SNSシェアボタンまで
devに反映済み。ユーザーがdev環境で使い勝手テスト中。動的翻訳はfeatureブランチで待機。

## 完了したこと(すべてdevマージ済み・デプロイ確認済み)
- PR #11: 公開ロケールを ja/en/zh に制限(ko/vi/id はカタログ・DB定義を保持したまま非公開、/ko等は404)
  +story修正+なみあSVG素材11点+SDGs設計docs
- PR #13: 公開6ページ(Top/サポーター一覧/詳細/お問い合わせ/ログイン/登録)に LanguageSwitcher 追加
  +SOS結果ページのフォールバック文言ID化(SOS向け静的文言はこれで完全)
- PR #14: Top概念図キャプションの英語表示での画像重なり修正(absolute→ネガティブマージン)
- PR #15: favicon一式+OGP画像刷新(旧OGPは日本語が文字化けしていた)。src/app/favicon.ico も差し替え済み
  (public/ より優先されるNext.js規約に注意)。再生成ソースは docs/assets/*.svg
- PR #16: TopページCTA内にSNSシェアボタン(X/LINE/Facebook/リンクコピー、landing.share 6ロケール)
- 静的文言の全ページ監査: SOS/公開ページに残る日本語はコメント・ブランド名・緊急語彙のみと確認
  (dev /en /zh のTopをHTML実測で日本語0件)

## 試して失敗したこと ★最重要
- サポーターUI翻訳(PR #12)を実装完了まで進めたが、ユーザー判断で**取りやめ**。
  PR #12はクローズ(未マージ)、ブランチ feature/i18n-supporter-ui は保持
  → 将来必要になれば再オープンで復活可。supporter.json への約170キー×6ロケールも同ブランチにのみ存在
- 旧OGP画像は日本語フォント無しで生成されており文字化けしていた
  → 再発防止: OGP生成はIPAゴシック(WSLにインストール済み)を font-family 指定して sharp でレンダリング
- 過去の教訓: ビルド検証のgrepが「Failed to compile」をマッチして成功扱いにした事故あり
  → ビルド確認は exit code とページ数(現在112)を見る

## 次の一手
**次の作業は多言語ではなく「案件解決時の指標カウント」機能**(ユーザー予告、2026-07-11)。
- 正本設計書: docs/sdgs_impact_dashboard_design.md(実装未着手。夜間バッチ+カウント+17ゴール入口UI)
- ユーザー確認済みの認識: 夜間バッチ+カウント処理なので多言語とはほぼ独立
- 分類の本命はユーザー作成中の教師データ待ち。先行できるのは Step 0
  (ai_sdg_suggestion ベースの17ゴール集計)とバッチ/テーブルの骨組み
- 着手時: devから新featureブランチ、migration はStaging先行(AGENTS.md)

多言語(Phase 2動的翻訳)の再開手順は **PR #10 の説明文に記載済み**(dev取り込み→検証→承認マージ)。

## 地雷・注意
- **Production Supabase への変更はユーザー明示許可なしに絶対に実行しない**(AGENTS.md)。本番反映は保留中
- devへのPRマージは毎回ユーザーの明示承認(「マージして」)が必要
- ko/vi/id を公開に戻すのは routing.ts の locales に追加するだけだが、**緊急語彙のネイティブ確認が公開前提条件**
- src/app/favicon.ico は public/favicon.ico より優先配信される(両方更新すること)
- Staging DBにはPhase 2用カラム(system_key等)が適用済みだがdevコードは未使用(無害)
- テストユーザー: sos01@gmail.com / npo01_1@gmail.com (testpass123)
