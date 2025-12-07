# 手動設置系統環境變量指南

## 概述

本指南將幫助你在 Windows 系統環境變量中手動設置所有必要的環境變量，以便構建 TensorFlow.js。

## 打開環境變量設置

### 方法 1：通過系統屬性

1. 按 `Win + R`
2. 輸入 `sysdm.cpl` 並按 Enter
3. 點擊 "高級" 標籤
4. 點擊 "環境變量" 按鈕

### 方法 2：直接搜索

1. 在開始菜單搜索 "環境變量" 或 "Environment Variables"
2. 選擇 "編輯系統環境變量"
3. 點擊 "環境變量" 按鈕

## 需要設置的環境變量

### 1. PATH 變量（必須）

**位置**：系統變量 → `Path`

**需要添加的路徑**：

```
C:\Program Files\nodejs
D:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\<MSVC版本號>\bin\Hostx64\x64
D:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE
D:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools
D:\Windows Kits\10\bin\<Windows SDK版本號>\x64
```

**注意**：

- `<MSVC版本號>` 需要替換為實際的 MSVC 版本號（例如：`14.50.32528`）
- `<Windows SDK版本號>` 需要替換為實際的 Windows SDK 版本號（例如：`10.0.26100.0`）
- Windows Kits 路徑可能是 `D:\Windows Kits\10` 或 `C:\Program Files (x86)\Windows Kits\10`，根據實際安裝位置調整

**步驟**：

1. 在 "系統變量" 區域找到 `Path`
2. 點擊 "編輯"
3. 點擊 "新建"，逐個添加上述路徑
4. 點擊 "確定" 保存

**注意**：

- `<版本號>` 需要替換為實際版本號
- 可以通過文件資源管理器查看實際路徑

### 2. Visual Studio 相關變量（可選但推薦）

**位置**：系統變量 → 新建

#### VSINSTALLDIR

- **變量名**：`VSINSTALLDIR`
- **變量值**：`D:\Program Files\Microsoft Visual Studio\18\Community`

#### VCINSTALLDIR

- **變量名**：`VCINSTALLDIR`
- **變量值**：`D:\Program Files\Microsoft Visual Studio\18\Community\VC`

#### VCToolsInstallDir

- **變量名**：`VCToolsInstallDir`
- **變量值**：`D:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\<版本號>`

**注意**：`<版本號>` 需要替換為實際版本號，例如 `14.50.32528`

### 3. Windows SDK 相關變量（可選）

#### WindowsSdkDir

- **變量名**：`WindowsSdkDir`
- **變量值**：`D:\Windows Kits\10`（或 `C:\Program Files (x86)\Windows Kits\10`）

#### WindowsSDKVersion

- **變量名**：`WindowsSDKVersion`
- **變量值**：實際版本號，例如 `10.0.26100.0`

## 查找實際版本號

### 查找 MSVC 版本號

