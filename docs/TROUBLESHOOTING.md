# 故障排除指南

## 問題：API 端點 404 錯誤

### 症狀

```
POST http://localhost:3000/api/receipt/upload 404 (Not Found)
Cannot POST /api/receipt/upload
```

### 原因分析

儘管 TypeScript 源代碼中已經定義了 API 端點，但服務器仍然返回 404 錯誤。這可能是由於：

1. **ts-node 緩存問題**：ts-node 有時不會正確重新加載修改過的文件
2. **服務器未重啟**：雖然重啟了，但可能沒有完全重新加載
3. **路由註冊問題**：極少數情況下路由可能沒有正確註冊

### 解決方案

#### 方案 1：使用編譯後的文件運行（推薦）

```bash
# 1. 編譯TypeScript
npm run build

# 2. 使用編譯後的文件運行
npm start
```

**優點**：

- ✅ 更穩定，沒有 ts-node 的緩存問題
- ✅ 性能更好
- ✅ 更接近生產環境

#### 方案 2：清理並重新啟動開發模式

```bash
# 1. 停止服務器（Ctrl+C）

# 2. 清理node模塊緩存
rm -rf node_modules/.cache

# 3. 重新編譯
npm run build

# 4. 重新啟動開發服務器
npm run dev
```

#### 方案 3：使用 nodemon 自動重載

```bash
# 使用watch模式，文件修改時自動重啟
npm run dev:watch
```

### 驗證 API 端點

運行以下命令檢查 API 端點是否正確註冊：

```bash
# 檢查TypeScript源文件
grep -n "app.post.*receipt.*upload" server/server.ts

# 檢查編譯後的文件
grep -n "app.post.*receipt.*upload" dist/server.js
```

**預期輸出**：

- `server/server.ts:292:app.post("/api/receipt/upload", ...`
- `dist/server.js:239:app.post("/api/receipt/upload", ...`

### 測試 API 端點

服務器啟動後，可以使用 curl 測試 API 是否可訪問：

```bash
# 測試端點是否存在（會返回401，因為沒有認證，但說明端點存在）
curl -X POST http://localhost:3000/api/receipt/upload
```

**預期響應**：

- ❌ 404: 端點不存在，需要重啟服務器
- ✅ 401: 端點存在，但需要認證（這是正常的）

---

## 當前狀態

### ✅ 已確認

- TypeScript 源文件包含 API 端點（第 292 行）
- 編譯後的文件包含 API 端點（第 239 行）
- API 路由在靜態文件中間件之前註冊（正確順序）

### ⚠️ 需要檢查

- 服務器是否使用了正確的文件
- ts-node 是否正確加載了最新代碼

---

## 建議

**請使用方案 1（編譯後運行）**：

```bash
# 停止當前服務器（Ctrl+C）
npm run build
npm start
```

這樣可以確保運行的是最新編譯的代碼，避免 ts-node 的緩存問題。
