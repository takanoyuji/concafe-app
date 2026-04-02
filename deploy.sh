#!/bin/bash
# 手元で実行: ビルド（GA ID を渡す）→ タグ → push
# 実行後、表示されるコマンドをサーバで実行する

set -e
cd "$(dirname "$0")"

# ビルド時に埋め込む値（.env があれば読み込む）
export NEXT_PUBLIC_BASE_URL="${NEXT_PUBLIC_BASE_URL:-https://vliverlab.com}"
export NEXT_PUBLIC_GA_ID="${NEXT_PUBLIC_GA_ID:-G-F9FKY7CKMM}"

echo "=== ビルド（NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL, NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID）==="
docker compose build --no-cache \
  --build-arg NEXT_PUBLIC_BASE_URL="$NEXT_PUBLIC_BASE_URL" \
  --build-arg NEXT_PUBLIC_GA_ID="$NEXT_PUBLIC_GA_ID"

echo ""
echo "=== タグ付け ==="
docker tag vliverlab-hp-app:latest takanodocker/vliverlab-hp:latest

echo ""
echo "=== Docker Hub に push ==="
docker push takanodocker/vliverlab-hp:latest

echo ""
echo "✅ push 完了。サーバで以下を実行してください:"
echo ""
echo "  ssh ubuntu@219.94.244.166"
echo "  cd /opt/apps/vliverlab-hp"
echo "  docker compose -f docker-compose.pull.yml pull"
echo "  docker compose -f docker-compose.pull.yml up -d --force-recreate"
echo ""
