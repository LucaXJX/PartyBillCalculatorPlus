# 餐廳資料爬蟲系統

本目錄包含餐廳資料自動抓取的相關代碼和配置。

## 📁 目錄結構

```
scraper/
├── README.md                    # 本文件
├── robots-compliance.md         # Robots.txt 合規性文檔
├── config.ts                    # 爬蟲配置文件（目標網站列表）
├── scrapers/                    # 爬蟲實現
│   ├── restaurant-scraper.ts   # 基礎爬蟲類和匹配器
│   ├── openrice-scraper.ts      # OpenRice 爬蟲
│   ├── google-maps-scraper.ts   # Google Maps 爬蟲（待實現）
│   └── types.ts                # 類型定義
├── utils/                       # 工具函數
│   ├── rate-limiter.ts         # 速率限制
│   ├── data-cleaner.ts         # 資料清洗
│   └── validator.ts            # 資料驗證
└── data/                        # 爬取的原始資料（不提交到 Git）
    └── raw/
```

## 🎯 核心功能

### 1. 餐廳匹配機制

爬蟲系統可以根據以下條件匹配餐廳：

- **食物類型匹配**：根據食物名稱（例如：小籠包、壽司、拉麵）匹配餐廳
- **國家/菜系匹配**：根據菜系類型（例如：中餐、日料、韓式）匹配餐廳
- **地理位置限制**：只爬取香港地區的餐廳
- **坐標記錄**：必須記錄餐廳的經緯度坐標，以便後續計算距離

### 2. 匹配流程

```
食物識別結果（國家 + 食物名稱）
    ↓
RestaurantMatcher.createCriteriaFromFoodRecognition()
    ↓
生成匹配條件（菜系類型 + 食物類型 + 城市="香港"）
    ↓
爬蟲根據條件搜索餐廳
    ↓
驗證餐廳資料（必須有坐標、必須在香港）
    ↓
匹配餐廳（檢查菜系、食物類型、評分等）
    ↓
返回匹配的餐廳列表
```

### 3. 資料驗證

所有爬取的餐廳資料必須通過以下驗證：

- ✅ 城市必須是 "香港"
- ✅ 必須有經緯度坐標
- ✅ 坐標必須在香港範圍內（緯度：22.15-22.58，經度：113.83-114.51）
- ✅ 必須有餐廳名稱

## 🎯 目標網站

### 1. OpenRice（開飯喇）⭐ 主要使用

- **網站**：https://www.openrice.com
- **優勢**：香港本地餐廳資料豐富，中文支持好
- **資料類型**：餐廳名稱、地址、評分、菜系、價格範圍、評論、坐標
- **狀態**：✅ 已實現基礎爬蟲類

### 2. Google Maps

- **網站**：https://www.google.com/maps
- **優勢**：全球覆蓋，資料準確，包含地理座標
- **資料類型**：餐廳名稱、地址、評分、評論、營業時間、地理座標
- **狀態**：⚠️ 建議使用 Google Places API（官方 API）

### 3. Yelp（已跳過）

- **網站**：https://www.yelp.com
- **優勢**：國際化，評分系統完善
- **資料類型**：餐廳名稱、地址、評分、價格範圍、評論
- **狀態**：❌ 已跳過（Yelp Fusion API 需要付費，robots.txt 也禁止爬蟲）

## ⚖️ 法律與道德注意事項

### Robots.txt 合規性

**重要**：在開始爬蟲前，必須：

1. ✅ 檢查目標網站的 `robots.txt` 文件
2. ✅ 遵守 `User-agent` 規則
3. ✅ 遵守 `Crawl-delay` 要求
4. ✅ 避免爬取被 `Disallow` 的路徑
5. ✅ 尊重網站的服務條款（ToS）

詳見 [robots-compliance.md](./robots-compliance.md)

### 最佳實踐

1. **速率限制**

   - 使用合理的請求間隔（建議 3-5 秒）
   - 避免並發請求過多
   - 實現指數退避重試機制

2. **用戶代理**

   - 使用真實的 User-Agent
   - 標註為學習/研究用途
   - 包含聯繫方式（可選）

3. **資料使用**

   - 僅用於學習和研究目的
   - 不進行商業用途
   - 尊重版權和隱私

