#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "[1/2] 正在还原官方文件..."
if ! node "$SCRIPT_DIR/localization_engine.js" --huifu "$@"; then
    echo ""
    echo "[错误] 还原失败，请检查上方错误信息。"
    exit 1
fi

echo ""
echo "[2/2] 还原完成！"
echo ""
echo "提示：Antigravity 已恢复至官方原版英文状态。"
