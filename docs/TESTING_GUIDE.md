# 測試指南

## 問題診斷

如果遇到 404 錯誤或 "餐廳不存在" 錯誤，請按以下步驟檢查：

### 1. 檢查服務器是否運行

```bash
# 確保服務器正在運行
npm run dev
```

### 2. 檢查餐廳數據

**問題**：數據庫中沒有餐廳數據

**解決方法**：

```bash
# 方法 1: 運行爬蟲（推薦）
node --loader ts-node/esm scraper/examples/scrape-by-food-recognition.ts

# 方法 2: 運行 seed 數據
npm run db:seed
```

**驗證**：

```javascript
// 在瀏覽器控制台執行
const sessionId = localStorage.getItem("sessionId");
fetch("/api/restaurants?limit=5", {
  headers: {
    Authorization: `Bearer ${sessionId}`,
    "Content-Type": "application/json",
  },
})
  .then((res) => res.json())
  .then((data) => {
    console.log("餐廳數量:", data.total);
    if (data.total === 0) {
      console.warn("⚠️  沒有餐廳數據，請先運行爬蟲或 seed");
    }
  });
```

### 3. 檢查路由順序

**問題**：路由順序錯誤導致 404

**解決方法**：確保具體路由在動態路由之前：

- ✅ `/api/restaurants/recommend` 在 `/api/restaurants/:id` 之前
- ✅ `/api/restaurants/next` 在 `/api/restaurants/:id` 之前
- ✅ `/api/restaurants/search` 在 `/api/restaurants/:id` 之前

### 4. 重啟服務器

修改代碼後，必須重啟服務器：

```bash
# 停止當前服務器（Ctrl+C）
# 然後重新啟動
npm run dev
```

## 測試步驟

### 步驟 1: 準備數據

```bash
# 1. 確保數據庫有餐廳數據
npm run db:seed

# 或運行爬蟲
node --loader ts-node/esm scraper/examples/scrape-by-food-recognition.ts
```

### 步驟 2: 啟動服務器

```bash
npm run dev
```

### 步驟 3: 登錄系統

1. 訪問 `http://localhost:3000/login-page.html`
2. 登錄你的賬號

### 步驟 4: 測試 API

在瀏覽器控制台執行：

```javascript
const sessionId = localStorage.getItem("sessionId");

// 測試 1: 基本推薦
fetch("/api/restaurants/recommend?limit=5", {
  headers: {
    Authorization: `Bearer ${sessionId}`,
    "Content-Type": "application/json",
  },
})
  .then((res) => res.json())
  .then((data) => {
    console.log("推薦結果:", data);
    if (data.recommendations) {
      console.log("✅ 推薦 API 正常工作");
      console.log("推薦數量:", data.count);
    } else {
      console.error("❌ 推薦 API 返回錯誤:", data);
    }
  });

// 測試 2: 心動模式
fetch("/api/restaurants/next", {
  headers: {
    Authorization: `Bearer ${sessionId}`,
    "Content-Type": "application/json",
  },
})
  .then((res) => res.json())
  .then((data) => {
    console.log("下一個餐廳:", data);
    if (data.restaurant) {
      console.log("✅ 心動模式 API 正常工作");
    } else {
      console.warn("⚠️  沒有更多餐廳:", data.message);
    }
  });
```

## 常見錯誤及解決方法

### 錯誤 1: 404 Not Found

**原因**：路由未註冊或路由順序錯誤

**解決**：

1. 檢查服務器是否重啟
2. 檢查路由順序（具體路由在動態路由之前）
3. 檢查編譯是否成功（`npm run build`）

### 錯誤 2: "餐廳不存在"

**原因**：數據庫中沒有餐廳數據

**解決**：

1. 運行爬蟲或 seed 數據
2. 檢查 `proxy.restaurant` 是否有數據

### 錯誤 3: 401 Unauthorized

**原因**：未登錄或 sessionId 無效

**解決**：

1. 重新登錄
2. 檢查 `localStorage.getItem("sessionId")` 是否有值

### 錯誤 4: 推薦結果為空

**原因**：

- 沒有餐廳數據
- 所有餐廳都被過濾掉了
- min_score 設置太高

**解決**：

1. 檢查餐廳數據
2. 降低 min_score 參數
3. 檢查篩選條件是否太嚴格

## 快速測試腳本

創建 `test-api.html`：

```html
<!DOCTYPE html>
<html>
  <head>
    <title>API 測試</title>
  </head>
  <body>
    <h1>餐廳 API 測試</h1>
    <button onclick="testRecommend()">測試推薦</button>
    <button onclick="testNext()">測試心動模式</button>
    <pre id="result"></pre>

    <script>
      const sessionId = localStorage.getItem("sessionId");
      if (!sessionId) {
        alert("請先登錄");
        window.location.href = "/login-page.html";
      }

      async function testRecommend() {
        const res = await fetch("/api/restaurants/recommend?limit=5", {
          headers: {
            Authorization: `Bearer ${sessionId}`,
            "Content-Type": "application/json",
          },
        });
        const data = await res.json();
        document.getElementById("result").textContent = JSON.stringify(
          data,
          null,
          2
        );
      }

      async function testNext() {
        const res = await fetch("/api/restaurants/next", {
          headers: {
            Authorization: `Bearer ${sessionId}`,
            "Content-Type": "application/json",
          },
        });
        const data = await res.json();
        document.getElementById("result").textContent = JSON.stringify(
          data,
          null,
          2
        );
      }
    </script>
  </body>
</html>
```

訪問 `http://localhost:3000/test-api.html` 進行測試。
