#!/bin/bash
# 定期檢查數據處理狀態

INTERVAL=${1:-30}  # 默認 30 秒，可以通過參數修改

echo "📊 開始監控數據處理狀態（每 ${INTERVAL} 秒檢查一次）"
echo "按 Ctrl+C 停止監控"
echo ""

while true; do
  clear
  echo "============================================================"
  echo "檢查時間: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "============================================================"
  pnpm run data:status
  echo ""
  echo "下次檢查: ${INTERVAL} 秒後（按 Ctrl+C 停止）"
  sleep $INTERVAL
done


