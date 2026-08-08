# HANDOFF: 熊本地震 災害SOS(本番リリース完了→拡散フェーズ)
更新: 2026-08-08

## ゴール(完成条件)
熊本地震の被災者と支援団体を災害SOSでマッチングし、市の広報・八代市展開・SNSで利用を広げる。
災害収束時は ACTIVE_DISASTER_EVENT=null で導線を閉じ、平時運用に戻す。

## 現在地
**本番リリース完了・全経路E2E実証済み(2026-08-08)。** コードは main=dev 完全一致。
登録→メール確認→自動ログイン→災害SOS(写真3枚・AIニーズ分類・市町村/校区)→取消まで本番実測OK。
テスト案件2件はCANCELLED処理済み。ここからは「使ってもらう」フェーズ。

## 完了したこと(すべて本番稼働・検証済み)
- 災害SOS本体: 3問フォーム/写真3枚(端末側圧縮+EXIF除去)/AIニーズ分類8種/市町村45+八代市校区20/1案件1団体制/待機時間バッジ/災害・通常タブ分離/期待値管理文言(Topバナー・フォーム・完了画面)
- 正本は src/lib/constants/disaster.ts(イベント・校区・上限すべてconfig-as-code)
- メール基盤: Resend SMTP(samasama.site認証済み)+Supabase上限100通/時。無料枠100通/日
- 本番DB: users/cases に locale 列適用済み(migrations/add_i18n_locale_foundation.sql)・case-photosバケット(private)作成済み
- 配布物: docs/ に市長プレゼンpptx・リーフレットPDF(印刷検証済み)・インスタ画像2種(フィード/ストーリーズ)
- 多言語はコード投入済みだが非公開(LanguageSwitcherフラグ+localeDetection:false)

## 試して失敗したこと ★最重要
- 登録フロー: プロフィールをlocalStorage+ログインフォーム経由で完成させる旧設計
  → メール確認リンクは自動ログインするため完成処理が永遠に走らず全員詰む
  → signUpのuser_metadataに保存しTopページ着地で自動完成する方式に全面変更(hotfix PR#25)
- 本番リリース時に「DB変更なし」と誤判定 → users/cases.locale欠落で登録INSERT全滅
  → migration本番適用で解消。**リリース前のStaging/本番スキーマ差分照合を必須にすること**
- AIニーズ分類が古いintake_qnaスナップショットで書き戻し→並行アップロードの写真参照を消す競合
  → Gemini呼び出し後に最新を再読込してneedsだけ差し込む方式へ
- gemini-2.5-flashはmaxOutputTokensが小さいと思考トークンでJSONが途切れる(実測)
  → 2048+responseMimeType:'application/json' 必須
- FileListはinputと連動する生きたオブジェクト → e.target.value=''で中身が消える
  → awaitや状態更新の前に同期コピー必須
- gh pr edit --base dev が効かずstacked PR(#23)が旧ベースにマージされた
  → origin/feature/disaster-needs をdevへ手動マージで回収。stacked PRのマージは要注意
- ビルド検証はexit codeと静的ページ数(現在115)を見る(grepでの成功判定は過去に事故)

## 次の一手(拡散前の順に)
1. Resend管理画面→Billing→**Proへアップグレード**(無料枠100通/日のままSNS拡散すると確認メールが止まる)
2. Instagram: @seeyou.samasama のプロフィールリンクを https://app.samasama.site に設定
   → docs/インスタ投稿_*.png を投稿(ストーリーズはリンクスタンプ)
3. 市長プレゼンpptxのスライド12連絡先(名前/電話/メール)とリーフレットPDFの問い合わせ欄を記入
4. 八代市に校区「郡築」の表記確認(disaster.tsの1行修正で対応)
5. 技術: スキーマ差分照合スクリプト(read-only本番PG vs Staging)を作りリリース手順に組込み

## 地雷・注意
- **本番Supabaseへの変更操作はユーザー明示許可なしに絶対に実行しない**。こちらはread-only接続のみ保持
- 災害データは全て cases.intake_qna.disaster 配下(migration不要方針)。共通regionsに校区を混ぜない
- 環境差: Stagingはメール確認OFF/本番はON(今回の盲点。後日Staging側もONへ揃える提案済み)
- 多言語再公開はフラグ2箇所(LanguageSwitcher.tsx/routing.ts)。ko/vi/idは緊急語彙ネイティブ確認が前提
- チャットに貼られたResend APIキーは落ち着いたら差し替え(Resendで再発行→Supabase SMTPに再設定)
- 通常フローの複数サポーター制の見え方問題は未解決の将来課題(ユーザー認識済み)
- Stagingテストユーザー: sos01@gmail.com / npo01_1@gmail.com (testpass123)。本番にテスト用SOSアカウント(捨てアドレス)が1つ残存
