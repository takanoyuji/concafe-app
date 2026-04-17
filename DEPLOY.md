# デプロイ手順

手元でビルド・動作確認してから、イメージをサーバに渡して起動する流れです。

---

## 再デプロイ用コマンド（まとめ）

**手元（WSL）で 1 本でビルド〜push まで:**
```bash
chmod +x deploy.sh   # 初回のみ
./deploy.sh
```
※ `NEXT_PUBLIC_GA_ID` を渡してビルドするので、GA が有効なイメージが push されます。

**サーバで pull と起動:**
```bash
ssh ubuntu@219.94.244.166
cd /opt/apps/vliverlab-hp
docker compose -f docker-compose.pull.yml pull
docker compose -f docker-compose.pull.yml up -d --force-recreate
```
※ サーバに `deploy-server.sh` を置いている場合は `./deploy-server.sh` だけでも可。

---

## データ・キャスト画像を壊さないために（必読）

本番は `docker-compose.pull.yml` の **名前付きボリューム `app_data` を `/data` にマウント**しています。

| 置き場所（コンテナ内） | 内容 |
|------------------------|------|
| `/data/dev.db`（`DATABASE_URL` で指定） | SQLite のユーザ・キャスト・メニュー等 |
| `/data/cast-images/`（`CAST_IMAGE_DIR`） | 管理画面アップロードのキャスト画像実体 |

`pull` → `up -d --force-recreate` は **コンテナだけ作り直し、ボリュームはそのまま**なので、通常は DB も画像も残ります。

### 絶対にやらないこと

- `docker compose ... down -v`（`-v` でボリューム削除 → **DB と画像が消える**）
- `docker volume rm ...`（同上）
- 本番で **`compose.yml` の `docker compose build` + `./cast-images` バインド**に切り替える（画像の保存先が `/data/cast-images` とズレて、DB の URL と実ファイルが一致しなくなることがある）

### デプロイ前に推奨（バックアップ）

プロジェクト名はディレクトリ名などで変わるため、**実際のボリューム名は `docker volume ls` で確認**する。

```bash
cd /opt/apps/vliverlab-hp
docker volume ls | grep app_data
# 例: vliverlab-hp_app_data

mkdir -p backups
VOL=vliverlab-hp_app_data   # 上で確認した名前に合わせる

docker run --rm \
  -v "${VOL}:/data:ro" \
  -v "$(pwd)/backups:/backup" \
  alpine \
  sh -c 'tar czf "/backup/app_data_$(date +%Y%m%d_%H%M%S).tar.gz" -C /data .'
```

中身の目安: `dev.db`（または運用中の DB ファイル名）と `cast-images/` 以下にファイルがあること。

### デプロイ後の確認

- トップ・CAST・ギフトで **キャスト画像が表示される**こと
- 管理画面ログイン・ユーザーが消えていないこと

`.env.production` で **`DATABASE_URL` と `CAST_IMAGE_DIR` を変えない**（変える場合はファイルの移行とパスの整合が必要）。

---

## ここからサーバにアップするには（コマンド一覧）

以下、**手元の PC** と **サーバ** で実行するコマンドを順に書きます。  
`YOUR_SERVER` はサーバの SSH（例: `ubuntu@219.94.244.166`）、`/opt/apps/vliverlab-hp` はサーバ上のデプロイ先ディレクトリに読み替えてください。

### 方法A: Docker Hub 経由（push → サーバで pull）

**1. 手元: .env を用意してビルド・push**

```bash
cd /home/takan/vliverlab-hp   # プロジェクトルート（WSL のパスに合わせて変更）

# .env がまだなら作成（NEXT_PUBLIC_BASE_URL を必ず設定）
cp .env.example .env
# ここで .env を編集してから次へ

# ビルド
docker compose build --no-cache

# Docker Hub にログイン（初回またはログアウト後）
docker login
# ユーザー: takanodocker、パスワードを入力

# イメージを push
docker push takanodocker/vliverlab-hp:latest
```

**2. サーバ: リポジトリと .env.production を用意（初回 or 設定変更時）**

```bash
ssh YOUR_SERVER

cd /opt/apps/vliverlab-hp
git pull origin main

# .env.production がない場合は作成（SMTP・JWT など実行時用）
# 例: nano .env.production
```

**3. サーバ: バックアップ（既に稼働中なら推奨）**

