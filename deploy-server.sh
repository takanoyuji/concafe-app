#!/bin/bash
# サーバ上で実行: イメージを pull してコンテナを起動
# 使い方: このファイルをサーバの /opt/apps/vliverlab-hp に置いて ./deploy-server.sh

set -e
cd "$(dirname "$0")"

docker compose -f docker-compose.pull.yml pull
docker compose -f docker-compose.pull.yml up -d --force-recreate

echo "✅ 起動完了"
