# サーバーへデプロイしてメール送信を有効にする

## 今すぐやる手順（ローカルで Docker 起動 → サーバに反映）

サーバー上でビルドすると時間がかかるため、**ローカルで Docker を立ち上げてから**イメージをサーバに渡します。

### ローカル（手元 PC）

```bash
cd /home/takan/concafe-app   # またはプロジェクトのパス

# 1) ローカルでビルド・起動して動作確認（任意だが推奨）
docker compose up --build -d
# → http://localhost:3000 で確認後
docker compose down

# 2) イメージをビルドしてレジストリに push（方法B の場合）
# 事前: .env に NEXT_PUBLIC_GA_ID を入れておく。docker login 済みであること。
chmod +x scripts/build-and-push.sh
./scripts/build-and-push.sh
```

- **Docker Hub を使わない場合**（save/load）は、下記「方法A」の `scripts/build-and-save.sh` を使い、生成された `concafe-app.tar` をサーバに `scp` してください。

### サーバー

```bash
ssh ubuntu@219.94.244.166
cd /opt/apps/concafe-app
git pull origin main

# 初回のみ .env にイメージ名を追加（方法B の場合）
grep -q '^DOCKER_IMAGE=' .env || echo 'DOCKER_IMAGE=takanoyuji/concafe-app:latest' >> .env

# Resend 用の環境変数を追加（まだなければ）
grep -q '^RESEND_API_KEY=' .env || echo 'RESEND_API_KEY=re_5tvahnqq_ES4juXVkCq1ga9C7nY8HDvR3' >> .env
grep -q '^MAIL_FROM=' .env    || echo 'MAIL_FROM=星狼 <info@mail.xing-lang.com>' >> .env
# NEXT_PUBLIC_BASE_URL を本番ドメインに更新（localhost になっていると認証メールのリンクが壊れる）
grep -q '^NEXT_PUBLIC_BASE_URL=' .env \
  && sed -i 's|^NEXT_PUBLIC_BASE_URL=.*|NEXT_PUBLIC_BASE_URL=https://xing-lang.com|' .env \
  || echo 'NEXT_PUBLIC_BASE_URL=https://xing-lang.com' >> .env

docker compose down
docker compose -f docker-compose.pull.yml pull
docker compose -f docker-compose.pull.yml up -d --force-recreate
```

---

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

# Resend 用の環境変数を追加（まだなければ）
grep -q '^RESEND_API_KEY=' .env || echo 'RESEND_API_KEY=re_5tvahnqq_ES4juXVkCq1ga9C7nY8HDvR3' >> .env
grep -q '^MAIL_FROM=' .env    || echo 'MAIL_FROM=星狼 <info@mail.xing-lang.com>' >> .env
grep -q '^NEXT_PUBLIC_BASE_URL=' .env \
  && sed -i 's|^NEXT_PUBLIC_BASE_URL=.*|NEXT_PUBLIC_BASE_URL=https://xing-lang.com|' .env \
  || echo 'NEXT_PUBLIC_BASE_URL=https://xing-lang.com' >> .env

# 再ビルド・再起動（サーバーでビルドする場合）
docker compose build --no-cache
docker compose up -d --force-recreate
```

## 3. 送信に必要な .env の例

サーバーの `/opt/apps/concafe-app/.env` に以下が入っていること:

```env
# Resend（メール送信 - SMTP から移行済み）
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx   # Resend ダッシュボードから取得
MAIL_FROM=星狼 <info@mail.xing-lang.com>

