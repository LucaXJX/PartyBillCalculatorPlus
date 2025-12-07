# node-gyp 無法識別 Visual Studio 2022 的解決方案

## 問題

構建時出現錯誤：
```
gyp ERR! find VS unknown version "undefined" found at "D:\Program Files\Microsoft Visual Studio\18\Community"
gyp ERR! find VS could not find a version of Visual Studio 2017 or newer to use
```

## 原因

node-gyp 無法自動識別 Visual Studio 18（對應 VS 2022），需要明確告訴它版本號。

## 解決方案

### 方案 1：使用 Developer Command Prompt（最可靠）

1. **打開 Developer Command Prompt for VS 2022**
   - 在開始菜單搜索 "Developer Command Prompt for VS"
   - 或運行：`D:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat`

2. **在 Developer Command Prompt 中運行構建**

   ```cmd
   cd /d E:\42_Coding\PartyBillCalculator
   npm rebuild @tensorflow/tfjs-node --build-addon-from-source
   ```

   這會自動設置所有必要的環境變量，包括告訴 node-gyp 這是 VS 2022。

### 方案 2：設置環境變量（當前 CMD 會話）

在命令提示符中設置環境變量：

```cmd
set GYP_MSVS_VERSION=2022
set npm_config_msvs_version=2022
cd /d E:\42_Coding\PartyBillCalculator
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

### 方案 3：創建 .npmrc 文件（永久設置）

在項目根目錄創建或編輯 `.npmrc` 文件，添加：

```
msvs_version=2022
```

然後運行構建：

```cmd
cd /d E:\42_Coding\PartyBillCalculator
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

### 方案 4：使用構建腳本

使用已創建的構建腳本，它會自動設置環境：

```cmd
cd /d E:\42_Coding\PartyBillCalculator
npm run build:tensorflow:cmd
```

## 推薦流程

### 最簡單的方法：使用 Developer Command Prompt

1. 打開 **Developer Command Prompt for VS 2022**
2. 運行：

   ```cmd
   cd /d E:\42_Coding\PartyBillCalculator
   npm rebuild @tensorflow/tfjs-node --build-addon-from-source
   ```

### 或使用環境變量（當前會話）

在普通命令提示符中：

```cmd
set GYP_MSVS_VERSION=2022
set npm_config_msvs_version=2022
cd /d E:\42_Coding\PartyBillCalculator
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

## 驗證設置

設置環境變量後，可以驗證：

```cmd
echo %GYP_MSVS_VERSION%
echo %npm_config_msvs_version%
```

應該顯示 `2022`。

## 為什麼 Developer Command Prompt 更好？

Developer Command Prompt 會：
- ✅ 自動設置 `GYP_MSVS_VERSION=2022`
- ✅ 自動設置所有 Visual Studio 環境變量
- ✅ 自動設置編譯器路徑
- ✅ 更可靠，不容易出錯

## 如果仍然失敗

如果使用 Developer Command Prompt 仍然失敗，檢查：

1. **確認 Visual Studio 安裝**
   ```cmd
   dir "D:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\MSVC"
   ```

2. **確認環境變量**
   ```cmd
   echo %VSINSTALLDIR%
   echo %VCINSTALLDIR%
   ```

3. **使用詳細模式查看錯誤**
   ```cmd
   npm rebuild @tensorflow/tfjs-node --build-addon-from-source --verbose
   ```

