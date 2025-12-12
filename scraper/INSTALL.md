# 爬蟲依賴安裝指南

## Playwright 安裝

OpenRice 爬蟲使用 Playwright 進行瀏覽器自動化。以下是安裝步驟：

### 1. 安裝 Playwright 包

```bash
npm install playwright
```

### 2. 安裝 Chromium 瀏覽器

Playwright 需要下載瀏覽器二進制文件：

```bash
npx playwright install chromium
```

這會下載 Chromium 瀏覽器（約 200-300 MB），可能需要一些時間。

### 3. 驗證安裝

運行以下命令驗證 Playwright 是否正常工作：

```bash
node --loader ts-node/esm -e "import { chromium } from 'playwright'; console.log('Playwright OK');"
```

### 注意事項

1. **如果遇到 TensorFlow 編譯錯誤**：
   - 項目已改用純 JavaScript 版本的 TensorFlow.js (`@tensorflow/tfjs`)
   - 如果 `@tensorflow/tfjs-node` 導致安裝失敗，可以：
     - 從 `package.json` 中移除 `@tensorflow/tfjs-node`
     - 使用 `npm install --ignore-scripts` 跳過編譯步驟

2. **Playwright 已通過其他依賴安裝**：
   - 如果項目中已有 `image-dataset` 依賴，Playwright 可能已經通過它安裝
   - 但仍建議單獨安裝 Playwright 以確保版本一致

3. **瀏覽器下載**：
   - Chromium 瀏覽器會下載到 `node_modules/.cache/playwright/` 目錄
   - 如果下載失敗，可以手動下載或使用代理

## 使用爬蟲

安裝完成後，可以運行爬蟲示例：

```bash
npm run scrape:openrice
```

或直接運行：

```bash
node --loader ts-node/esm scraper/examples/scrape-by-food-recognition.ts
```





