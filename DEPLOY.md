# サーバーへデプロイしてメール送信を有効にする

## 1. ローカルでコードを GitHub にプッシュ

```bash
cd /home/takan/concafe-app   # またはプロジェクトのパス
git add lib/email.ts deploy-to-server.sh DEPLOY.md
git commit -m "fix: SMTP送信元デフォルトを noreply@test.xing-lang.com に、デプロイ手順を追加"
git push origin main
```

## 2. サーバーに SSH してコード反映・再起動

```bash
ssh ubuntu@219.94.244.166
```

ログイン後:

```bash
cd /opt/apps/concafe-app

# コードを取得
git pull origin main

# .env に送信元を設定（まだなら追加）
grep -q "^SMTP_FROM=" .env || echo "SMTP_FROM=noreply@test.xing-lang.com" >> .env

# 再ビルド・再起動
docker compose build --no-cache
docker compose up -d --force-recreate
```

または、`deploy-to-server.sh` をサーバーに置いている場合は:

```bash
cd /opt/apps/concafe-app
git pull origin main
chmod +x deploy-to-server.sh
./deploy-to-server.sh
```

## 3. 送信に必要な .env の例

サーバーの `/opt/apps/concafe-app/.env` に以下が入っていること:

```env
SMTP_HOST=email-smtp.ap-northeast-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=（SESのSMTPユーザー名）
SMTP_PASS=（SESのSMTPパスワード）
SMTP_FROM=noreply@test.xing-lang.com
NEXT_PUBLIC_BASE_URL=https://test.xing-lang.com
```

## 4. 動作確認

- サイトの「パスワードを忘れた方」で、SES 検証済みのメールアドレス（例: xinglang22@gmail.com）を入力して送信
- 届いたメールの差出人が `noreply@test.xing-lang.com` になっていることを確認
