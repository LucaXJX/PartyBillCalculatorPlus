# 雙重識別系統測試指南

## ✅ 遷移狀態確認

數據庫字段已成功添加：
- ✅ `model_recognition_result` (TEXT)
- ✅ `model_recognition_confidence` (float)
- ✅ `model_recognition_at` (varchar(64))
- ✅ `model_recognition_error` (TEXT)

## 📋 測試步驟

### 1. 啟動服務器

```bash
npm run dev
# 或
npm start
```

確認服務器正常啟動，檢查控制台輸出：
- ✅ TensorFlow.js 模塊加載成功（如果模型可用）
- ✅ 模型識別管道已設置

### 2. 測試雙重識別功能

#### 2.1 上傳食物圖片

**API 端點：** `POST /api/bills/:billId/food-images`

**測試步驟：**
1. 創建一個測試訂單（如果還沒有）
2. 上傳一張食物圖片到該訂單
3. 等待 10 秒（識別調度器會自動觸發識別）

**預期結果：**
- 圖片上傳成功
- 10 秒後自動開始識別
- 控制台顯示識別進度

#### 2.2 檢查識別結果

**API 端點：** `GET /api/bills/:billId/food-images`

**測試步驟：**
```bash
curl -X GET http://localhost:3000/api/bills/{billId}/food-images \
  -H "Authorization: Bearer {token}"
```

**預期結果：**
返回的圖片記錄應包含：
- `recognitionResult`: API 識別結果（JSON 字符串）
- `modelRecognitionResult`: 模型識別結果（JSON 字符串，如果模型可用）
- `modelRecognitionConfidence`: 模型識別置信度
- `recognitionStatus`: 2（已識別）

**檢查數據庫：**
```sql
SELECT 
  id,
  recognition_status,
  recognition_result,
  model_recognition_result,
  model_recognition_confidence,
  recognition_at,
  model_recognition_at
FROM food_images
WHERE bill_id = '{billId}';
```

### 3. 測試推薦 API

#### 3.1 獲取訂單推薦

**API 端點：** `GET /api/bills/:billId/food-recommendations`

**測試步驟：**
```bash
curl -X GET http://localhost:3000/api/bills/{billId}/food-recommendations \
  -H "Authorization: Bearer {token}"
```

**預期響應：**
```json
{
  "recommendations": [
    {
      "name": "紅燒肉",
      "source": "api",
      "confidence": 0.95,
      "calories": 350,
      "description": "API 識別（置信度: 95.0%）"
    },
    {
      "name": "紅燒肉",
      "source": "model",
      "confidence": 0.82,
      "country": "chinese",
      "description": "模型識別（chinese，置信度: 82.0%）"
    },
    {
      "name": "紅燒肉",
      "source": "combined",
      "confidence": 0.95,
      "calories": 350,
      "country": "chinese",
      "description": "API + 模型識別（置信度: 95.0%）"
    }
  ],
  "formatted": "1. [chinese] 紅燒肉（約 350 卡路里） - API + 模型識別（置信度: 95.0%）\n2. ...",
  "imageCount": 2
}
```

**測試點：**
- ✅ 推薦列表包含 API 和模型識別結果
- ✅ 相同食物自動合併為 `combined`
- ✅ 按置信度排序
- ✅ 格式化輸出正確

#### 3.2 獲取單張圖片推薦

**API 端點：** `GET /api/food-images/:imageId/recommendations`

**測試步驟：**
```bash
curl -X GET http://localhost:3000/api/food-images/{imageId}/recommendations \
  -H "Authorization: Bearer {token}"
```

### 4. 測試邊界情況

#### 4.1 只有 API 識別成功

**場景：** 模型識別失敗或不可用

**預期：**
- `recognitionResult` 有值
- `modelRecognitionResult` 為 null
- 推薦列表只包含 API 結果

#### 4.2 只有模型識別成功

**場景：** API 調用失敗（超過限制、網絡錯誤等）

**預期：**
- `recognitionResult` 為 null
- `modelRecognitionResult` 有值
- 推薦列表只包含模型結果

#### 4.3 兩個都失敗

**場景：** API 和模型都失敗

**預期：**
- `recognitionStatus` 為 3（識別失敗）
- `recognitionError` 和 `modelRecognitionError` 都有錯誤信息
- 推薦列表為空

### 5. 檢查日誌

**查看服務器控制台輸出：**

```
開始識別訂單 {billId} 的食物圖片...
圖片 {imageId} 識別完成
訂單 {billId} 的食物圖片識別完成
```

**如果模型識別失敗，會看到：**
```
模型識別失敗: {error message}
```

**如果 API 識別失敗，會看到：**
```
菜品識別失敗: {error message}
```

### 6. 性能測試

**測試並行識別：**
1. 上傳多張圖片（最多 2 張）
2. 觀察識別是否並行執行
3. 檢查總耗時是否小於串行執行時間

**預期：**
- API 和模型識別同時進行
- 總耗時 ≈ max(API 耗時, 模型耗時)

## 🔍 調試技巧

### 檢查模型是否加載

**API 端點：** `GET /api/food/models/active`

```bash
curl -X GET http://localhost:3000/api/food/models/active \
  -H "Authorization: Bearer {token}"
```

### 手動觸發識別

如果自動識別沒有觸發，可以手動觸發：

**API 端點：** `POST /api/food/health-check/fix-unrecognized`

```bash
curl -X POST http://localhost:3000/api/food/health-check/fix-unrecognized \
  -H "Authorization: Bearer {token}"
```

### 查看識別狀態

**檢查未識別的圖片：**

```sql
SELECT 
  id,
  bill_id,
  recognition_status,
  recognition_error,
  model_recognition_error
FROM food_images
WHERE recognition_status IN (0, 3);
```

## 📝 測試檢查清單

- [ ] 遷移成功應用
- [ ] 服務器正常啟動
- [ ] 圖片上傳功能正常
- [ ] API 識別結果正確保存
- [ ] 模型識別結果正確保存（如果模型可用）
- [ ] 推薦 API 返回正確結果
- [ ] 相同食物自動合併
- [ ] 格式化輸出正確
- [ ] 邊界情況處理正確
- [ ] 錯誤處理正確
- [ ] 日誌輸出清晰

## 🐛 常見問題

### Q: 模型識別結果為空

**可能原因：**
1. 模型未加載（檢查 TensorFlow.js 是否可用）
2. 模型文件不存在（檢查 `food-recognition-service/models_tfjs/`）
3. 圖片格式不支持

**解決方案：**
- 檢查服務器啟動日誌
- 確認模型文件路徑正確
- 檢查圖片格式（支持 jpg, jpeg, png）

### Q: API 識別失敗

**可能原因：**
1. 百度 API 配置錯誤
2. API 使用量超限
3. 網絡連接問題

**解決方案：**
- 檢查 `.env` 中的 `BAIDU_API_KEY` 和 `BAIDU_SECRET_KEY`
- 檢查 API 使用量：`SELECT COUNT(*) FROM food_api_usage WHERE success = 1;`

### Q: 推薦列表為空

**可能原因：**
1. 識別結果置信度太低（< 0.3）
2. 識別結果格式錯誤

**解決方案：**
- 檢查識別結果的 JSON 格式
- 降低置信度閾值（在 `foodRecommendationService.ts` 中）

## 🎯 下一步

測試完成後，可以：
1. 集成到前端 UI
2. 添加推薦結果的展示
3. 優化推薦算法
4. 添加推薦歷史記錄


