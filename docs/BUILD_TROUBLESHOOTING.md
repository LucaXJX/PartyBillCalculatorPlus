# TensorFlow.js 構建故障排除指南

## 快速診斷

運行診斷腳本：

```bash
npm run test:tensorflow
```

這會檢查：
- ✅ 目錄結構是否正確
- ✅ `tfjs_binding.node` 文件是否存在
- ✅ TensorFlow.js 模塊是否能正常加載

## 常見問題

### 問題 1：只有 `tensorflow.dll`，沒有 `tfjs_binding.node`

**症狀**：
- `napi-v8` 目錄只有 `tensorflow.dll` 文件
- 沒有 `tfjs_binding.node` 文件

**原因**：
構建過程沒有完全成功，只下載了預編譯的 DLL，但沒有編譯 native 綁定。

**解決方案**：

1. **確保使用 Developer Command Prompt**
   - 在開始菜單搜索 "Developer Command Prompt for VS"
   - 或導航到：`D:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat`

2. **清理並重新構建**
   ```bash
   # 在 Developer Command Prompt 中
   cd E:\42_Coding\PartyBillCalculator
   
   # 清理
   pnpm remove @tensorflow/tfjs-node
   
   # 重新安裝並構建
   pnpm install @tensorflow/tfjs-node
   pnpm rebuild @tensorflow/tfjs-node
   ```

3. **如果仍然失敗，嘗試使用 npm**
   ```bash
   npm rebuild @tensorflow/tfjs-node --build-addon-from-source
   ```

### 問題 2：構建成功但模塊加載失敗

**症狀**：
- `tfjs_binding.node` 文件存在
- 但運行時仍然報錯

**可能原因**：
- Node.js 版本不匹配
- 架構不匹配（x64 vs x86）
- 依賴的 DLL 缺失

**解決方案**：

1. **檢查 Node.js 版本**
   ```bash
   node -v
   ```
   確保使用 Node.js 18+ 和 64 位版本

2. **檢查文件架構**
   ```bash
   file node_modules/@tensorflow/tfjs-node/lib/napi-v8/tfjs_binding.node
   ```
   應該顯示 x64 架構

3. **檢查依賴**
   確保 `tensorflow.dll` 在同一目錄

### 問題 3：環境變量未設置

**症狀**：
- 構建時報錯 "could not find Visual Studio"
- 即使已安裝 Visual Studio

**解決方案**：

使用 Developer Command Prompt，它會自動設置所有必要的環境變量。

或者手動設置（在 Git Bash 中）：
```bash
export VSINSTALLDIR="/d/Program Files/Microsoft Visual Studio/18/Community"
export VCINSTALLDIR="$VSINSTALLDIR/VC"
export PATH="$VSINSTALLDIR/Common7/IDE:$PATH"
```

### 問題 4：預構建二進制文件下載失敗（404）

**症狀**：
```
node-pre-gyp ERR! install response status 404 Not Found
```

**原因**：
TensorFlow.js 沒有為你的 Node.js 版本提供預構建的二進制文件。

**解決方案**：
這不是問題！node-pre-gyp 會自動回退到從源代碼構建。確保：
1. 已安裝 Visual Studio Build Tools
2. 使用 Developer Command Prompt
3. 構建過程會自動編譯

## 驗證構建成功

構建成功後，應該看到：

```
node_modules/@tensorflow/tfjs-node/lib/napi-v8/
├── tensorflow.dll (約 200 MB)
└── tfjs_binding.node (約 1-5 MB)
```

運行測試：
```bash
npm run test:tensorflow
```

應該顯示：
```
✅ TensorFlow.js 可以正常使用！
```

## 如果所有方法都失敗

如果構建仍然失敗，可以：

1. **暫時跳過 TensorFlow.js**
   - 服務器可以正常啟動
   - 其他功能都正常工作
   - 食物識別功能會返回 503 錯誤

2. **使用 CPU 版本（如果可用）**
   - 某些版本可能提供純 JavaScript 實現
   - 性能較慢但不需要編譯

3. **等待或使用其他方案**
   - 使用現有的 AI API 作為備選方案
   - 或等待 TensorFlow.js 提供預構建二進制文件

## 獲取幫助

如果問題持續存在：

1. 運行診斷腳本並保存輸出：
   ```bash
   npm run test:tensorflow > build-diagnostic.txt 2>&1
   ```

2. 檢查構建日誌：
   ```bash
   pnpm rebuild @tensorflow/tfjs-node 2>&1 | tee build-log.txt
   ```

3. 提供以下信息：
   - Node.js 版本 (`node -v`)
   - 操作系統版本
   - Visual Studio 版本
   - 診斷腳本輸出
   - 構建日誌

