# Google Maps API 設置指南

## 概述

心動模式支持使用 Google Maps Distance Matrix API 來計算用戶位置與餐廳之間的實際距離和行車時間。如果沒有配置 Google Maps API Key，系統會自動使用 Haversine 公式計算直線距離（備選方案）。

## 為什麼需要 Google Maps API？

- **更準確的距離**：Google Maps 提供實際道路距離，而不是直線距離
- **行車時間**：可以顯示從用戶位置到餐廳的預計行車時間
- **更好的用戶體驗**：用戶可以根據實際交通情況做出選擇

## 設置步驟

### 1. 獲取 Google Maps API Key

1. 訪問 [Google Cloud Console](https://console.cloud.google.com/)
2. 創建新項目或選擇現有項目
3. 啟用以下 API：
   - **Maps JavaScript API**（用於加載地圖庫）
   - **Distance Matrix API**（用於計算距離和時間）
   - **Geocoding API**（可選，用於地址解析）
4. 創建 API Key：
   - 導航到「憑證」頁面
   - 點擊「創建憑證」→「API 金鑰」
   - 複製生成的 API Key

### 2. 配置 API Key（可選）

有兩種方式配置 API Key：

#### 方式 1：在 HTML 中直接配置（開發環境）

編輯 `public/heart-mode.html`，找到以下代碼：

```javascript
const GOOGLE_MAPS_API_KEY = window.GOOGLE_MAPS_API_KEY || null;
```

修改為：

```javascript
const GOOGLE_MAPS_API_KEY = 'YOUR_API_KEY_HERE' || null;
```

#### 方式 2：通過環境變數配置（推薦，生產環境）

在服務器端設置環境變數，然後在 HTML 中通過服務器端渲染傳遞：

```javascript
// 在 server.ts 中
app.get('/heart-mode.html', (req, res) => {
  res.render('heart-mode', {
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || null
  });
});
```

或者在 HTML 中通過全局變數設置：

```html
<script>
  window.GOOGLE_MAPS_API_KEY = 'YOUR_API_KEY_HERE';
</script>
```

### 3. 設置 API 限制（安全建議）

1. 在 Google Cloud Console 中，編輯你的 API Key
2. 設置「應用程式限制」：
   - 選擇「HTTP 參照網址（網站）」
   - 添加你的網站域名（例如：`https://yourdomain.com/*`）
3. 設置「API 限制」：
   - 選擇「限制金鑰」
   - 只啟用需要的 API（Maps JavaScript API、Distance Matrix API）

### 4. 測試配置

1. 啟動開發服務器：`npm run dev`
2. 訪問 `http://localhost:3000/heart-mode.html`
3. 打開瀏覽器控制台，應該看到：
   - 如果配置成功：`✅ Google Maps API 已加載`
   - 如果未配置：`ℹ️ 未配置 Google Maps API Key，將使用 Haversine 公式計算距離`

## 費用說明

Google Maps API 提供免費額度：
- **Maps JavaScript API**：每月 28,000 次加載（免費）
- **Distance Matrix API**：每月 40,000 次請求（免費）
- **Geocoding API**：每月 40,000 次請求（免費）

對於個人項目和小型應用，免費額度通常足夠使用。

## 備選方案：Haversine 公式

如果沒有配置 Google Maps API Key，系統會自動使用 Haversine 公式計算直線距離。這是一個完全免費的方案，但有以下限制：

- **只計算直線距離**：不考慮實際道路情況
- **沒有行車時間**：無法顯示預計行車時間
- **準確度較低**：在城市中，直線距離可能與實際距離相差較大

## 故障排除

### 問題 1：API Key 無效

**錯誤信息**：`Google Maps API 加載失敗`

**解決方案**：
- 檢查 API Key 是否正確
- 確認已啟用必要的 API
- 檢查 API 限制設置

### 問題 2：超出配額

**錯誤信息**：`OVER_QUERY_LIMIT`

**解決方案**：
- 檢查 Google Cloud Console 中的使用量
- 考慮升級到付費計劃
- 優化 API 調用頻率

### 問題 3：瀏覽器阻止地理位置

**錯誤信息**：`無法獲取用戶位置`

**解決方案**：
- 確保網站使用 HTTPS（生產環境）
- 檢查瀏覽器位置權限設置
- 用戶需要允許網站訪問位置信息

## 相關文檔

- [Google Maps JavaScript API 文檔](https://developers.google.com/maps/documentation/javascript)
- [Distance Matrix API 文檔](https://developers.google.com/maps/documentation/distance-matrix)
- [Google Cloud Console](https://console.cloud.google.com/)



