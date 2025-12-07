# TensorFlow.js Node.js 構建問題修復

## 問題

運行服務器時出現錯誤：

```
Error: The Node.js native addon module (tfjs_binding.node) can not be found
```

## 原因

`@tensorflow/tfjs-node` 包含 native 模塊，需要編譯。pnpm 默認不會構建 native 依賴，除非明確列入白名單。

## 永久解決方案（啟用食物識別功能）

要啟用食物識別功能，需要構建 TensorFlow.js。以下是解決方案：

### 方案 1：使用 pnpm 構建（推薦）

1. **確保已添加到 `onlyBuiltDependencies`**

   檢查 `package.json` 中是否包含：

   ```json
   {
     "pnpm": {
       "onlyBuiltDependencies": ["@tensorflow/tfjs-node"]
     }
   }
   ```

2. **重新安裝並構建**

   ```bash
   pnpm install
   ```

   如果仍然失敗，嘗試：

   ```bash
   pnpm rebuild @tensorflow/tfjs-node
   ```

### 方案 2：使用 npm rebuild（如果 pnpm 失敗）

```bash
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

### 方案 3：Windows 構建工具

如果構建失敗，可能需要安裝 Windows 構建工具：

1. **安裝 Visual Studio Build Tools**

   - 下載：https://visualstudio.microsoft.com/downloads/
   - 選擇 "Desktop development with C++" 工作負載

2. **或使用 npm 安裝構建工具**

   ```bash
   npm install --global windows-build-tools
   ```

3. **然後重新構建**
   ```bash
   npm rebuild @tensorflow/tfjs-node --build-addon-from-source
   ```

### 方案 4：使用預構建的二進制文件（臨時方案）

如果構建仍然失敗，可以暫時使用 CPU 版本，它不需要編譯：

```typescript
// 在 server/food-recognition/models/ModelLoader.ts 等文件中
// 暫時使用 CPU 版本
import * as tf from "@tensorflow/tfjs-node"; // CPU 版本
// 而不是 @tensorflow/tfjs-node-gpu
```

## 驗證構建

構建成功後，檢查文件是否存在：

```bash
# Windows (Git Bash)
find node_modules/@tensorflow/tfjs-node -name "*.node" 2>/dev/null

# 應該找到類似：
# node_modules/@tensorflow/tfjs-node/lib/napi-v8/tfjs_binding.node
```

## 參考資料

- TensorFlow.js Windows 故障排除：https://github.com/tensorflow/tfjs/blob/master/tfjs-node/WINDOWS_TROUBLESHOOTING.md
- pnpm 構建配置：https://pnpm.io/package_json#pnpmonlybuiltdependencies