4. **錯誤處理**
   - 捕獲並記錄錯誤
   - 實現優雅降級
   - 避免無限重試

## 🚀 快速開始

### 安裝依賴

```bash
# 安裝 Playwright（用於瀏覽器自動化）
npm install playwright
npx playwright install chromium

# 注意：Playwright 需要下載瀏覽器二進制文件，可能需要一些時間
```

### 使用示例

```typescript
import { OpenRiceScraper } from "./scrapers/openrice-scraper.js";
import { RestaurantMatcher } from "./scrapers/restaurant-scraper.js";
import { getTargetConfig, scraperConfig } from "./config.js";

// 1. 根據食物識別結果創建匹配條件
const criteria = RestaurantMatcher.createCriteriaFromFoodRecognition(
  "chinese", // 國家
  "小籠包" // 食物名稱（可選）
);

// 2. 創建爬蟲實例
const openRiceConfig = getTargetConfig("OpenRice")!;
const scraper = new OpenRiceScraper(openRiceConfig, scraperConfig.userAgent);

// 3. 爬取餐廳
try {
  await scraper.initialize();
  const restaurants = await scraper.scrapeRestaurants(criteria);
  console.log(`✅ 找到 ${restaurants.length} 個匹配的餐廳`);

  // 4. 保存到數據庫
  for (const restaurant of restaurants) {
    // 保存到數據庫...
  }
} finally {
  await scraper.close();
}
```

### 運行爬蟲

```bash
# 爬取 OpenRice
npm run scrape:openrice

# 爬取所有目標網站
npm run scrape:all
```

## 📝 資料格式

爬取的資料將轉換為統一的格式：

```typescript
interface RestaurantData {
  name: string; // 餐廳名稱
  name_en?: string; // 英文名稱
  description?: string; // 描述
  cuisine_type?: string; // 菜系類型（中餐、日料、韓式等）
  price_range?: string; // 價位（$, $$, $$$, $$$$）
  rating?: number; // 評分（0-5）
  review_count?: number; // 評論數量
  address?: string; // 地址
  city: string; // 城市（必須是 "香港"）
  latitude: number; // 緯度（必須有，香港範圍：22.15-22.58）
  longitude: number; // 經度（必須有，香港範圍：113.83-114.51）
  phone?: string; // 電話
  website?: string; // 網站
  image_url?: string; // 圖片 URL
  tags?: string[]; // 標籤（可用於匹配食物類型）
  source: string; // 資料來源（openrice, google-maps, yelp）
  source_url: string; // 原始 URL
  scraped_at: string; // 爬取時間（ISO 8601）
}
```

## 🔧 配置

編輯 `config.ts` 來配置：

- 目標網站列表
- 爬取區域（固定為香港）
- 速率限制參數
- 資料存儲路徑

## 📊 資料清洗

爬取的原始資料需要經過清洗：

1. 去除重複記錄
2. 標準化格式（地址、電話、評分）
3. 驗證資料完整性（坐標、城市）
4. 合併多來源資料（去重）

詳見 `utils/data-cleaner.ts`

## ⚠️ 注意事項

1. **反爬蟲機制**：某些網站可能有反爬蟲機制，需要：

   - 使用代理輪換
   - 模擬真實用戶行為
   - 處理驗證碼（如需要）

2. **資料更新**：餐廳資料可能經常變化，建議：

   - 定期更新（每週/每月）
   - 記錄資料版本
   - 比較差異並更新

3. **錯誤處理**：爬蟲可能因為網站結構變化而失敗，需要：

   - 監控爬蟲狀態
   - 記錄錯誤日誌
   - 實現自動恢復機制

4. **坐標獲取**：如果餐廳頁面沒有坐標，需要：
   - 使用地理編碼 API（Google Geocoding API、OpenStreetMap 等）
   - 從地址解析坐標
   - 驗證坐標是否在香港範圍內

## 📚 參考資料

- [Playwright 文檔](https://playwright.dev/)
- [Puppeteer 文檔](https://pptr.dev/)
- [Robots.txt 規範](https://www.robotstxt.org/)
- [Web Scraping 最佳實踐](https://www.scrapehero.com/web-scraping-best-practices/)
- [Google Geocoding API](https://developers.google.com/maps/documentation/geocoding)
