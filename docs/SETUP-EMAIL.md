# メール送信を有効にする手順

## 前提

- AWS SES でドメイン `test.xing-lang.com` と送信先アドレス（例: xinglang22@gmail.com）は検証済み
- SES の SMTP 認証情報（ユーザー名・パスワード）を取得済み

---

## 1. サーバーで .env を用意する

SSH でサーバーに入り、`/opt/apps/concafe-app/.env` に次を書く（既にある行は上書きまたは追記）。

```env
# SES（東京リージョン）
SMTP_HOST=email-smtp.ap-northeast-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=（SESのSMTPユーザー名）
SMTP_PASS=（SESのSMTPパスワード）
SMTP_FROM=noreply@test.xing-lang.com

# メール内リンクのベースURL
NEXT_PUBLIC_BASE_URL=https://test.xing-lang.com
```

`SMTP_USER` と `SMTP_PASS` は SES の「SMTP 設定」→「SMTP 認証情報を作成」で表示された値。

---

## 2. Compose で .env をコンテナに渡す

`/opt/apps/concafe-app/compose.yml`（または `docker-compose.yml`）を開き、**アプリのサービス**に `env_file` を追加。

```yaml
services:
  app:   # あなたのサービス名（web などでも可）
    build: .
    # ... 他の設定 ...
    env_file: .env
```

保存する。

---

## 3. コードを最新にして再起動

```bash
cd /opt/apps/concafe-app
git pull origin main
docker compose build --no-cache
docker compose up -d --force-recreate
```

---

## 4. 設定が読めているか確認（任意）

```bash
curl -s http://127.0.0.1:3000/api/debug/smtp
```

`"smtpConfigured": true` かつ `"from": "noreply@test.xing-lang.com"` なら OK。

またはブラウザで:  
https://test.xing-lang.com/api/debug/smtp

---

## 5. 送信テスト

1. https://test.xing-lang.com で「パスワードを忘れた方」を開く
2. SES で検証済みのメールアドレス（例: xinglang22@gmail.com）を入力して送信
3. そのアドレスの受信トレイ（と迷惑メール）を確認

届けば完了。届かない場合は `docker compose logs --tail 50` で `[EMAIL]` や `[DEV EMAIL]` のログを確認する。

---

## チェックリスト

- [ ] .env に SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, NEXT_PUBLIC_BASE_URL を書いた
- [ ] compose のアプリサービスに `env_file: .env` を追加した
- [ ] `git pull` して `docker compose up -d --force-recreate` した
- [ ] /api/debug/smtp で smtpConfigured: true を確認した
- [ ] 検証済みアドレスでパスワードリセットを送ってメールが届くか確認した
