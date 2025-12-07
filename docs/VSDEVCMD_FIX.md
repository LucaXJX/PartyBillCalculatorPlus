# VsDevCmd.bat 閃退問題解決方案

## 問題

雙擊 `VsDevCmd.bat` 時會閃退，無法看到輸出。

## 原因

`VsDevCmd.bat` 是一個批處理腳本，設計用於在命令提示符（CMD）中運行，而不是雙擊執行。當你雙擊它時，它會執行但立即關閉窗口。

## 解決方案

### 方案 1：使用 CMD 運行（推薦）

1. **打開命令提示符（CMD）**
   - 按 `Win + R`
   - 輸入 `cmd` 並按 Enter
   - 或搜索 "命令提示符"

2. **運行 VsDevCmd.bat**

   ```cmd
   "D:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat"
   ```

   這會設置環境變量並保持命令提示符打開。

3. **在設置好環境的命令提示符中運行構建**

   ```cmd
   cd E:\42_Coding\PartyBillCalculator
   npm rebuild @tensorflow/tfjs-node --build-addon-from-source
   ```

### 方案 2：使用構建腳本（最簡單）

已創建 Windows CMD 構建腳本，它會自動調用 `VsDevCmd.bat`：

```cmd
npm run build:tensorflow:cmd
```

或直接運行：

```cmd
scripts\build-tensorflow.cmd
```

這個腳本會：
1. 自動調用 `VsDevCmd.bat` 設置環境
2. 運行構建命令
3. 驗證構建結果

### 方案 3：創建快捷方式

1. **創建一個新的批處理文件** `start-vs-dev-cmd.bat`：

   ```cmd
   @echo off
   call "D:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat"
   cmd /k
   ```

2. **雙擊這個文件**

   這會打開一個已經設置好 Visual Studio 環境的命令提示符。

### 方案 4：使用 PowerShell

在 PowerShell 中：

```powershell
& "D:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat"
cd E:\42_Coding\PartyBillCalculator
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

## 驗證環境是否設置成功

在設置好環境的命令提示符中運行：

```cmd
where cl
where msbuild
echo %VSINSTALLDIR%
```

應該顯示：
- `cl.exe` 的路徑（C++ 編譯器）
- `MSBuild.exe` 的路徑
- Visual Studio 安裝目錄

## 推薦流程

**最簡單的方法**：

```cmd
cd E:\42_Coding\PartyBillCalculator
npm run build:tensorflow:cmd
```

這個命令會自動處理所有環境設置。

## 如果仍然失敗

1. **確認 Visual Studio 路徑**

   檢查 `D:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat` 是否存在

2. **檢查 Visual Studio 安裝**

   確認已安裝 "Desktop development with C++" 工作負載

3. **手動設置環境變量**

   如果 `VsDevCmd.bat` 無法運行，可以手動設置（見 `VISUAL_STUDIO_BUILD_FIX.md`）

