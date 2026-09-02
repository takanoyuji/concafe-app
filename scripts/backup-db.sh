#!/bin/bash
# concafe のバックアップ（DB + Airレジ生JSON）
# 毎日 19:00 JST に cron で実行される
#
# ⚠️ ここで作るのは同じディスク上のコピーなので、サーバーが飛べば一緒に消える。
# 誤削除・誤上書きからは守れるが、障害からは守れない。
# サーバー外への退避は手元から rsync で行う（docs/OPERATIONS.md 参照）。
set -e

BACKUP_DIR="/opt/apps/concafe-app/backups"
RAW_DIR="/opt/apps/concafe-app/airregi-raw"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/concafe_${DATE}.db"
RAW_FILE="${BACKUP_DIR}/airregi-raw_${DATE}.tar.gz"
CONTAINER="concafe-app-app-1"
# 30日。DBは1.4MB程度、生JSONは62日ぶんで1.1MBなので、伸ばしても容量は誤差
KEEP_DAYS=30

# コンテナが起動しているか確認
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[$(date)] ERROR: コンテナ ${CONTAINER} が起動していません" >&2
  exit 1
fi

# DBをバックアップ
docker cp "${CONTAINER}:/data/concafe.db" "${BACKUP_FILE}"
echo "[$(date)] DB: ${BACKUP_FILE} ($(du -h ${BACKUP_FILE} | cut -f1))"

# Airレジの生JSONをバックアップ。
# パース済みのデータはDBに入っているので、これは「後からパースを直したくなったとき」用。
# ただし Airレジ API は62日より前を遡れないため、消すと二度と取り直せない。
if [ -d "$RAW_DIR" ]; then
  tar -czf "${RAW_FILE}" -C "$(dirname "$RAW_DIR")" "$(basename "$RAW_DIR")"
  echo "[$(date)] Airレジ生JSON: ${RAW_FILE} ($(du -h ${RAW_FILE} | cut -f1))"
else
  echo "[$(date)] WARN: ${RAW_DIR} がありません。Airレジの取得が動いていない可能性があります" >&2
fi

# 古いバックアップを削除
find "${BACKUP_DIR}" -name 'concafe_*.db' -mtime +${KEEP_DAYS} -delete
find "${BACKUP_DIR}" -name 'airregi-raw_*.tar.gz' -mtime +${KEEP_DAYS} -delete
echo "[$(date)] ${KEEP_DAYS}日以上前のバックアップを削除しました"