1. 打開文件資源管理器
2. 導航到：`D:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\`
3. 查看文件夾名稱（例如：`14.50.32528`）

### 查找 Windows SDK 版本號

**方法 1：通過 bin 目錄（推薦）**

1. 打開文件資源管理器
2. 導航到：`D:\Windows Kits\10\bin\`（或 `C:\Program Files (x86)\Windows Kits\10\bin\`）
3. 查看文件夾名稱，選擇**最新的版本號**（例如：`10.0.26100.0`）
4. 確認該版本號下有 `x64` 子目錄

**方法 2：通過 Include 目錄**

1. 打開文件資源管理器
2. 導航到：`D:\Windows Kits\10\Include\`（或 `C:\Program Files (x86)\Windows Kits\10\Include\`）
3. 查看文件夾名稱，選擇**最新的版本號**（例如：`10.0.26100.0`）

**常見的 Windows SDK 版本號**：

- `10.0.26100.0`（最新，Windows 11）
- `10.0.22621.0`（Windows 11）
- `10.0.19041.0`（Windows 10 2004）
- `10.0.18362.0`（Windows 10 1903）

**建議使用最新的版本號**。

## 完整設置步驟示例

假設：

- MSVC 版本：`14.50.32528`
- Windows SDK 版本：`10.0.26100.0`
- Windows Kits 位置：`D:\Windows Kits\10`

### PATH 變量添加：

```
C:\Program Files\nodejs
D:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.32528\bin\Hostx64\x64
D:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE
D:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools
D:\Windows Kits\10\bin\10.0.26100.0\x64
```

**注意**：將 `14.50.32528` 和 `10.0.26100.0` 替換為你的實際版本號。

### 新建系統變量：

| 變量名              | 變量值                                                                            |
| ------------------- | --------------------------------------------------------------------------------- |
| `VSINSTALLDIR`      | `D:\Program Files\Microsoft Visual Studio\18\Community`                           |
| `VCINSTALLDIR`      | `D:\Program Files\Microsoft Visual Studio\18\Community\VC`                        |
| `VCToolsInstallDir` | `D:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717` |
| `WindowsSdkDir`     | `D:\Windows Kits\10`                                                              |
| `WindowsSDKVersion` | `10.0.26100.0`                                                                    |

## 驗證設置

### 1. 重新啟動命令提示符

**重要**：設置環境變量後，必須重新啟動命令提示符才能生效！

### 2. 驗證 Node.js

```cmd
where node
where npm
node --version
npm --version
```

### 3. 驗證 Visual Studio 工具

```cmd
where cl
where msbuild
where link
```

### 4. 驗證環境變量

```cmd
echo %VSINSTALLDIR%
echo %VCINSTALLDIR%
echo %VCToolsInstallDir%
echo %WindowsSdkDir%
echo %WindowsSDKVersion%
```

## 構建 TensorFlow.js

設置完成後，在**新的命令提示符**中運行：

```cmd
cd E:\42_Coding\PartyBillCalculator
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

或使用構建腳本（現在不需要加載 VsDevCmd.bat）：

```cmd
npm run build:tensorflow:cmd
```

## 常見問題

### 問題 1：設置後仍然找不到命令

**解決方案**：

1. 確保已重新啟動命令提示符
2. 檢查路徑是否正確（注意反斜杠和正斜杠）
3. 確認文件夾確實存在

### 問題 2：版本號不匹配

**解決方案**：

1. 使用文件資源管理器查看實際版本號
2. 更新環境變量中的版本號

### 問題 3：構建仍然失敗

**解決方案**：

1. 運行 `npm config set msvs_version 2022`
2. 運行 `npm config set msvs_path "D:\Program Files\Microsoft Visual Studio\18\Community"`
3. 檢查構建日誌中的錯誤信息

## 注意事項

1. **版本號會變化**：當 Visual Studio 或 Windows SDK 更新時，版本號會改變，需要更新環境變量

2. **路徑可能不同**：根據你的實際安裝位置調整路徑

3. **使用 VsDevCmd.bat 更可靠**：手動設置環境變量容易出錯，使用 `VsDevCmd.bat` 會自動設置所有必要的環境變量

4. **建議備份**：在修改環境變量之前，建議先導出當前設置作為備份

## 導出/備份環境變量

在 PowerShell 中運行：

```powershell
# 導出所有環境變量到文件
Get-ChildItem Env: | Out-File -FilePath "$env:USERPROFILE\Desktop\env-backup.txt"
```

## 恢復默認設置

如果設置出錯，可以：

1. 刪除新添加的環境變量
2. 從 PATH 中移除新添加的路徑
3. 重新啟動計算機

## 推薦方案

雖然可以手動設置，但**推薦使用構建腳本**，因為：

- ✅ 自動處理版本號
- ✅ 自動查找路徑
- ✅ 更不容易出錯
- ✅ 不需要修改系統設置

但如果想永久設置，手動設置也是可行的選擇。