```bash
cd /opt/apps/vliverlab-hp
mkdir -p backups
docker volume ls   # ボリューム名を確認（例: vliverlab-hp_app_data）

docker run --rm \
  -v vliverlab-hp_app_data:/data:ro \
  -v "$(pwd)/backups:/backup" \
  alpine \
  tar czf "/backup/app_data_$(date +%Y%m%d_%H%M%S).tar.gz" -C /data .
```

**4. サーバ: イメージを取得して起動**

```bash
cd /opt/apps/vliverlab-hp
docker compose -f docker-compose.pull.yml pull
docker compose -f docker-compose.pull.yml up -d --force-recreate
```

---

### 方法B: tar で送る（save → scp → サーバで load）

**1. 手元: ビルドして tar 出力**

```bash
cd /home/takan/vliverlab-hp
cp .env.example .env   # 未作成なら。編集して NEXT_PUBLIC_BASE_URL を設定

docker compose build --no-cache
docker save takanodocker/vliverlab-hp:latest -o vliverlab-hp-image.tar
```

**2. 手元: サーバに tar を送る**

```bash
scp vliverlab-hp-image.tar YOUR_SERVER:/opt/apps/vliverlab-hp/
# 例: scp vliverlab-hp-image.tar ubuntu@219.94.244.166:/opt/apps/vliverlab-hp/
```

**3. サーバ: バックアップ（既に稼働中なら推奨）**

```bash
ssh YOUR_SERVER
cd /opt/apps/vliverlab-hp
mkdir -p backups
docker volume ls
docker run --rm \
  -v vliverlab-hp_app_data:/data:ro \
  -v "$(pwd)/backups:/backup" \
  alpine \
  tar czf "/backup/app_data_$(date +%Y%m%d_%H%M%S).tar.gz" -C /data .
```

**4. サーバ: イメージを load して起動**

```bash
cd /opt/apps/vliverlab-hp
docker load -i vliverlab-hp-image.tar
docker compose -f docker-compose.pull.yml up -d --force-recreate
```

**5. 手元: 不要になった tar を消してよい**

```bash
rm vliverlab-hp-image.tar
```

---

## 1. 事前に .env を用意する

**ビルド前に**、プロジェクトルートに `.env` を用意し、次の値を入れておく。

- **必須（ビルド時に埋め込まれる）**
  - `NEXT_PUBLIC_BASE_URL` … 本番（またはステージング）の公開 URL（例: `https://vliverlab.com`）。メール内リンクなどに使う。
- **任意**
  - `NEXT_PUBLIC_GA_ID` … Google Analytics 4 の測定 ID。未設定なら計測なし。

```bash
cp .env.example .env
# .env を編集して NEXT_PUBLIC_BASE_URL 等を設定
```

実行時用（SMTP・JWT など）は `.env` に書いておくと `docker compose` の `env_file` でコンテナに渡ります。サーバ用には `.env.production` を用意してもよいです（`docker-compose.pull.yml` は `env_file: .env.production` を参照）。

---

## 2. 手元（WSL/ローカル）でビルド・起動

ローカルで動作確認してからサーバに反映する想定です。

