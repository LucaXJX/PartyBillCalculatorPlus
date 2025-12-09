# 餐廳推薦功能測試指南

## 測試前準備

### 1. 確保服務器運行

```bash
cd E:/42_Coding/PartyBillCalculator
npm run dev
```

服務器應該在 `http://localhost:3000` 運行。

### 2. 準備測試數據

#### 2.1 確保有餐廳數據

餐廳數據可以通過以下方式獲取：

- 運行爬蟲腳本：`node --loader ts-node/esm scraper/examples/scrape-by-food-recognition.ts`
- 或使用 seed 數據：`npm run db:seed`

#### 2.2 確保有用戶賬號

1. 訪問 `http://localhost:3000/registration-page.html` 註冊新用戶
2. 或使用現有賬號登錄 `http://localhost:3000/login-page.html`

#### 2.3 創建用戶偏好記錄（可選）

可以通過心動模式（`http://localhost:3000/heart-mode.html`）記錄一些偏好，或直接調用 API：

```bash
# 記錄喜歡
POST /api/restaurants/feedback
{
  "restaurant_id": "restaurant_id_here",
  "preference": "like"
}

# 記錄收藏
POST /api/restaurants/:id/preference
{
  "preference": "favorite"
}
```

## 測試步驟

### 步驟 1：基本推薦測試（無位置信息）

**目標**：測試基本推薦功能，使用用戶歷史偏好

**請求**：

```bash
curl -X GET "http://localhost:3000/api/restaurants/recommend?limit=5" \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  -H "Content-Type: application/json"
```

**或在瀏覽器控制台**：

```javascript
const sessionId = localStorage.getItem("sessionId");
fetch("/api/restaurants/recommend?limit=5", {
  headers: {
    Authorization: `Bearer ${sessionId}`,
    "Content-Type": "application/json",
  },
})
  .then((res) => res.json())
  .then((data) => {
    console.log("推薦結果:", data);
    console.log("推薦餐廳數量:", data.count);
    console.log("用戶偏好:", data.userPreferences);
    data.recommendations.forEach((rec, index) => {
      console.log(
        `${index + 1}. ${rec.restaurant.name} - 分數: ${rec.score.toFixed(2)}`
      );
      console.log(`   分解:`, rec.breakdown);
    });
  });
```

**預期結果**：

- 返回 5 個推薦餐廳
- 每個餐廳有分數和分數分解
- 如果用戶有歷史偏好，會顯示提取的偏好信息

### 步驟 2：帶位置信息的推薦測試

**目標**：測試距離計算功能

**請求**：

```bash
curl -X GET "http://localhost:3000/api/restaurants/recommend?limit=5&latitude=22.3193&longitude=114.1694" \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  -H "Content-Type: application/json"
```

**或在瀏覽器控制台**：

```javascript
const sessionId = localStorage.getItem("sessionId");
// 使用香港中環的坐標
fetch(
  "/api/restaurants/recommend?limit=5&latitude=22.3193&longitude=114.1694",
  {
    headers: {
      Authorization: `Bearer ${sessionId}`,
      "Content-Type": "application/json",
    },
  }
)
  .then((res) => res.json())
  .then((data) => {
    console.log("推薦結果（帶位置）:", data);
    data.recommendations.forEach((rec, index) => {
      const distance =
        rec.breakdown.distance > 0
          ? `距離分數: ${rec.breakdown.distance.toFixed(2)}`
          : "無距離信息";
      console.log(
        `${index + 1}. ${rec.restaurant.name} - 總分: ${rec.score.toFixed(
          2
        )} (${distance})`
      );
    });
  });
```

**預期結果**：

- 距離較近的餐廳分數更高
- 距離分數在 breakdown 中顯示

### 步驟 3：指定偏好的推薦測試

**目標**：測試價格和菜系偏好匹配

**請求**：

```bash
curl -X GET "http://localhost:3000/api/restaurants/recommend?limit=5&price_range=$$&cuisine_type=中餐" \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  -H "Content-Type: application/json"
```

**或在瀏覽器控制台**：

```javascript
const sessionId = localStorage.getItem("sessionId");
fetch("/api/restaurants/recommend?limit=5&price_range=$$&cuisine_type=中餐", {
  headers: {
    Authorization: `Bearer ${sessionId}`,
    "Content-Type": "application/json",
  },
})
  .then((res) => res.json())
  .then((data) => {
    console.log("推薦結果（指定偏好）:", data);
    data.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec.restaurant.name}`);
      console.log(
        `   菜系: ${rec.restaurant.cuisine_type}, 價格: ${rec.restaurant.price_range}`
      );
      console.log(
        `   價格匹配: ${rec.breakdown.price.toFixed(
          2
        )}, 菜系匹配: ${rec.breakdown.cuisine.toFixed(2)}`
      );
    });
  });
