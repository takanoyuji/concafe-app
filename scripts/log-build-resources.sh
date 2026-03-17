#!/bin/bash
# ビルド中に CPU/メモリを一定間隔でログに記録する
# 使い方: 別ターミナルで ./scripts/log-build-resources.sh を実行し、
#         もう一方で docker compose build を実行する。
# 終了: Ctrl+C

LOG="${1:-build-resources.log}"
INTERVAL="${2:-10}"

echo "Logging to $LOG every ${INTERVAL}s (Ctrl+C to stop)"
echo "time,date,cpu_cores,mem_total_mb,mem_used_mb,mem_free_mb,swap_used_mb,load_1,load_5,load_15" > "$LOG"

while true; do
  # 1行で取得（パースしやすいように）
  read -r _ _ _ _ _ _ _ _ load1 load5 load15 _ < /proc/loadavg
  read -r _ mem_total _ mem_free _ mem_avail _ < /proc/meminfo
  read -r _ swap_total _ swap_free _ < /proc/meminfo
  # MB に変換（だいたい 1024 で割る）
  mem_total_mb=$(( mem_total / 1024 ))
  mem_used_mb=$(( (mem_total - mem_avail) / 1024 ))
  mem_free_mb=$(( mem_avail / 1024 ))
  swap_used_mb=$(( (swap_total - swap_free) / 1024 ))
  cpu_cores=$(nproc)
  echo "$(date +%s),$(date -Iseconds),$cpu_cores,$mem_total_mb,$mem_used_mb,$mem_free_mb,$swap_used_mb,$load1,$load5,$load15" >> "$LOG"
  sleep "$INTERVAL"
done
