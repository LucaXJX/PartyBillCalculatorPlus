# 立即構建 TensorFlow.js

## 當前狀態

根據測試結果，`tfjs_binding.node` 文件還不存在，需要進行構建。

## 構建步驟

### 在命令提示符（CMD）中運行

**重要**：必須在 **命令提示符（CMD）** 中運行，不是 Git Bash 或 PowerShell！

### 步驟 1：打開命令提示符

1. 按 `Win + R`
2. 輸入 `cmd` 並按 Enter
3. 或搜索 "命令提示符"

### 步驟 2：切換到項目目錄

**注意**：由於環境變量已經設置好了，**不需要設置 npm config**！node-gyp 會自動找到 Visual Studio。

**重要**：在 CMD 中切換到不同驅動器需要使用 `/d` 參數：

```cmd
cd /d E:\42_Coding\PartyBillCalculator
```

或先切換驅動器：

```cmd
E:
cd 42_Coding\PartyBillCalculator
```

### 步驟 3：構建 TensorFlow.js

```cmd
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

**重要提示**：

- 構建過程需要 **5-15 分鐘**
- CPU 使用率會很高（這是正常的）
- 請**不要中斷**構建過程
- 會看到很多編譯輸出，這是正常的

### 步驟 4：等待構建完成

構建成功時，你會看到類似：

```
...
✅ Build completed successfully
```

如果看到錯誤，請保存完整的錯誤信息。

### 步驟 5：驗證構建

構建完成後，運行：

```cmd
npm run test:tensorflow
```

應該顯示：

```
✅ TensorFlow.js 可以正常使用！
```

## 完整命令序列（複製粘貼）

在命令提示符中依次運行：

```cmd
cd E:\42_Coding\PartyBillCalculator
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

**注意**：不需要設置 npm config，環境變量已經設置好了！

構建完成後：

```cmd
npm run test:tensorflow
```

## 如果構建失敗

### 常見錯誤 1：找不到編譯器

**錯誤信息**：

```
'cl' is not recognized as an internal or external command
```

**解決方案**：

1. 確認環境變量已設置（運行 `echo %VCINSTALLDIR%`）
2. 重新啟動命令提示符
3. 確認 PATH 中包含編譯器路徑

### 常見錯誤 2：找不到 Windows SDK

**錯誤信息**：

```
Cannot find Windows SDK
```

**解決方案**：

1. 確認 `WindowsSdkDir` 和 `WindowsSDKVersion` 已設置
2. 確認 SDK 路徑存在

### 常見錯誤 3：版本不匹配

**解決方案**：

1. 確認 `VCToolsInstallDir` 中的版本號正確
2. 確認 `WindowsSDKVersion` 正確

### 獲取幫助

如果構建失敗：

1. 保存完整的錯誤信息
2. 檢查構建日誌
3. 確認所有環境變量正確設置

## 構建成功標誌

構建成功後，你應該看到：

1. ✅ 構建過程完成，沒有錯誤
2. ✅ 文件存在：`node_modules\@tensorflow\tfjs-node\lib\napi-v8\tfjs_binding.node`
3. ✅ 測試腳本顯示 "TensorFlow.js 可以正常使用！"

## 下一步

構建成功後：

1. 重啟服務器：`npm run dev`
2. 測試食物識別功能
3. 開始使用 TensorFlow.js 進行訓練

祝構建順利！🚀
