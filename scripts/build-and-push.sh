#!/bin/bash
# 手元 PC で実行: イメージをビルドしてレジストリに push する
# 事前: .env に NEXT_PUBLIC_GA_ID を入れておく
# 事前: docker login でレジストリにログイン済みであること
set -e
cd "$(dirname "$0")/.."

PUSH_IMAGE="${DOCKER_IMAGE:-takanoyuji/concafe-app:latest}"
if [[ "$PUSH_IMAGE" != *":"* ]]; then
  PUSH_IMAGE="${PUSH_IMAGE}:latest"
fi

echo "=== Build (NEXT_PUBLIC_GA_ID from .env) ==="
set -a
[ -f .env ] && . .env
set +a
docker compose build --no-cache

echo "=== Tag & Push ==="
# compose が付けるイメージ名（プロジェクト名-サービス名、ディレクトリ名で変わる）
LOCAL_IMAGE=$(docker compose images -q app 2>/dev/null | head -1)
if [ -z "$LOCAL_IMAGE" ]; then
  # フォールバック: よくある名前
  for name in concafe-app-app concafe-app_app; do
    if docker image inspect "${name}:latest" &>/dev/null; then
      docker tag "${name}:latest" "$PUSH_IMAGE"
      break
    fi
  done
else
  docker tag "$LOCAL_IMAGE" "$PUSH_IMAGE"
fi
docker push "$PUSH_IMAGE"

echo "=== Done. On server run ==="
echo "  echo 'DOCKER_IMAGE=$PUSH_IMAGE' >> .env"
echo "  docker compose -f docker-compose.pull.yml pull"
echo "  docker compose -f docker-compose.pull.yml up -d --force-recreate"
