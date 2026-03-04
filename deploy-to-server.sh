#!/bin/bash
# サーバー側で実行: コードを pull し、.env を確認してから再ビルド・再起動
set -e
cd /opt/apps/concafe-app

echo "=== Git pull ==="
git pull origin main

echo ""
echo "=== .env に SMTP_FROM があるか確認 ==="
if grep -q "^SMTP_FROM=" .env 2>/dev/null; then
  echo "SMTP_FROM は設定済み: $(grep '^SMTP_FROM=' .env)"
else
  echo "SMTP_FROM が未設定です。.env に以下を追加してください:"
  echo "  SMTP_FROM=noreply@test.xing-lang.com"
  echo "追加後、このスクリプトを再実行するか docker compose restart してください。"
  if grep -q "SMTP_HOST=" .env 2>/dev/null; then
    echo ""
    read -p "今すぐ .env に SMTP_FROM=noreply@test.xing-lang.com を追加しますか? [y/N] " yn
    if [[ "$yn" =~ ^[yY]$ ]]; then
      echo "SMTP_FROM=noreply@test.xing-lang.com" >> .env
      echo "追加しました。"
    fi
  fi
fi

echo ""
echo "=== Docker 再ビルド・再起動 ==="
docker compose build --no-cache
docker compose up -d --force-recreate

echo ""
echo "=== 完了 ==="
docker compose ps
