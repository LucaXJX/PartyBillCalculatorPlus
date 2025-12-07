# Windows 系統環境變量設置指南

## 重要區別

### `.env` 文件 vs 系統環境變量

- **`.env` 文件**：項目級別的配置文件，用於存儲應用程序的配置（如數據庫連接、API 密鑰等）
- **系統環境變量**：操作系統級別的設置，影響所有應用程序（如 PATH、VSINSTALLDIR 等）

**TensorFlow.js 構建需要的是系統環境變量，不是 `.env` 文件！**

## 設置系統環境變量

### 方法 1：通過系統設置（GUI，推薦）

1. **打開環境變量設置**

   - 按 `Win + R`
   - 輸入 `sysdm.cpl` 並按 Enter
   - 或搜索 "環境變量" 或 "Environment Variables"
   - 點擊 "環境變量" 按鈕

2. **編輯 PATH 變量**

   - 在 "系統變量" 區域找到 `Path`
   - 點擊 "編輯"
   - 點擊 "新建"
   - 添加 Node.js 路徑（如果沒有）：
     ```
     C:\Program Files\nodejs
     ```
   - 點擊 "確定" 保存

3. **添加 Visual Studio 環境變量（可選）**

   雖然可以手動設置，但**不推薦**，因為：

   - Visual Studio 環境變量很多且複雜
   - 使用 `VsDevCmd.bat` 更可靠
   - 手動設置容易出錯

### 方法 2：通過命令提示符（臨時設置）

在命令提示符中設置（僅對當前會話有效）：

```cmd
set PATH=C:\Program Files\nodejs;%PATH%
set VSINSTALLDIR=D:\Program Files\Microsoft Visual Studio\18\Community
set VCINSTALLDIR=%VSINSTALLDIR%\VC
```

### 方法 3：通過 PowerShell（臨時設置）

在 PowerShell 中設置（僅對當前會話有效）：

```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
$env:VSINSTALLDIR = "D:\Program Files\Microsoft Visual Studio\18\Community"
$env:VCINSTALLDIR = "$env:VSINSTALLDIR\VC"
```

## 對於 TensorFlow.js 構建

### 推薦方法：使用構建腳本

**不需要手動設置系統環境變量！** 構建腳本會自動處理：

```cmd
npm run build:tensorflow:cmd
```

這個腳本會：

1. 自動加載 Visual Studio 環境（通過 `VsDevCmd.bat`）
2. 自動查找並添加 Node.js 到 PATH（如果不在）
3. 運行構建命令

### 如果 Node.js 不在系統 PATH 中

如果 `npm` 命令在命令提示符中不可用，可以：

1. **臨時添加（推薦）**

   在運行構建腳本之前：

   ```cmd
   set PATH=C:\Program Files\nodejs;%PATH%
   npm run build:tensorflow:cmd
   ```

2. **永久添加（可選）**

   通過系統設置添加 Node.js 到 PATH（見方法 1）

## 驗證環境變量

### 檢查 Node.js

```cmd
where node
where npm
node --version
npm --version
```

### 檢查 Visual Studio（在設置好環境後）

```cmd
where cl
where msbuild
echo %VSINSTALLDIR%
```

## 總結

- ❌ **不要**使用 `.env` 文件來設置系統環境變量
- ✅ **使用**構建腳本自動設置（推薦）
- ✅ **或**手動設置系統 PATH（如果需要）
- ✅ **或**在命令提示符中臨時設置 PATH

**最簡單的方法**：直接運行構建腳本，它會自動處理所有環境設置！
