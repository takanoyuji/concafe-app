# メールが送れないときの確認手順

## 1. サーバーで診断スクリプトを実行

```bash
ssh ubuntu@219.94.244.166
cd /opt/apps/concafe-app
git pull origin main   # 最新にしておく
bash scripts/check-smtp-on-server.sh
```

- **smtpConfigured: false** なら、コンテナに環境変数が渡っていません（下記「2. compose で .env を渡す」を実施）。
- **smtpConfigured: true** なのに届かない場合は、ログに `[EMAIL] sendPasswordResetEmail failed:` が出ていないか確認。

## 2. Docker Compose で .env をコンテナに渡す

コンテナ内で `process.env.SMTP_HOST` が空だとメール送信されません。  
`/opt/apps/concafe-app/compose.yml`（または `docker-compose.yml`）の **アプリ用サービス** に次を追加してください。

```yaml
services:
  app:   # または web / あなたのサービス名
    # ...
    env_file: .env
    # または
    environment:
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - SMTP_FROM=${SMTP_FROM}
      - NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
```

**修正後は必ず再起動:**

```bash
docker compose up -d --force-recreate
```

## 3. ブラウザでデバッグ API を叩く

本番 URL で（認証なしで）確認用に:

```
https://test.xing-lang.com/api/debug/smtp
```

- `smtpConfigured: true` かつ `from: "noreply@test.xing-lang.com"` なら、アプリからは SMTP 設定が読めています。
- `smtpConfigured: false` なら、上記 2 のとおり compose の `env_file` / `environment` を確認してください。

## 4. 送信時のエラーをログで確認

パスワードリセットを一度送信したあと:

```bash
docker compose logs --tail 50
```

- `[EMAIL] sendPasswordResetEmail failed:` のあとに出ているエラーが原因です（認証失敗・ネットワーク・SES の拒否など）。
- `[DEV EMAIL] パスワードリセットリンク` だけ出ている場合は、**SMTP が未設定**（getTransport() が null）なので、2 を実施してください。

## 5. よくある原因

| 症状 | 原因 | 対処 |
|------|------|------|
| 画面に「リセットリンク」が表示される | コンテナに SMTP_* が渡っていない | compose に `env_file: .env` を追加して再起動 |
| 500 エラーになる | 送信で例外（認証失敗など） | ログの `[EMAIL] ... failed:` を確認。SES の SMTP ユーザー/パスワード・送信元アドレスを確認 |
| 送信成功と表示されるが届かない | 迷惑メールフォルダ、SES サンドボックス | 宛先を SES で検証済みに。迷惑メールを確認 |
