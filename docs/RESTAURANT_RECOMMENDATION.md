# 餐廳推薦演算法文檔

## 概述

餐廳推薦演算法使用規則加權排序，無需機器學習模型。它考慮多個因素來為用戶推薦最合適的餐廳。

## 推薦因素

### 1. 用戶歷史偏好（權重：30%）
- **favorite（收藏）**：1.0 分
- **like（喜歡）**：0.8 分
- **dislike（不喜歡）**：0.0 分
- **無偏好記錄**：0.5 分（中性）

### 2. 餐廳評分（權重：25%）
- 評分標準化到 0-1 範圍（除以 5.0）
- 低於最小評分（3.0）的餐廳得分為 0

### 3. 距離（權重：20%）
- 使用 Haversine 公式計算兩點之間的距離
- 距離分數使用指數衰減：`decayFactor ^ distance`
- 默認最大考慮距離：10 公里
- 超出最大距離的餐廳得分為 0

### 4. 價格匹配度（權重：15%）
- 如果餐廳價格在用戶偏好範圍內：1.0 分
- 否則：0.3 分

### 5. 菜系匹配度（權重：10%）
- 如果餐廳菜系在用戶偏好中：1.0 分
- 否則：0.3 分

## 推薦公式

```
總分 = (偏好分數 × 0.3) + (評分分數 × 0.25) + (距離分數 × 0.2) + (價格分數 × 0.15) + (菜系分數 × 0.1)
```

## API 端點

### GET `/api/restaurants/recommend`

獲取餐廳推薦列表。

#### 查詢參數

- `limit` (可選，默認 10)：返回的餐廳數量
- `latitude` (可選)：用戶緯度（用於計算距離）
- `longitude` (可選)：用戶經度（用於計算距離）
- `price_range` (可選)：用戶偏好價格範圍（如 "$$" 或 ["$", "$$"]）
- `cuisine_type` (可選)：用戶偏好菜系類型（如 "中餐" 或 ["中餐", "日料"]）
- `min_score` (可選，默認 0.0)：最小推薦分數（0-1）

#### 響應格式

```json
{
  "recommendations": [
    {
      "restaurant": {
        "id": "restaurant_id",
        "name": "餐廳名稱",
        "name_en": "Restaurant Name",
        "description": "餐廳描述",
        "cuisine_type": "中餐",
        "price_range": "$$",
        "rating": 4.5,
        "review_count": 100,
        "address": "餐廳地址",
        "city": "香港",
        "latitude": 22.3193,
        "longitude": 114.1694,
        "phone": "電話",
        "website": "網站",
        "image_url": "圖片 URL",
        "tags": ["標籤1", "標籤2"]
      },
      "score": 0.85,
      "breakdown": {
        "preference": 0.8,
        "rating": 0.9,
        "distance": 0.7,
        "price": 1.0,
        "cuisine": 1.0
      }
    }
  ],
  "count": 10,
  "userPreferences": {
    "cuisineTypes": ["中餐", "日料"],
    "priceRanges": ["$$", "$$$"]
  }
}
```

#### 示例請求

```bash
# 基本推薦（使用用戶歷史偏好）
GET /api/restaurants/recommend?limit=10

# 帶位置信息的推薦
GET /api/restaurants/recommend?latitude=22.3193&longitude=114.1694&limit=10

# 指定價格和菜系偏好
GET /api/restaurants/recommend?price_range=$$&cuisine_type=中餐&limit=10

# 設置最小分數
GET /api/restaurants/recommend?min_score=0.5&limit=10
```

## 自動偏好提取

如果用戶沒有明確指定偏好，系統會自動從用戶的歷史偏好記錄中提取：

1. **菜系偏好**：從用戶喜歡（like）或收藏（favorite）的餐廳中提取菜系類型
2. **價格偏好**：從用戶喜歡或收藏的餐廳中提取價格範圍

## 配置

推薦演算法的配置可以在 `restaurantRecommender.ts` 中的 `DEFAULT_CONFIG` 對象中調整：

```typescript
const DEFAULT_CONFIG: RecommendationConfig = {
  weights: {
    preference: 0.3,  // 用戶偏好權重
    rating: 0.25,     // 評分權重
    distance: 0.2,    // 距離權重
    price: 0.15,      // 價格匹配權重
    cuisine: 0.1,     // 菜系匹配權重
  },
  distanceParams: {
    maxDistance: 10,  // 最大考慮距離（公里）
    decayFactor: 0.8, // 距離衰減因子
  },
  ratingParams: {
    minRating: 3.0,   // 最小評分
    normalizeMax: 5.0, // 評分標準化最大值
  },
};
```

## 使用場景

1. **心動模式**：在用戶滑卡後，根據偏好推薦餐廳
2. **聚會推薦**：為下次聚會推薦餐廳，考慮所有參與者的偏好
3. **個人推薦**：根據用戶歷史行為推薦新餐廳

## 未來改進

- 引入協同過濾（基於相似用戶的偏好）
- 考慮時間因素（午餐 vs 晚餐）
- 考慮餐廳營業狀態
- 引入機器學習模型（可選）






