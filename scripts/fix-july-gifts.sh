#!/bin/bash
# 2026年7月1日の不正なGIFTエントリを削除し、影響ユーザーのポイントをリセットする
# ubuntuユーザーとしてサーバー上で実行すること
set -euo pipefail

APP_DIR="/opt/apps/concafe-app"
CRON_SECRET="$(grep '^CRON_SECRET=' "$APP_DIR/.env" | cut -d= -f2-)"

CONTAINER=$(docker ps --filter "name=concafe-app-app" --format "{{.Names}}" | head -1)
if [ -z "$CONTAINER" ]; then
  echo "ERROR: concafe-appコンテナが見つかりません"
  docker ps
  exit 1
fi
echo "対象コンテナ: $CONTAINER"

echo ""
echo "=== Step 1: 削除対象のGIFTエントリ確認 ==="
docker exec "$CONTAINER" node -e "
const { PrismaClient } = require('/app/node_modules/.prisma/client');
const prisma = new PrismaClient();
const ids = [
  'cmr1q4tu000y338qy78gctcqz',
  'cmr1ssuwx00y438qyqpdmj7dx',
  'cmr1st1bp00y538qymjlk1hjy'
];
prisma.pointLedger.findMany({ where: { id: { in: ids } }, include: { cast: { select: { name: true } } } })
  .then(rows => {
    rows.forEach(r => console.log(r.id, r.type, r.amount + 'pt', '->', r.cast?.name, r.createdAt));
    console.log('計', rows.length, '件');
    return prisma.\$disconnect();
  });
"

echo ""
read -p "上記3件を削除しますか? [y/N] " confirm
if [[ ! "$confirm" =~ ^[yY]$ ]]; then
  echo "キャンセルしました"
  exit 0
fi

echo ""
echo "=== Step 2: GIFTエントリ削除 ==="
docker exec "$CONTAINER" node -e "
const { PrismaClient } = require('/app/node_modules/.prisma/client');
const prisma = new PrismaClient();
const ids = [
  'cmr1q4tu000y338qy78gctcqz',
  'cmr1ssuwx00y438qyqpdmj7dx',
  'cmr1st1bp00y538qymjlk1hjy'
];
prisma.pointLedger.deleteMany({ where: { id: { in: ids } } })
  .then(result => {
    console.log('削除完了:', result.count, '件');
    return prisma.\$disconnect();
  });
"

echo ""
echo "=== Step 3: 影響ユーザーのポイントリセット ==="
RESULT=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/admin/monthly-reset \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json")
HTTP_CODE=$(echo "$RESULT" | tail -n1)
BODY=$(echo "$RESULT" | head -n-1)
echo "HTTP $HTTP_CODE: $BODY"

if [ "$HTTP_CODE" = "200" ]; then
  echo ""
  echo "=== 完了 ==="
else
  echo "ERROR: リセットAPIの呼び出しに失敗しました"
  exit 1
fi
