# メンテナンスモード運用

## 目的

Production DB変更中に、相談投稿・プロフィール保存・メッセージ送信などの書き込み操作が同時に走ることを防ぐ。

強制ログアウトは行わない。
ユーザーのセッションは維持し、メンテナンス終了後にそのまま利用再開できるようにする。

## 環境変数

| 変数 | 用途 |
|---|---|
| `MAINTENANCE_MODE` | `true` のときメンテナンスモードを有効化 |
| `MAINTENANCE_BYPASS_TOKEN` | 運営確認用の一時バイパスCookie発行トークン |

`MAINTENANCE_BYPASS_TOKEN` は任意。
設定しない場合、全ユーザーがメンテナンス画面へ誘導される。

Vercelの環境変数変更は、通常は再デプロイ後のアプリに反映される。
ON/OFFの切り替えは、環境変数更新と再デプロイをセットで扱う。

## 挙動

- 通常ページは `/maintenance` へリダイレクトする。
- `/api/*` は原則 `503` を返す。
- `/api/health` はメンテナンス中も利用できる。
- `/api/maintenance-bypass` は運営確認用に利用できる。
- 静的ファイルとNext.js内部アセットは除外する。

## Stagingでのテスト

1. Vercel Staging環境変数へ `MAINTENANCE_MODE=true` を設定する。
2. Stagingへ再デプロイする。
3. 通常ブラウザでStaging URLへアクセスし、`/maintenance` へ誘導されることを確認する。
4. `/api/health` を開き、`maintenance: true` を確認する。
5. `MAINTENANCE_BYPASS_TOKEN` を設定している場合、以下へアクセスする。

```text
/api/maintenance-bypass?token=<MAINTENANCE_BYPASS_TOKEN>&redirect=/
```

6. 同じブラウザで通常画面を確認する。
7. 別ブラウザまたはシークレットウィンドウでは、引き続き `/maintenance` に誘導されることを確認する。
8. `MAINTENANCE_MODE=false` または未設定へ戻し、通常画面へ戻ることを確認する。

## Production DB作業時の流れ

1. Productionへ `MAINTENANCE_MODE=true` を設定する。
2. Productionを再デプロイし、通常ユーザーが `/maintenance` へ誘導されることを確認する。
3. Production SupabaseのProject Refを確認する。
4. DBバックアップを取得する。
5. SQLを1本ずつ実行する。
6. 適用後確認SQLを実行する。
7. バイパスCookieを使って運営確認する。
8. 問題なければ `MAINTENANCE_MODE=false` または未設定へ戻す。

## 注意

- `dev` でDB migrationを実行しても、Production DBには反映されない。
- `main` へコードを反映しても、Production DBのSQL実行は別作業。
- メンテナンスモードはユーザー操作を止めるための仕組みであり、DBバックアップやrollbackの代わりにはならない。
