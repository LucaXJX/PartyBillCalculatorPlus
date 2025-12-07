# 環境變量設置完成後的下一步

## ✅ 當前狀態

根據你的驗證結果：

- ✅ Node.js 和 npm 已正確設置
- ✅ Visual Studio 編譯器 (cl) 已找到
- ✅ Visual Studio 鏈接器 (link) 已找到
- ✅ 所有環境變量已設置：
  - `VSINSTALLDIR`
  - `VCINSTALLDIR`
  - `VCToolsInstallDir`
  - `WindowsSdkDir`
  - `WindowsSDKVersion`
- ⚠️  `msbuild` 未找到（可能需要添加到 PATH）

## 下一步操作

### 步驟 1：添加 MSBuild 到 PATH（如果需要）

雖然 `msbuild` 未找到，但對於 TensorFlow.js 構建，**可能不是必需的**。node-gyp 主要使用 `cl` 編譯器。

如果仍然想添加 MSBuild，可以：

1. 找到 MSBuild 位置（通常在）：
   ```
   D:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe
   ```

2. 添加到 PATH：
   ```
   D:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin
   ```

### 步驟 2：運行環境檢查腳本

運行檢查腳本驗證所有設置：

```powershell
npm run check:env
```

或直接運行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-env-vars.ps1
```

### 步驟 3：設置 npm config（推薦）

為了確保 node-gyp 能找到 Visual Studio，運行：

```cmd
npm config set msvs_version 2022
npm config set msvs_path "D:\Program Files\Microsoft Visual Studio\18\Community"
```

### 步驟 4：構建 TensorFlow.js

在**新的命令提示符**中運行：

```cmd
cd E:\42_Coding\PartyBillCalculator
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

**注意**：構建過程可能需要幾分鐘，請耐心等待。

### 步驟 5：驗證構建成功

構建完成後，運行診斷腳本：

```cmd
npm run test:tensorflow
```

應該顯示：
```
✅ TensorFlow.js 可以正常使用！
```

或手動檢查文件是否存在：

```cmd
dir node_modules\@tensorflow\tfjs-node\lib\napi-v8\tfjs_binding.node
```

## 如果構建失敗

### 檢查構建日誌

構建失敗時，查看錯誤信息。常見問題：

1. **找不到編譯器**
   - 確認 `cl.exe` 在 PATH 中
   - 運行 `where cl` 確認

2. **找不到 Windows SDK**
   - 確認 `WindowsSdkDir` 和 `WindowsSDKVersion` 已設置
   - 確認 SDK 路徑存在

3. **版本不匹配**
   - 確認 `VCToolsInstallDir` 中的版本號正確
   - 確認 `WindowsSDKVersion` 正確

### 使用詳細日誌

如果構建失敗，使用詳細模式查看更多信息：

```cmd
npm rebuild @tensorflow/tfjs-node --build-addon-from-source --verbose
```

## 構建成功後

構建成功後，可以：

1. **重啟服務器**（如果正在運行）
   ```cmd
   npm run dev
   ```

2. **測試食物識別功能**
   - 訪問：`http://localhost:3000/food-recognition-test.html`
   - 測試 TensorFlow.js 是否正常工作

3. **運行訓練腳本**（如果準備好數據）
   ```cmd
   npm run train:level1
   ```

## 快速檢查清單

- [ ] 運行 `npm run check:env` 驗證環境
- [ ] 設置 `npm config set msvs_version 2022`
- [ ] 設置 `npm config set msvs_path`
- [ ] 運行 `npm rebuild @tensorflow/tfjs-node --build-addon-from-source`
- [ ] 運行 `npm run test:tensorflow` 驗證構建
- [ ] 重啟服務器測試功能

## 推薦命令序列

```cmd
REM 1. 檢查環境
npm run check:env

REM 2. 設置 npm config
npm config set msvs_version 2022
npm config set msvs_path "D:\Program Files\Microsoft Visual Studio\18\Community"

REM 3. 構建 TensorFlow.js
cd E:\42_Coding\PartyBillCalculator
npm rebuild @tensorflow/tfjs-node --build-addon-from-source

REM 4. 驗證構建
npm run test:tensorflow
```

## 注意事項

1. **構建時間**：構建過程可能需要 5-15 分鐘，請耐心等待

2. **CPU 使用率**：構建時 CPU 使用率會很高，這是正常的

3. **磁盤空間**：確保有足夠的磁盤空間（至少 500MB）

4. **網絡連接**：構建過程中可能需要下載一些依賴

5. **錯誤處理**：如果構建失敗，保存錯誤日誌以便排查

## 成功標誌

構建成功後，你應該看到：

1. ✅ 構建過程完成，沒有錯誤
2. ✅ `tfjs_binding.node` 文件存在於：
   ```
   node_modules\@tensorflow\tfjs-node\lib\napi-v8\tfjs_binding.node
   ```
3. ✅ 診斷腳本顯示 "TensorFlow.js 可以正常使用！"

祝構建順利！🚀

