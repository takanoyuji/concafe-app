# メールが送れないとき・今すぐやる確認

## 1. サーバーでコードを最新にする

```bash
cd /opt/apps/concafe-app
git pull origin main
docker compose build --no-cache
docker compose up -d --force-recreate
```

## 2. 「SMTP が読めているか」を確認

```bash
curl -s http://127.0.0.1:3000/api/debug/smtp
```

- **`"smtpConfigured": false`** の場合  
  → コンテナに .env が渡っていません。  
  **compose.yml のアプリサービスに `env_file: .env` を追加**し、もう一度 `docker compose up -d --force-recreate` してください。

- **`"smtpConfigured": true`** の場合  
  → 設定は読めているので、次の「3. テスト送信」へ。

## 3. テスト送信でエラー内容を確認

```bash
curl -s -X POST http://127.0.0.1:3000/api/debug/send-test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"xinglang22@gmail.com"}'
```

- **`"ok": true`**  
  → 送信できています。xinglang22@gmail.com の受信トレイ（迷惑メール含む）を確認してください。

- **`"ok": false`** かつ **`"error": "SMTP未設定"`**  
  → 2 のとおり、compose で `env_file: .env` を渡してください。

- **`"ok": false`** かつ **別の error メッセージ**  
  → そのメッセージが原因です。例:
  - 認証エラー → SMTP_USER / SMTP_PASS を確認（SES の「SMTP 認証情報」の値）
  - Connection timeout / ECONNREFUSED → ファイアウォールで 587 が塞がれていないか、SMTP_HOST のリージョンが正しいか確認
  - MessageRejected / 554 など → SES の送信元・送信先が検証済みか、サンドボックス制限を確認

**この 3 の curl の結果（JSON 全文）をコピーして共有してもらえれば、次の対処を具体的に案内できます。**

## 4. compose に .env を渡す（2 で smtpConfigured: false だった場合）

`/opt/apps/concafe-app/compose.yml` を編集し、アプリのサービスに 1 行追加:

```yaml
services:
  app:    # または web など、あなたのサービス名
    build: .
    env_file: .env
    # ... 他はそのまま
```

保存後:

```bash
docker compose up -d --force-recreate
```

再度 2 と 3 を実行してください。
