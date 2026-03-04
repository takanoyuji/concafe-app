#!/bin/sh
set -e
# Prisma が node_modules/@prisma/engines に書き込めるよう、起動時に node 所有にする
chown -R node:node /app /data 2>/dev/null || true
exec gosu node "$@"
