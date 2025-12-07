#!/bin/bash
# TensorFlow.js 構建腳本
# 自動設置 Visual Studio 環境變量並構建

set -e

echo "🔧 設置 Visual Studio 環境變量..."

# Visual Studio 安裝路徑（根據你的實際安裝位置調整）
VSINSTALLDIR="D:/Program Files/Microsoft Visual Studio/18/Community"
VCINSTALLDIR="$VSINSTALLDIR/VC"

# 設置 Windows 格式的環境變量（用於 node-gyp）
export VSINSTALLDIR="$VSINSTALLDIR"
export VCINSTALLDIR="$VCINSTALLDIR"

# 設置 npm config（node-gyp 會讀取這些配置）
# 注意：Visual Studio 18 = Visual Studio 2022
npm config set msvs_version 2022 2>/dev/null || true
npm config set msvs_path "$VSINSTALLDIR" 2>/dev/null || true

# 查找並設置 MSBuild 路徑
MSBUILD_PATH=$(find "/d/Program Files/Microsoft Visual Studio/18/Community" -name "MSBuild.exe" 2>/dev/null | head -1)
if [ -n "$MSBUILD_PATH" ]; then
    MSBUILD_DIR=$(dirname "$MSBUILD_PATH")
    export PATH="$MSBUILD_DIR:$PATH"
    echo "   MSBuild 路徑: $MSBUILD_PATH"
fi

# 查找並設置編譯器路徑
MSVC_VERSION=$(ls "/d/Program Files/Microsoft Visual Studio/18/Community/VC/Tools/MSVC" 2>/dev/null | head -1)
if [ -n "$MSVC_VERSION" ]; then
    COMPILER_PATH="/d/Program Files/Microsoft Visual Studio/18/Community/VC/Tools/MSVC/$MSVC_VERSION/bin/Hostx64/x64"
    if [ -d "$COMPILER_PATH" ]; then
        export PATH="$COMPILER_PATH:$PATH"
        echo "   編譯器路徑: $COMPILER_PATH"
    fi
fi

# 添加到 PATH
export PATH="$VSINSTALLDIR/Common7/IDE:$PATH"
export PATH="$VSINSTALLDIR/Common7/Tools:$PATH"

# 設置 Windows SDK 路徑（如果存在）
WINSDK_PATH=$(find "/d/Windows Kits" -name "um" -type d 2>/dev/null | head -1)
if [ -n "$WINSDK_PATH" ]; then
    export PATH="$WINSDK_PATH:$PATH"
    echo "   Windows SDK 路徑: $WINSDK_PATH"
fi

echo "✅ 環境變量已設置"
echo "   VSINSTALLDIR: $VSINSTALLDIR"
echo "   VCINSTALLDIR: $VCINSTALLDIR"
echo "   msvs_version: 2022"

# 切換到項目目錄
cd "$(dirname "$0")/.." || exit 1

echo ""
echo "🔨 開始構建 TensorFlow.js..."
echo ""

# 運行構建（使用 npm rebuild，因為它對環境變量更友好）
# 使用 --build-addon-from-source 強制從源代碼構建
npm rebuild @tensorflow/tfjs-node --build-addon-from-source

echo ""
echo "✅ 構建完成！"
echo ""
echo "驗證構建結果..."
if find node_modules/@tensorflow/tfjs-node -name "*.node" 2>/dev/null | grep -q .; then
    echo "✅ TensorFlow.js native 模塊已成功構建"
    find node_modules/@tensorflow/tfjs-node -name "*.node" 2>/dev/null
else
    echo "⚠️  未找到構建文件，構建可能失敗"
    exit 1
fi


