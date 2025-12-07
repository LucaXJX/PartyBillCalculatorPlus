#!/bin/bash
# 激活 Python 虛擬環境（Git Bash 和 Linux/Mac 使用）

if [ -d "venv" ]; then
    source venv/Scripts/activate
    echo "✅ 虛擬環境已激活"
else
    echo "❌ 虛擬環境不存在，請先運行: python -m venv venv"
fi

