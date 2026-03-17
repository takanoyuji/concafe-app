#!/bin/bash
# 手元 PC で実行: イメージをビルドして tar に保存（レジストリ不要）
# 事前: .env に NEXT_PUBLIC_GA_ID を入れておく
set -e
cd "$(dirname "$0")/.."

OUTPUT="${1:-concafe-app.tar}"

echo "=== Build ==="
set -a
[ -f .env ] && . .env
set +a
docker compose build --no-cache

echo "=== Save to $OUTPUT ==="
# ビルドされたイメージ名を取得（プロジェクト名はディレクトリ名で変わる）
SAVE_NAME=$(docker compose images app 2>/dev/null | awk 'NR==2 {print $2":"$3}' || true)
if [ -z "$SAVE_NAME" ] || [ "$SAVE_NAME" = "NAME" ]; then
  for name in concafe-app-app:latest concafe-app_app:latest; do
    if docker image inspect "$name" &>/dev/null; then
      SAVE_NAME=$name
      break
    fi
  done
fi
[ -z "$SAVE_NAME" ] && SAVE_NAME="concafe-app-app:latest"
docker save "$SAVE_NAME" -o "$OUTPUT"
echo "  Saved: $SAVE_NAME"

echo "=== Done. Next steps ==="
echo "  1. scp $OUTPUT ubuntu@219.94.244.166:/opt/apps/concafe-app/"
echo "  2. On server: cd /opt/apps/concafe-app && docker load -i $OUTPUT"
echo "  3. On server: grep -q '^DOCKER_IMAGE=' .env || echo 'DOCKER_IMAGE=$SAVE_NAME' >> .env"
echo "  4. On server: docker compose -f docker-compose.pull.yml up -d --force-recreate"