# アプリ
NEXT_PUBLIC_BASE_URL=https://xing-lang.com   # ← 必ず本番ドメインに。localhost のままだとメールリンクが壊れる
```

> **注意:** SMTP（AWS SES）は Resend に移行済みです。`SMTP_HOST` 等は不要です。
> Resend ダッシュボード（resend.com）で `mail.xing-lang.com` のドメイン認証（DNS の SPF/DKIM）が完了していることを確認してください。

## 3.2 キャストデータの永続化とバックアップ

**なぜ消えたか:** 以前は DB がコンテナ内（`/app`）にあり、`docker compose up -d --force-recreate` でコンテナを作り直すとコンテナごと消えていました。現在は **DB を永続ボリューム `/data` に保存**するようにしてあり、イメージの差し替えやコンテナの再作成では消えません。

- **DB ファイル**: イメージのデフォルトで `file:/data/concafe.db`。ボリューム `app_data` が `/data` にマウントされているため、コンテナを消してもデータは残ります。
- **キャスト画像**: `/data/cast` にアップロードされた画像も同じボリューム内にあります。

**今後のデプロイ前にバックアップしたい場合（推奨）:**

```bash
# サーバーで実行
cd /opt/apps/concafe-app
# DB のみバックアップ（簡単）
docker compose -f docker-compose.pull.yml exec app cat /data/concafe.db > backup_$(date +%Y%m%d).db
# ボリューム名が不明な場合は docker volume ls で concafe-app_app_data などを確認
# ボリューム全体を tar で取得（キャスト画像も含む）
docker run --rm -v concafe-app_app_data:/data -v $(pwd):/backup alpine tar czf /backup/app_data_backup_$(date +%Y%m%d).tar.gz -C /data .
```

バックアップから DB だけ復元する例:

```bash
# コンテナを止めてから
docker compose -f docker-compose.pull.yml down
docker run --rm -v concafe-app_app_data:/data -v $(pwd):/backup alpine sh -c "cp /backup/backup_YYYYMMDD.db /data/concafe.db"
docker compose -f docker-compose.pull.yml up -d
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

# Resend 用の環境変数を追加（まだなければ）
grep -q '^RESEND_API_KEY=' .env || echo 'RESEND_API_KEY=re_5tvahnqq_ES4juXVkCq1ga9C7nY8HDvR3' >> .env
grep -q '^MAIL_FROM=' .env    || echo 'MAIL_FROM=星狼 <info@mail.xing-lang.com>' >> .env
grep -q '^NEXT_PUBLIC_BASE_URL=' .env \
  && sed -i 's|^NEXT_PUBLIC_BASE_URL=.*|NEXT_PUBLIC_BASE_URL=https://xing-lang.com|' .env \
  || echo 'NEXT_PUBLIC_BASE_URL=https://xing-lang.com' >> .env

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

デプロイ後、以下でメール送信が正常かを確認してください。

```bash
# テストメール送信（宛先は自分のアドレスに変更）
curl -X POST https://xing-lang.com/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com"}'
# → {"success":true} が返ればOK
```

- コンテナログで確認: `docker compose -f docker-compose.pull.yml logs -f app`
  - 成功: `[EMAIL] 送信成功 message_id: xxx`
  - 失敗: `[EMAIL] 送信失敗: ...` のエラーが出る
- Resend ダッシュボード（resend.com → Emails）でも送信履歴が確認できます
- 届いたメールの差出人が `星狼 <info@mail.xing-lang.com>` になっていることを確認

### トラブルシュート

| 症状 | 原因 | 対処 |
|---|---|---|
| `RESEND_API_KEY が未設定です` | サーバーの `.env` に `RESEND_API_KEY` がない | `.env` に追記して `docker compose up -d --force-recreate` |
| `{"success":false,"error":"メール送信タイムアウト"}` | サーバーから `api.resend.com` に繋がらない | ファイアウォールでアウトバウンド 443 を許可する |
| メール内リンクが `http://localhost:3000/...` | `NEXT_PUBLIC_BASE_URL` が未設定 | `.env` に `NEXT_PUBLIC_BASE_URL=https://xing-lang.com` を追加 |
| `401 Unauthorized` | API キーが無効 | Resend ダッシュボードでキーを確認・再発行 |
