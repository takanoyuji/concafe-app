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

## 4. ビルドが遅い場合（40分以上かかる場合）

サーバー上で `docker compose build` すると Next.js のビルドに 40分以上かかることがあります（CPU/メモリが少ないため）。

**すぐ試せること**

- Dockerfile に `NODE_OPTIONS=--max-old-space-size=4096` を入れてあります。サーバーの RAM が 4GB 未満の場合は `2048` に下げてください。
- ビルド時だけメモリを増やす: `NODE_OPTIONS=--max-old-space-size=4096 docker compose build`

**根本的に短くする方法（おすすめ）** → 次の「手元でビルドしてサーバーに渡す運用」を参照。

---

## 4.2 手元でビルドしてサーバーに渡す運用（推奨）

サーバーではビルドせず、手元 PC（WSL）でビルドしたイメージだけ渡して起動します。**方法は2通り**です。

### 方法A: save / load（レジストリ不要・初回が簡単）

**手元 PC（WSL）**
```bash
cd /home/takan/concafe-app
# .env に NEXT_PUBLIC_GA_ID=G-B6LN2JP5N1 を入れておく
chmod +x scripts/build-and-save.sh
./scripts/build-and-save.sh
# → concafe-app.tar ができる（数分〜十数分）

# サーバーに tar を送る（ファイルサイズは 500MB〜1GB 程度）
scp concafe-app.tar ubuntu@219.94.244.166:/opt/apps/concafe-app/
```

**サーバー**
```bash
ssh ubuntu@219.94.244.166
cd /opt/apps/concafe-app
git pull origin main   # docker-compose.pull.yml を最新に

docker load -i concafe-app.tar
# イメージ名を .env に（1回だけ。load で表示された名前を使う）
grep -q '^DOCKER_IMAGE=' .env || echo 'DOCKER_IMAGE=concafe-app-app:latest' >> .env

docker compose down
docker compose -f docker-compose.pull.yml up -d --force-recreate
```

- **メリット**: Docker Hub などのアカウント不要  
- **デメリット**: 毎回 tar を転送するので、回線によっては 5〜15 分かかることがある

---

### 方法B: Docker Hub に push / サーバーで pull（転送が速い）

**1回だけ: Docker Hub にログイン**
```bash
docker login
# ユーザー名・パスワードを入力
```

**手元 PC（WSL）**
```bash
cd /home/takan/concafe-app
# 自分のリポジトリ名に変える（例: takanoyuji/concafe-app）
export DOCKER_IMAGE=takanoyuji/concafe-app:latest
chmod +x scripts/build-and-push.sh
./scripts/build-and-push.sh
```

**サーバー**
```bash
ssh ubuntu@219.94.244.166
cd /opt/apps/concafe-app
git pull origin main

# 初回のみ .env にイメージ名を追加
grep -q '^DOCKER_IMAGE=' .env || echo 'DOCKER_IMAGE=takanoyuji/concafe-app:latest' >> .env

# 初回またはログインが必要な場合
docker login

docker compose down
docker compose -f docker-compose.pull.yml pull
docker compose -f docker-compose.pull.yml up -d --force-recreate
```

- **メリット**: 2回目以降は `pull` だけなのでサーバー側が軽い。転送もレジストリ経由で効率的  
- **デメリット**: Docker Hub（または GHCR）のアカウントと、サーバーからの `docker login` が必要

---

### 共通: サーバーで「ビルドしない」ようにする

- 通常の `docker compose up` ではなく、**必ず `docker compose -f docker-compose.pull.yml` を使う**  
- `deploy-to-server.sh` を「pull のみ」に変えたい場合は、中身を `docker compose -f docker-compose.pull.yml pull` と `up -d` に書き換える

## 5. GA4 が反映されないときの確認

**前提:** `NEXT_PUBLIC_GA_ID` は**ビルド時**に埋め込まれるため、`.env` に追加したあと**必ず再ビルド**が必要です。

1. **本番サイトで GA が読み込まれているか確認**
   - ブラウザで https://test.xing-lang.com を開く
   - 開発者ツール（F12）→ **Network** タブ
   - フィルタに `google` または `gtag` と入力
   - ページを再読み込みし、`googletagmanager.com` や `google-analytics.com` へのリクエストが出ていれば GA は読み込まれている
   - 何も出ない → 再ビルドしていないか、`NEXT_PUBLIC_GA_ID` がビルド時に渡っていない

2. **サーバーで再ビルドしたか確認**
   - `.env` に `NEXT_PUBLIC_GA_ID=G-B6LN2JP5N1` を追加しただけでは不十分
   - `docker compose build --no-cache` してから `docker compose up -d --force-recreate` が必要

3. **広告ブロックを切ってテスト**
   - ブラウザの広告ブロックや Brave などは gtag をブロックすることがある

---

## 6. ビルドが遅い原因を調べる（CPU・メモリ）

サーバー上でビルド中に別ターミナルで以下を実行すると、原因の目安がつきます。

**ビルド開始前にサーバー仕様を確認**
```bash
nproc          # CPU コア数
free -h        # メモリ（合計・使用・空き）
```

**ビルド中にリソース監視（別ターミナルで）**
```bash
# 1秒ごとに CPU/メモリを表示（Ctrl+C で終了）
watch -n 1 'echo "=== $(date) ==="; top -bn1 | head -20'
```

または
```bash
# Docker ビルド時の CPU/メモリ（コンテナ名は状況に応じて）
docker stats --no-stream
```

**ビルド時間の計測**
```bash
cd /opt/apps/concafe-app
time docker compose build --no-cache 2>&1 | tee build.log
```
終了後に `build.log` の最後で `real` の時間を確認。

**リソースをファイルに記録（後から原因分析）**
```bash
# ターミナル1: 10秒ごとに CPU/メモリ/ロードを build-resources.log に追記
chmod +x scripts/log-build-resources.sh
./scripts/log-build-resources.sh

# ターミナル2: ビルド実行
docker compose build --no-cache
```
ビルド終了後、ターミナル1 で Ctrl+C。`build-resources.log` を開くと load/メモリの推移が分かる。

**想定される原因**
- **CPU コアが 1〜2 個** → Next.js のコンパイルが並列化しきれず、40分〜1時間以上かかりやすい
- **メモリ 2GB 未満** → スワップが多発し、極端に遅くなる（`NODE_OPTIONS=--max-old-space-size=2048` で上限をかけてもスワップする場合はさらに遅い）
- **スワップ多用** → `free -h` で Swap の "used" が大きいと、ディスク I/O がボトルネック

根本対策は「4. ビルドが遅い場合」のとおり、**CI や手元 PC でビルドしてイメージを push → サーバーでは pull のみ**にすると、サーバーのスペックに依存しなくなります。

---

## 7. 動作確認（メール）

- サイトの「パスワードを忘れた方」で、SES 検証済みのメールアドレス（例: xinglang22@gmail.com）を入力して送信
- 届いたメールの差出人が `noreply@test.xing-lang.com` になっていることを確認