```

**預期結果**：

- 返回的餐廳應該匹配指定的價格範圍和菜系類型
- 價格和菜系匹配分數應該較高（接近 1.0）

### 步驟 4：最小分數過濾測試

**目標**：測試最小分數過濾功能

**請求**：

```bash
curl -X GET "http://localhost:3000/api/restaurants/recommend?limit=10&min_score=0.5" \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  -H "Content-Type: application/json"
```

**預期結果**：

- 只返回分數 >= 0.5 的餐廳
- 低分餐廳被過濾掉

### 步驟 5：完整場景測試（心動模式 + 推薦）

**目標**：測試完整流程

1. **使用心動模式記錄偏好**：

   - 訪問 `http://localhost:3000/heart-mode.html`
   - 右滑或點擊愛心按鈕記錄幾個喜歡的餐廳
   - 點擊星星按鈕記錄幾個收藏的餐廳

2. **獲取推薦**：
   ```javascript
   const sessionId = localStorage.getItem("sessionId");
   fetch("/api/restaurants/recommend?limit=10", {
     headers: {
       Authorization: `Bearer ${sessionId}`,
       "Content-Type": "application/json",
     },
   })
     .then((res) => res.json())
     .then((data) => {
       console.log("推薦結果（基於心動模式偏好）:", data);
       console.log("提取的用戶偏好:", data.userPreferences);
     });
   ```

**預期結果**：

- 系統自動從心動模式的偏好中提取菜系和價格偏好
- 推薦的餐廳應該與用戶的歷史偏好相關

## 驗證要點

### 1. 分數計算驗證

檢查每個推薦餐廳的分數分解是否合理：

```javascript
// 驗證分數計算
data.recommendations.forEach((rec) => {
  const calculatedScore =
    rec.breakdown.preference * 0.3 +
    rec.breakdown.rating * 0.25 +
    rec.breakdown.distance * 0.2 +
    rec.breakdown.price * 0.15 +
    rec.breakdown.cuisine * 0.1;

  console.log(
    `計算分數: ${calculatedScore.toFixed(2)}, 實際分數: ${rec.score.toFixed(2)}`
  );
  // 應該非常接近（允許小數點誤差）
});
```

### 2. 排序驗證

檢查推薦列表是否按分數降序排列：

```javascript
// 驗證排序
let prevScore = Infinity;
data.recommendations.forEach((rec, index) => {
  if (rec.score > prevScore) {
    console.error(
      `排序錯誤: 第 ${index} 個餐廳分數 ${rec.score} 大於前一個 ${prevScore}`
    );
  }
  prevScore = rec.score;
});
```

### 3. 偏好提取驗證

檢查系統是否正確提取了用戶偏好：

```javascript
// 驗證偏好提取
console.log("提取的菜系偏好:", data.userPreferences.cuisineTypes);
console.log("提取的價格偏好:", data.userPreferences.priceRanges);
```

## 常見問題排查

### 問題 1：沒有推薦結果

**可能原因**：

- 數據庫中沒有餐廳數據
- 所有餐廳都被過濾掉了（min_score 太高）

**解決方法**：

- 運行爬蟲或 seed 數據
- 降低 min_score 參數

### 問題 2：推薦分數都是 0

**可能原因**：

- 餐廳沒有評分
- 距離計算失敗
- 用戶沒有偏好記錄

**解決方法**：

- 檢查餐廳數據是否完整
- 確保提供了有效的坐標
- 記錄一些用戶偏好

### 問題 3：距離分數為 0

**可能原因**：

- 餐廳或用戶坐標為 0（無效坐標）
- 距離超過最大考慮距離（10 公里）

**解決方法**：

- 檢查坐標是否有效
- 調整 `maxDistance` 參數

## 測試腳本

可以創建一個簡單的測試腳本：

```javascript
// test-recommendation.js
async function testRecommendation() {
  const sessionId = process.env.SESSION_ID; // 從環境變量獲取

  const tests = [
    {
      name: "基本推薦",
      url: "/api/restaurants/recommend?limit=5",
    },
    {
      name: "帶位置推薦",
      url: "/api/restaurants/recommend?limit=5&latitude=22.3193&longitude=114.1694",
    },
    {
      name: "指定偏好推薦",
      url: "/api/restaurants/recommend?limit=5&price_range=$$&cuisine_type=中餐",
    },
  ];

  for (const test of tests) {
    console.log(`\n測試: ${test.name}`);
    const response = await fetch(`http://localhost:3000${test.url}`, {
      headers: {
        Authorization: `Bearer ${sessionId}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    console.log(`結果: ${data.count} 個推薦`);
    if (data.recommendations.length > 0) {
      console.log(
        `最高分: ${
          data.recommendations[0].restaurant.name
        } (${data.recommendations[0].score.toFixed(2)})`
      );
    }
  }
}

testRecommendation();
```

## 下一步

測試完成後，可以：

1. 調整權重配置以優化推薦效果
2. 在前端頁面集成推薦功能
3. 添加更多推薦因素（如時間、天氣等）
