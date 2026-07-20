#!/bin/bash
# concafe DB 自動バックアップ
# 毎日AM4:00 cron で実行される
set -e

BACKUP_DIR="/opt/apps/concafe-app/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/concafe_${DATE}.db"
CONTAINER="concafe-app-app-1"
KEEP_DAYS=7

# コンテナが起動しているか確認
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[$(date)] ERROR: コンテナ ${CONTAINER} が起動していません" >&2
  exit 1
fi

# DBをバックアップ
docker cp "${CONTAINER}:/data/concafe.db" "${BACKUP_FILE}"
echo "[$(date)] バックアップ完了: ${BACKUP_FILE} ($(du -h ${BACKUP_FILE} | cut -f1))"

# 古いバックアップを削除 (7日より古いもの)
find "${BACKUP_DIR}" -name 'concafe_*.db' -mtime +${KEEP_DAYS} -delete
echo "[$(date)] ${KEEP_DAYS}日以上前のバックアップを削除しました"
