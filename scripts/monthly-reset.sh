#!/bin/bash
# 月次ポイントリセットスクリプト
# crontab: 0 5 1 * * /opt/apps/concafe-app/scripts/monthly-reset.sh >> /var/log/monthly-reset.log 2>&1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

if [ -z "$CRON_SECRET" ]; then
  CRON_SECRET="$(grep '^CRON_SECRET=' "$APP_DIR/.env" | cut -d= -f2-)"
fi

if [ -z "$CRON_SECRET" ]; then
  echo "[$(date -Iseconds)] ERROR: CRON_SECRET が設定されていません" >&2
  exit 1
fi

APP_URL="${APP_URL:-http://localhost:3000}"

echo "[$(date -Iseconds)] 月次ポイントリセット開始"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$APP_URL/api/admin/monthly-reset" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "[$(date -Iseconds)] HTTP $HTTP_CODE: $BODY"

if [ "$HTTP_CODE" != "200" ]; then
  echo "[$(date -Iseconds)] ERROR: リセットに失敗しました" >&2
  exit 1
fi

echo "[$(date -Iseconds)] 月次ポイントリセット完了"
