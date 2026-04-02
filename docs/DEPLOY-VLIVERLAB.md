# vliverlab.com デプロイ続き（Cursor から実行）

ここまでの状態:
- サーバー: `219.94.244.166`
- コンテナ: `/opt/apps/vliverlab-hp`、ポート `3001`
- nginx: `vliverlab.com` / `www.vliverlab.com` で HTTP → 3001 にプロキシ済み
- DNS: お名前.com で A レコード `@` / `www` → `219.94.244.166` に設定済み

---

## Step 6 — SSL 証明書の取得（certbot）

DNS が `219.94.244.166` に伝播していることを確認してから実行する。

### 6-1. DNS 確認（ローカル WSL で）

```bash
curl -s "https://dns.google/resolve?name=vliverlab.com&type=A" | grep -o '"data":"[^"]*"'
# 期待: "data":"219.94.244.166"
```

### 6-2. サーバーに SSH

```bash
ssh ubuntu@219.94.244.166
```

### 6-3. certbot で証明書取得

```bash
sudo certbot --nginx -d vliverlab.com -d www.vliverlab.com
```

- メールアドレス入力・利用規約の同意（Y）
- 既存証明書がある場合は「拡張」か「新規」を選ぶ（vliverlab.com 用は新規）
- 完了後、nginx が自動で HTTPS に切り替わる

### 6-4. nginx リロード確認

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## certbot が「DNS problem: query timed out」で失敗する場合

Let's Encrypt のサーバーから `vliverlab.com` の DNS が引けない・タイムアウトしている状態です。

### 確認（サーバーに SSH した状態で）

```bash
# サーバー自身で名前解決できるか
getent hosts vliverlab.com
# または
dig vliverlab.com A +short
```

- **219.94.244.166 が表示される** → サーバーからは解決できている。Let's Encrypt 側の伝播遅れの可能性が高い。
- **何も出ない / タイムアウト** → サーバーの DNS 設定（systemd-resolved 等）がお名前.com の NS に届いていない可能性。

### 対処

1. **時間をおいて再実行（推奨）**  
   数時間〜24時間後に、もう一度:
   ```bash
   sudo certbot --nginx -d vliverlab.com -d www.vliverlab.com
   ```

2. **DNS チャレンジで取得する**  
   HTTP ではなく TXT レコードで検証する方法です。お名前.com で TXT レコードを1本追加する必要があります。
   ```bash
   sudo certbot certonly --manual --preferred-challenges dns -d vliverlab.com -d www.vliverlab.com
   ```
   表示された `_acme-challenge.vliverlab.com` 用の TXT 値を、お名前.com の DNS 設定に追加 → 伝播後、certbot のプロンプトで Enter。

3. **サーバーで外部 DNS を使ってみる**  
   サーバーの resolv.conf がお名前.com NS だけ向いていて遅い場合、一時的に 8.8.8.8 を使う方法もあります（運用は自己責任で）。
   ```bash
   # 確認のみ（変更はしない）
   cat /etc/resolv.conf
   ```

---

## Step 7 — 動作確認

- ブラウザで `https://vliverlab.com` と `https://www.vliverlab.com` を開く
- 証明書エラーなく表示されれば完了

---

## よく使うコマンド（サーバー上）

```bash
# コンテナ状態
cd /opt/apps/vliverlab-hp && docker compose ps

# ログ
docker compose logs -f --tail=50

# 再起動
docker compose up -d --force-recreate
```

## 再デプロイ（コード更新時）

ローカル WSL で:

```bash
rsync -avz --progress \
  --exclude 'node_modules' --exclude '.next' --exclude '*.db' \
  --exclude '.env' --exclude '.env.local' --exclude 'cast-images' \
  /home/takan/vliverlab-hp/ \
  ubuntu@219.94.244.166:/opt/apps/vliverlab-hp/
```

サーバーで:

```bash
cd /opt/apps/vliverlab-hp
docker compose build
docker compose up -d --force-recreate
```
