# HANDOFF: 熊本地震 災害SOS(拡散フェーズ)+ マッチング1対1化
更新: 2026-08-16

## ゴール(完成条件)
災害SOSの拡散を進めつつ、通常フローを1案件1団体制へ移行し本番反映する。
将来は「マッチ済みサポーターが行政等を招待して連携」方式を設計する(現1対1はその布石)。

## 現在地
**PR #26・#27・#28 すべてマージ済み、本番デプロイ完了(2026-08-16、Vercelビルド成功・サイト200応答)。main=dev。**
1対1化・種別「その他」・AI分析修正・共有メモ廃止・取消体験改善が本番稼働。
残タスクは本番スモークテスト・種別SQL更新・拡散タスク。

## 完了したこと
- PR #26(devマージ済み・ビルド検証済み): 通常フローの承認上限2→1 / サポーター種別 OTHER 追加(6言語)/ 通常フローAI分析修正(gemini maxOutputTokens 8192 + responseMimeType)/ 他団体共有メモ廃止(自団体引き継ぎメモは存続)
- PR #27(未マージ・ビルド検証済み): MATCHED案件取消時にチャットへシステムメッセージ / 取消確認モーダルのマッチ済み用文言(6言語)/ 終了案件へのメッセージ送信を409ブロック / サポーターダッシュボードに「取消済み」バケット新設(支援中への混入を修正、災害・通常両タブ)/ 災害タブ統計の足し算修復 / SOS側でCLOSEDが「取消済み」と誤表示される問題修正
- AI分析失敗の原因特定: 実APIで3/3再現→対策設定で2/2成功を実測確認
- display_id形式統一(2026-08-16 Staging・本番とも実行済み・検証済み): 旧形式(A-/S-/P-)を現行形式(ADM-/SOS-/SUP-)へ再採番、UNIQUE付与、遺物シーケンス削除、generate_display_id関数をmigrationsへ正本化(migrations/normalize_display_id_format.sql)。旧IDは本番の display_id_backup_20260816 に保存(落ち着いたらDROP可)

## 試して失敗したこと ★最重要
- (既存の教訓は git log の過去HANDOFF参照。今回セッション分↓)
- 通常フローAI分析失敗を「熊本の災害分岐が原因」と仮説 → 災害分岐は別エラー文言を返す作りで無罪 → 真因は6/12のセキュリティ強化で入った maxOutputTokens:2048。gemini-2.5-flashは思考トークン(実測1,400〜1,700)が上限を内側から食い、長い日本語JSONが切断される。**災害側(disasterNeeds.ts)にだけ対策があり通常側に未適用だった。教訓: 実測した教訓は同種の全呼び出し箇所へ横展開すること**
- CANCELLED案件がサポーター側フィルターで「支援中」にヒット → getCaseDisplayStatus の考慮漏れ(RESOLVED/CLOSED以外は全部active扱い)。「解決済みに入れる」案はサポーターの成果ラベル汚染+将来のインパクト集計との食い違いを生むため不採用、独立バケットに
- useState に明示型注釈がある箇所へプロパティ追加時、初期値だけ足して型を忘れビルド失敗(1回で修正)

## 次の一手
1. **本番スモークテスト**: 通常相談を1件登録しAI分析が通ること(「AI分析に失敗しました」が出ないこと)を実測確認 → 確認後テスト案件は取消
2. 既存サポーターの種別変更 `UPDATE organizations SET supporter_type = 'OTHER' WHERE name = '対象団体名';` を本番SQL Editorで(ユーザー自身が実行)
3. 拡散タスク(未着手): Resend Proアップグレード / Instagramリンク設定+投稿 / pptxスライド12とリーフレットの連絡先記入 / 八代市「郡築」表記確認
4. 技術負債: スキーマ差分照合スクリプト(read-only本番PG vs Staging)をリリース手順に組込み

## 地雷・注意
- **本番Supabaseへの変更操作はユーザー明示許可なしに絶対に実行しない**(こちらはread-only接続のみ)
- 災害データは cases.intake_qna.disaster 配下(migration不要方針)。正本は src/lib/constants/disaster.ts
- ビルド検証は exit code と「Generating static pages (115/115)」で判定(prerender-manifestやhtml数では数が合わない)
- 環境差: Stagingはメール確認OFF/本番はON
- 多言語再公開はフラグ2箇所(LanguageSwitcher.tsx / routing.ts)。ko/vi/idは緊急語彙ネイティブ確認が前提
- チャットに貼られたResend APIキーは落ち着いたら再発行→Supabase SMTP再設定
- アカウント設定不在(将来課題・ユーザー認識済み): 自発的パスワード変更・メール変更・退会が未整備。当面はforgot-passwordで代替
- docs/staging_users_20260806.csv はユーザー一覧のためコミット禁止。docs/配布物(pptx・PDF・インスタ画像)は未追跡のまま
- 将来の招待方式を作る際、共有メモ(APPROVED_SUPPORTERS)の過去データはDBに残っている(表示のみ廃止)
- Stagingテストユーザー: sos01@gmail.com / npo01_1@gmail.com (testpass123)。本番にテスト用SOSアカウント(捨てアドレス)が1つ残存