```bash
# ビルド＆起動
docker compose up -d --build

# 確認
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

停止するときは `docker compose down`（ボリュームは残ります）。詳細は [README.md](./README.md#docker-でローカルにビルド・起動) を参照。

---

## 3. イメージをサーバに渡す

手元でビルドしたイメージをサーバで使う方法は次の二通りです。

### 方法A: Docker Hub で push / サーバで pull

1. **手元で Docker Hub にログイン**
   ```bash
   docker login
   # ユーザー: takanodocker
   ```

2. **タグを付けて push**
   ```bash
   docker compose build --no-cache
   docker tag takanodocker/vliverlab-hp:latest takanodocker/vliverlab-hp:latest
   docker push takanodocker/vliverlab-hp:latest
   ```

3. **サーバで pull**
   ```bash
   ssh user@your-server
   cd /opt/apps/vliverlab-hp   # またはデプロイ先
   docker compose -f docker-compose.pull.yml pull
   docker compose -f docker-compose.pull.yml up -d --force-recreate
   ```

### 方法B: tar で保存して scp で送り、サーバで load

1. **手元でイメージを tar に出力**
   ```bash
   docker compose build --no-cache
   docker save takanodocker/vliverlab-hp:latest -o vliverlab-hp-image.tar
   ```

2. **サーバに scp で送る**
   ```bash
   scp vliverlab-hp-image.tar user@your-server:/opt/apps/vliverlab-hp/
   ```

3. **サーバで load**
   ```bash
   ssh user@your-server
   cd /opt/apps/vliverlab-hp
   docker load -i vliverlab-hp-image.tar
   docker compose -f docker-compose.pull.yml up -d --force-recreate
   ```

---

## 4. サーバ側の起動（ビルドなし）

サーバでは **ビルドせず**、イメージの取得（pull または load）と `up` だけにします。

1. リポジトリと設定ファイルを用意（初回または更新時）
   ```bash
   cd /opt/apps/vliverlab-hp
   git pull origin main   # または docker-compose.pull.yml だけコピー
   ```

2. サーバ用 `.env` を用意（`docker-compose.pull.yml` が参照する）
   - リポジトリの `.env.server.example` をコピーして `.env` を作成し、値を入れる。必須は `JWT_SECRET`。メール送信を使う場合は SMTP 関連も設定。

3. 方法A の場合: pull して起動
   ```bash
   docker compose -f docker-compose.pull.yml pull
   docker compose -f docker-compose.pull.yml up -d --force-recreate
   ```

4. 方法B の場合: 上記「方法B」の 3 のとおり `docker load` 後に同じ `up` コマンドを実行。

アプリは `127.0.0.1:3001` でリッスンします。リバースプロキシ（nginx 等）で 443 に振る想定です。

### サーバの .env に入れる内容

| 変数 | 必須 | 説明 |
|------|------|------|
| `JWT_SECRET` | ○ | セッション用の秘密鍵。本番ではランダムな長い文字列にすること。 |
| `SMTP_HOST` | メール送信するなら | SMTP サーバのホスト（例: `email-smtp.ap-northeast-1.amazonaws.com`） |
| `SMTP_PORT` |  | 通常 `587` |
| `SMTP_USER` |  | SMTP 認証ユーザー |
| `SMTP_PASS` |  | SMTP 認証パスワード |
| `SMTP_FROM` |  | 送信元メールアドレス（例: `noreply@vliverlab.com`） |

- `NODE_ENV` と `DATABASE_URL` は compose 側で指定しているため、.env に書かなくてよい。
- テンプレート: リポジトリの **`.env.server.example`** をコピーして `.env` を作成し、上記を埋める。

---

## 5. データ永続化とバックアップ

- **永続化**: DB（SQLite）とアップロードファイル（キャスト画像）は Docker の名前付きボリューム `app_data` の `/data` に保存しています。`docker compose up -d --force-recreate` でコンテナを再作成してもデータは消えません。
- **バックアップ**: デプロイ前にボリュームのバックアップを取ることを推奨します。

### デプロイ前のバックアップ手順（サーバで実行）

```bash
cd /opt/apps/vliverlab-hp
mkdir -p backups

# ボリューム app_data を tar で取得（コンテナは起動したままでも可）
# ボリューム名は docker volume ls で確認（例: vliverlab-hp_app_data）
docker run --rm \
  -v vliverlab-hp_app_data:/data:ro \
  -v "$(pwd)/backups:/backup" \
  alpine \
  tar czf "/backup/app_data_$(date +%Y%m%d_%H%M%S).tar.gz" -C /data .

# 必要に応じて別サーバや S3 にコピー
```

リストアするときは、同じボリューム名で compose を使っている前提で:

```bash
docker compose -f docker-compose.pull.yml down
docker run --rm \
  -v vliverlab-hp_app_data:/data \
  -v "$(pwd)/backups:/backup" \
  alpine \
  sh -c "cd /data && tar xzf /backup/app_data_YYYYMMDD_HHMMSS.tar.gz"
docker compose -f docker-compose.pull.yml up -d
```

---

## まとめ

| 作業 | 手元 | サーバ |
|------|------|--------|
| .env | 事前に `NEXT_PUBLIC_BASE_URL` 等を設定 | `.env.production` に SMTP 等 |
| ビルド | `docker compose up -d --build` | しない |
| イメージ渡し | 方法A: push / 方法B: save → scp | 方法A: pull / 方法B: load |
| 起動 | `docker compose up -d` | `docker compose -f docker-compose.pull.yml pull && docker compose -f docker-compose.pull.yml up -d` |
| バックアップ | — | デプロイ前に `app_data` を tar で取得 |
