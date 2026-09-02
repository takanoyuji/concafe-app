# 運用・インシデント対応ガイド

## ボリューム設計

アプリが永続化するデータはすべて `/data` 配下に入る。Dockerボリューム名は **`app_data`** に統一。

```
/data/
  concafe.db        ← SQLite DB
  cast/             ← キャスト画像 (API: /api/cast-image/:filename)
  menu/             ← メニュー画像 (API: /api/menu-image/:filename)
```

> **注意**: `compose.yml` の volumes は必ず `app_data:/data` の1行のみ。
> `upload-data` や `db-data` など別名のボリュームを追加してはいけない。
> アップロードAPIも `/data/cast` に直接書くため、サイドカーボリュームは不要。

---

## デプロイ手順

### 通常デプロイ（イメージをpull）

```bash
ssh prod-server-deploy
cd /opt/apps/concafe-app

# 必ずバックアップを取ってから作業する
./scripts/backup-db.sh

git pull origin main
docker compose -f docker-compose.pull.yml pull
docker compose -f docker-compose.pull.yml up -d --force-recreate
docker compose ps
```

### compose ファイルの使い分け

| ファイル | 用途 |
|---|---|
| `compose.yml` | **本番サーバー用**（サーバー上でビルド） |
| `docker-compose.yml` | **ローカル開発用**（ローカルでビルド） |
| `docker-compose.pull.yml` | **本番デプロイ用**（ビルド済みイメージをpull） |

> **重要**: サーバーに複数の compose ファイルが存在する場合、Docker Compose は
> `compose.yml` を優先する。`docker-compose.yml` が残っていると警告が出るため、
> サーバーには `compose.yml` と `docker-compose.pull.yml` のみ置く。

---

## バックアップ

### 自動バックアップ（サーバー内）
- **スケジュール**: 毎日 19:00 JST（cron: `0 19 * * *`。サーバーのTZは Asia/Tokyo）
- **保存先**: `/opt/apps/concafe-app/backups/`
  - `concafe_YYYYMMDD_HHMMSS.db` — DB本体
  - `airregi-raw_YYYYMMDD_HHMMSS.tar.gz` — Airレジの生JSON（2026-09-02 追加）
- **保持期間**: 30日分（2026-09-02 に7日から延長。DB 3.7MB + 生JSON 0.6MB なので容量は誤差）
- **ログ**: `/opt/apps/concafe-app/backups/backup.log`

### ⚠️ サーバー外への退避（手動）

**上のバックアップは同じディスク上のコピー。誤削除・誤上書きからは守れるが、サーバーが飛べば一緒に消える。**
concafe のDBにはキャスト・ポイント履歴・給与履歴が入っており、外部にコピーが無いのは危ない。

手元（WSL）へ落とす。**`--delete` は付けない**。サーバー側で消えても手元に残すため。

```bash
mkdir -p ~/backup/concafe/airregi-raw ~/backup/concafe/db
rsync -a prod-server-deploy:/opt/apps/concafe-app/airregi-raw/ ~/backup/concafe/airregi-raw/
rsync -a prod-server-deploy:/opt/apps/concafe-app/backups/   ~/backup/concafe/db/
```

WSLは常時起動ではないので cron で自動化しても抜ける。**週1くらいで手で叩く**か、
Windowsのタスクスケジューラから WSL を起こす形にする。

**Airレジの生JSONは、消すと二度と取り直せない。** APIが62日より前を遡れないため。
ただしパース済みのデータは `AirRegiTransaction` 等としてDBに入っているので、
生JSONの用途は「後からパースの誤りに気づいたときのやり直し」に限られる。

### 手動バックアップ
```bash
ssh prod-server-deploy
/opt/apps/concafe-app/scripts/backup-db.sh
```

### バックアップの確認
```bash
ssh prod-server-deploy "ls -lh /opt/apps/concafe-app/backups/"
```

---

## DB復旧手順

### 1. 現状確認
```bash
ssh prod-server-deploy
docker cp concafe-app-app-1:/data/concafe.db /tmp/check.db
sqlite3 /tmp/check.db 'SELECT role, COUNT(*) FROM User GROUP BY role;'
```

### 2. バックアップから復元
```bash
# バックアップ一覧
ls -lh /opt/apps/concafe-app/backups/

# コンテナ内DBを置き換え（サービス停止不要）
docker cp /opt/apps/concafe-app/backups/concafe_YYYYMMDD_HHMMSS.db \
  concafe-app-app-1:/data/concafe.db

# コンテナ再起動（DBコネクションをリセット）
docker restart concafe-app-app-1
```

### 3. 復元確認
```bash
docker cp concafe-app-app-1:/data/concafe.db /tmp/verify.db
sqlite3 /tmp/verify.db 'SELECT role, COUNT(*) FROM User GROUP BY role;'
```

---

## インシデント記録

### 2026-07-06 〜 2026-07-10: 顧客データ大量消失

**発生**: 7月6日の給与計算機能デプロイ時

**原因**:
- 旧 `docker-compose.yml` は `app_data:/data` ボリュームを使用していた
- 新 `compose.yml` が `db-data:/data` + `upload-data:/app/public/images/cast` という
  別名・別設計のボリュームに切り替わった
- `db-data` は新規空ボリュームだったためPrismaがマイグレーションを一から実行し、
  データがゼロの状態でサービスが再起動した
- `upload-data` は実際には使われない（APIは `/data/cast` を読むため）

**影響**:
- 顧客データ: 359名 → 21名（338名が見えなくなった）
- ポイント履歴: 1730件 → 0件

**復旧**:
- 旧ボリューム `concafe-app_app_data` にデータが残存していたため完全復旧
- DB内容: 359名 + 7/7以降の新規2名 = 361名
- 7/7〜7/9に別メールで再登録した7名は旧アカウントのパスワードを最新に更新

**対処**:
1. `compose.yml` を `app_data:/data` 単一ボリュームに修正
2. サーバーの `docker-compose.yml`（別名ボリューム）を削除
3. 日次自動バックアップ cron を設定

**教訓**:
- デプロイ前に必ずバックアップを取る
- compose ファイルのボリューム名変更はデータ消失につながる
- `docker volume ls` でボリューム名のズレを事前確認する

---

## よく使うコマンド

```bash
# ログ確認
ssh prod-server "journalctl -u docker --since '1 hour ago'"

# コンテナ状態
ssh prod-server-deploy "docker compose -f /opt/apps/concafe-app/compose.yml ps"

# DBのテーブル・レコード数確認
ssh prod-server-deploy "
  docker cp concafe-app-app-1:/data/concafe.db /tmp/q.db
  sqlite3 /tmp/q.db '.tables'
  sqlite3 /tmp/q.db 'SELECT role, COUNT(*) FROM User GROUP BY role;'
  sqlite3 /tmp/q.db 'SELECT COUNT(*) FROM PointLedger;'
"

# Dockerボリューム一覧（ボリューム名のズレ確認用）
ssh prod-server-deploy "docker volume ls | grep concafe"
```
