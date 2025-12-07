# Visual Studio Build Tools 構建問題修復

## 問題

即使已安裝 Visual Studio Build Tools，構建仍然失敗，錯誤信息：

```
gyp ERR! find VS could not find a version of Visual Studio
```

## 原因

Visual Studio 已安裝在 `D:\Program Files\Microsoft Visual Studio\18\Community\`，但環境變量未設置，node-gyp 無法找到它。

## 解決方案

### 方案 1：使用 Visual Studio Developer Command Prompt（推薦）

1. **打開 Visual Studio Developer Command Prompt**
   - 在 Windows 開始菜單搜索 "Developer Command Prompt for VS"
   - 或導航到：`D:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat`

2. **在 Developer Command Prompt 中運行構建命令**

   ```bash
   cd E:\42_Coding\PartyBillCalculator
   pnpm rebuild @tensorflow/tfjs-node
   ```

   這個命令提示符會自動設置所有必要的環境變量。

### 方案 2：手動設置環境變量（當前終端）

在 Git Bash 中運行：

```bash
# 設置 Visual Studio 路徑
export VSINSTALLDIR="/d/Program Files/Microsoft Visual Studio/18/Community"
export VCINSTALLDIR="/d/Program Files/Microsoft Visual Studio/18/Community/VC"
export VCToolsInstallDir="/d/Program Files/Microsoft Visual Studio/18/Community/VC/Tools/MSVC"

# 添加到 PATH
export PATH="/d/Program Files/Microsoft Visual Studio/18/Community/VC/Tools/MSVC/14.46.32528/bin/Hostx64/x64:$PATH"
export PATH="/d/Program Files/Microsoft Visual Studio/18/Community/Common7/IDE:$PATH"

# 然後運行構建
cd /e/42_Coding/PartyBillCalculator
pnpm rebuild @tensorflow/tfjs-node
```

### 方案 3：使用 npm config 指定 Visual Studio 版本

```bash
npm config set msvs_version 2022
npm config set msvs_path "D:\Program Files\Microsoft Visual Studio\18\Community"

# 然後運行構建
pnpm rebuild @tensorflow/tfjs-node
```

### 方案 4：創建構建腳本（自動設置環境）

創建一個構建腳本，自動設置環境變量：

**Windows (PowerShell) - `scripts/build-tensorflow.ps1`:**

```powershell
$env:VSINSTALLDIR = "D:\Program Files\Microsoft Visual Studio\18\Community"
$env:VCINSTALLDIR = "$env:VSINSTALLDIR\VC"

# 調用 Visual Studio 的環境設置腳本
& "$env:VSINSTALLDIR\Common7\Tools\VsDevCmd.bat"

# 運行構建
pnpm rebuild @tensorflow/tfjs-node
```

**Windows (Git Bash) - `scripts/build-tensorflow.sh`:**

```bash
#!/bin/bash
export VSINSTALLDIR="/d/Program Files/Microsoft Visual Studio/18/Community"
export VCINSTALLDIR="$VSINSTALLDIR/VC"

# 運行構建
cd /e/42_Coding/PartyBillCalculator
pnpm rebuild @tensorflow/tfjs-node
```

然後運行：

```bash
bash scripts/build-tensorflow.sh
```

### 方案 5：使用 npm rebuild（如果 pnpm 失敗）

```bash
# 設置環境變量（在 Git Bash 中）
export VSINSTALLDIR="/d/Program Files/Microsoft Visual Studio/18/Community"
export VCINSTALLDIR="$VSINSTALLDIR/VC"

# 使用 npm rebuild
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

## 驗證構建成功

構建成功後，檢查文件是否存在：

```bash
find node_modules/@tensorflow/tfjs-node -name "*.node" 2>/dev/null
```

應該找到：
```
node_modules/@tensorflow/tfjs-node/lib/napi-v8/tfjs_binding.node
```

## 推薦流程

1. **使用方案 1（Developer Command Prompt）** - 最可靠
2. 如果方案 1 不方便，使用**方案 4（構建腳本）** - 自動化設置
3. 如果仍然失敗，嘗試**方案 5（npm rebuild）**

## 注意事項

- 構建過程可能需要幾分鐘
- 確保已安裝 "Desktop development with C++" 工作負載
- 如果使用 Git Bash，某些路徑可能需要轉義或使用正斜杠
- 構建完成後，重啟服務器以加載 TensorFlow.js


