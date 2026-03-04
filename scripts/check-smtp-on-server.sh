#!/bin/bash
# サーバー上で実行: SMTP 設定とコンテナの環境変数を確認
# 使い方: ssh でサーバーに入り、cd /opt/apps/concafe-app && bash scripts/check-smtp-on-server.sh

set -e
CD="/opt/apps/concafe-app"
cd "$CD"

echo "=== 1. .env の SMTP 関連（値は伏せ字） ==="
if [ -f .env ]; then
  grep -E "^(SMTP_|NEXT_PUBLIC_BASE)" .env | sed 's/=.*/=***/' || echo "(該当行なし)"
else
  echo ".env がありません"
fi

echo ""
echo "=== 2. コンテナ内の環境変数（SMTP の有無のみ） ==="
SVC=$(docker compose config --services 2>/dev/null | head -1)
if [ -n "$SVC" ]; then
  docker compose exec -T "$SVC" env 2>/dev/null | grep -E "^(SMTP_|NEXT_PUBLIC_BASE)" | sed 's/=.*/=***/' || echo "(該当なし → compose の env_file / environment を確認)"
else
  echo "docker compose config でサービス名を取得できません"
fi
docker compose ps 2>/dev/null || true

echo ""
echo "=== 3. デバッグ API（アプリから見えた設定） ==="
curl -s http://127.0.0.1:3000/api/debug/smtp 2>/dev/null || echo "接続できません（アプリが 3000 で動いているか確認)"

echo ""
echo "=== 4. 直近のアプリログ（メール送信エラー探し） ==="
docker compose logs --tail 30 2>/dev/null | grep -E "EMAIL|DEV EMAIL|SMTP|Error|error" || echo "(該当ログなし)"
echo "--- 直近5行 ---"
docker compose logs --tail 5 2>/dev/null
