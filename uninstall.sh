#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

OS_NAME="$(uname -s)"
if [ "$OS_NAME" = "Darwin" ]; then
    PLATFORM_LABEL="macOS"
else
    PLATFORM_LABEL="Linux"
fi

if ! command -v node >/dev/null 2>&1; then
    for node_dir in \
        "/opt/homebrew/bin" \
        "/usr/local/bin" \
        "/opt/local/bin"
    do
        if [ -x "$node_dir/node" ]; then
            PATH="$node_dir:$PATH"
            break
        fi
    done
    if [ -n "$SUDO_USER" ] && ! command -v node >/dev/null 2>&1; then
        USER_HOME="$(eval echo "~$SUDO_USER" 2>/dev/null || true)"
        if [ -n "$USER_HOME" ] && [ -d "$USER_HOME" ]; then
            for u_dir in \
                "$USER_HOME/.volta/bin" \
                "$USER_HOME/.asdf/shims" \
                "$USER_HOME/.local/share/mise/shims" \
                "$USER_HOME/Library/pnpm" \
                "$USER_HOME/.fnm/current/bin"
            do
                if [ -x "$u_dir/node" ]; then
                    PATH="$u_dir:$PATH"
                    break
                fi
            done
            if [ -d "$USER_HOME/.nvm/versions/node" ] && ! command -v node >/dev/null 2>&1; then
                latest_nvm_ver="$(cd "$USER_HOME/.nvm/versions/node" 2>/dev/null && ls -d v* 2>/dev/null | sort -t. -k 1.2,1n -k 2,2n -k 3,3n | tail -n 1)"
                if [ -n "$latest_nvm_ver" ] && [ -x "$USER_HOME/.nvm/versions/node/$latest_nvm_ver/bin/node" ]; then
                    PATH="$USER_HOME/.nvm/versions/node/$latest_nvm_ver/bin:$PATH"
                fi
            fi
        fi
    fi
    export PATH
fi


echo ""
echo "=========================================="
echo "  Antigravity 汉化卸载工具 ($PLATFORM_LABEL)"
echo "=========================================="
echo ""
echo "[1/2] 正在还原官方文件..."
if ! node "$SCRIPT_DIR/localization_engine.js" --huifu "$@"; then
    echo ""
    echo "[错误] 还原失败，请检查上方错误信息。"
    echo "提示：如果上方显示“权限不足”或 “EACCES”，请使用 sudo 重新运行此脚本。"
    echo "示例：sudo ./uninstall.sh"
    if [ -t 0 ]; then
        read -rp "按 Enter 键退出..." _
    fi
    exit 1
fi

echo ""
echo "[2/2] 还原完成！"
echo ""
echo "提示：Antigravity 已恢复至官方原版英文状态。"
