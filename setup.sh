#!/bin/bash
# 在你的终端里跑一次，把 X / Bilibili 的登录态接到收藏夹插件上。
# 终端有读浏览器数据的权限，DeepSeek Harness 没有——所以这一步必须在终端里做。
cd "$(dirname "$0")" || exit 1

PY="$HOME/.local/pipx/venvs/twitter-cli/bin/python"
if [ ! -x "$PY" ]; then
  PY="$HOME/.local/pipx/venvs/bilibili-cli/bin/python"
fi
if [ ! -x "$PY" ]; then
  PY="$(command -v python3)"
fi

"$PY" tools/collect-cookies.py
echo
printf "按回车关闭这个窗口…"
read -r _
