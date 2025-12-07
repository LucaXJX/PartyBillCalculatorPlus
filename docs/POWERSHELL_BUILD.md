# 在 PowerShell 中構建 TensorFlow.js

## 問題

在 PowerShell 中運行構建腳本時，出現錯誤：
```
'npm' 不是内部或外部命令，也不是可运行的程序
```

## 原因

PowerShell 的環境變量可能沒有包含 Node.js 的路徑，或者 Visual Studio 環境設置沒有正確傳遞到 PowerShell。

## 解決方案

### 方案 1：使用 PowerShell 構建腳本（推薦）

已創建專門的 PowerShell 構建腳本：

```powershell
npm run build:tensorflow:ps1
```

或直接運行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-tensorflow.ps1
```

這個腳本會：
1. 自動加載 Visual Studio 環境
2. 自動查找並添加 Node.js 到 PATH
3. 運行構建命令
4. 驗證構建結果

### 方案 2：使用 CMD 構建腳本（最可靠）

在 **命令提示符（CMD）** 中運行：

```cmd
npm run build:tensorflow:cmd
```

或直接運行：

```cmd
scripts\build-tensorflow.cmd
```

CMD 對批處理文件的支持更好，環境變量設置更可靠。

### 方案 3：手動設置環境

在 PowerShell 中手動設置：

```powershell
# 1. 加載 Visual Studio 環境
& "D:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat"

# 2. 添加 Node.js 到 PATH（如果不在）
$env:Path = "C:\Program Files\nodejs;$env:Path"

# 3. 驗證
npm --version

# 4. 運行構建
cd E:\42_Coding\PartyBillCalculator
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

### 方案 4：使用 Developer Command Prompt

**最推薦的方法**：

1. 打開 **Developer Command Prompt for VS 2022**
   - 在開始菜單搜索 "Developer Command Prompt for VS"
   - 或運行：`D:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat`

2. 在 Developer Command Prompt 中運行：

   ```cmd
   cd E:\42_Coding\PartyBillCalculator
   npm rebuild @tensorflow/tfjs-node --build-addon-from-source
   ```

## 為什麼 PowerShell 會有問題？

1. **環境變量繼承**：PowerShell 不會自動繼承 `.bat` 文件設置的環境變量
2. **PATH 設置**：Node.js 可能沒有添加到系統 PATH
3. **執行策略**：PowerShell 可能有執行策略限制

## 推薦流程

**最簡單可靠的方法**：

1. 打開 **命令提示符（CMD）**（不是 PowerShell）
2. 運行：

   ```cmd
   cd E:\42_Coding\PartyBillCalculator
   npm run build:tensorflow:cmd
   ```

這會自動處理所有環境設置。

## 驗證構建成功

構建成功後，運行診斷：

```cmd
npm run test:tensorflow
```

應該顯示：
```
✅ TensorFlow.js 可以正常使用！
```

## 如果仍然失敗

1. **確認 Node.js 安裝**
   ```cmd
   where node
   where npm
   ```

2. **檢查 Visual Studio 路徑**
   確認 `D:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat` 存在

3. **使用完整路徑運行 npm**
   ```cmd
   "C:\Program Files\nodejs\npm.cmd" rebuild @tensorflow/tfjs-node --build-addon-from-source
   ```

