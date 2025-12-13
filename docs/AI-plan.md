## PartyBillCalculator AI 發展方向規劃

本文件總結 PBC 在完成資料庫升級（JSON → SQLite）後，進一步引入 AI 能力的可能方向。內容涵蓋「方向建議」、「推薦技術與 Library」、「難度」、「電腦與計算需求」等面向，作為後續開發參考路線圖。

> **更新日期**：2025-01-20  
> **當前狀態**：Phase 1-3 核心功能已完成（OCR + 食物識別 + 餐廳推薦系統）  
> **主要變更**：
>
> - 食物識別已從百度 API 遷移到 TensorFlow.js 分層識別架構（兩層實現，第三層暫時隱藏）
> - Phase 2 完成：餐廳資料爬蟲（OpenRice）+ 心動模式 UI
> - Phase 3 完成：餐廳推薦算法（規則加權排序）

---

## 核心需求 TodoList

> **說明**：本 TodoList 總結了 PBC AI 功能的核心需求與實施進度。已完成的項目標記為 `[x]`，待實現的項目標記為 `[ ]`。

### Phase 1：核心 AI 功能（短期）✅ 已完成 2/2

- [x] **1. 賬單 OCR + NLP 自動填寫** ✅

  - [x] PaddleOCR 微服務集成
  - [x] Mistral AI LLM 結構化解析
  - [x] 前端自動填表功能
  - [x] API 使用量追蹤與每日限制（10 次/天）
  - [x] 錯誤處理與降級方案
  - [ ] ⏳ 獎勵機制（上傳食物圖片獲得額外識別機會）

- [x] **2. 食物圖片識別** ✅
  - [x] 百度菜品識別 API 集成（備選方案）
  - [x] TensorFlow.js 分層識別模型（主要方案）✅
    - [x] 第一層：食物檢測（Food/Non-Food 二分類）
    - [x] 第二層：國家分類（10 個國家/地區）
    - [x] 第三層：細粒度分類（暫時隱藏，代碼保留）
  - [x] 圖片壓縮與存儲（Sharp）
  - [x] 異步識別調度機制
  - [x] 前端上傳與結果展示
  - [x] 模型加載與管理（自定義 FileSystemIOHandler）
  - [x] 圖像預處理（Sharp + TensorFlow.js）
  - [x] 健康檢查與批量修復機制
  - [ ] ⏳ 獎勵機制集成（識別成功後增加 OCR 次數）

### Phase 2：餐廳資料與偏好（中期）✅ 已完成 2/2

- [x] **3. 餐廳資料自動抓取** ✅

  - [x] 建立餐廳 schema + seed 資料
  - [x] Playwright 爬蟲實現（OpenRice）
  - [x] 資料清洗與存儲
  - [x] 地理編碼（OpenStreetMap Nominatim）
  - [x] robots.txt 合規檢查

- [x] **4. 「心動模式」：Tinder 式滑卡餐廳 UI** ✅
  - [x] 前端滑卡 UI 實現（heart-mode.html）
  - [x] 後端 API（獲取餐廳、記錄偏好）
  - [x] 用戶偏好資料表設計（user_restaurant_preference）
  - [x] 滑動手勢支持（觸摸和鼠標）
  - [x] 篩選功能（菜系、評分）

### Phase 3：推薦系統（中長期）✅ 已完成 1/1

- [x] **5. 餐廳推薦演算法** ✅
  - [x] 規則加權排序實現
  - [x] 用戶偏好分析
  - [x] 多因素評分系統（偏好、評分、距離、價格、菜系）
  - [x] 推薦 API 端點（/api/restaurants/recommend）
  - [ ] 機器學習（ML, Machine Learning）推薦模型（可選，未來擴展）

---

## ✅ 1. 賬單 OCR + NLP 自動填寫（已完成）

### 1.1 功能構想

- 使用者可拍照或上傳賬單圖片（餐廳帳單、收據）
- 系統以 **OCR** 讀取文字，並結合簡單的 **NLP / 規則解析**
  - 自動識別：日期、餐廳名稱、總額、小費、各菜品名稱與價格
  - 初步分配至「賬單項目列表」，用戶僅需檢查或微調
- 整合於現有「智能計算 → 創建賬單」流程，提供「從圖片導入賬單」捷徑

### 1.2 推薦工具 / Library（Node + TS 生態）

#### OCR（主推 PaddleOCR）

- **PaddleOCR（老師推薦，對中文識別優異）** ⭐

  - **優點**：
    - 中文優化，繁/簡體、英數混合、豎排、長文本皆佳
    - 輕量（8.6MB）、推理快、開源免 API 費用，80+ 語言支持
  - **整合建議**：
    - 外掛 Python microservice，於 `ocr-service/` 以 Flask/FastAPI 實作
    - Node.js 後端用 HTTP API 呼叫 OCR
    - 架構優勢：解耦、獨立部署、擴充彈性大
  - **技術棧**：
    - Python 3.8+
    - PaddleOCR（`pip install paddleocr`），推薦 FastAPI
    - 可選項：Docker 容器化

- **備選方案**：
  - 雲端服務（需付費）：Google/Azure/AWS Vision
  - 純 Node：`tesseract.js`（中文識別效果次於 PaddleOCR）

#### NLP / 結構化解析（以 LLM API）

- **用 Mistral AI** ⭐（已完成）

  - **選用原因**：
    - 免費 token 額度（200 萬/月）、支援中文、API 易對接、JSON 輸出好
  - **架構（已完成）**：
    - `server/llm/` 目錄下有：
      - `mistral.ts`：Mistral AI 客戶端（取代 Le Chat）
      - `billParser.ts`：LLM 解析 OCR → 結構化
      - `rateLimit.ts`：API 速率限制（排隊）
      - `usageTracker.ts`：API 使用量紀錄
      - `types.ts`：回傳格式與驗證器
      - `prompts.ts`：Prompt 版本管理
      - `env.ts`：環境變數管理
    - 補助：`cast.ts` 驗證 LLM 輸出、`best-effort-json-parser` 處理不完整 JSON
    - 已實作錯誤處理、自動重試

- **排隊機制設計**：

  - 參考 `01-mc-system/rate-limit.ts`
  - 用全域變數紀錄上次呼叫時間，確保每 1~2 秒調用 1 次
  - 支援請求併發隊列
  - 可用 `Bull`/`BullMQ` 實現複雜任務隊列

- **API 使用量記錄與限制**：

  - SQLite 新增 `llm_api_usage` table，欄位：`user_id` (可選)、`request_type`、`tokens_used`、`cost`、`timestamp`、`success`、`error_message`
  - **每日使用限制**：每個用戶每天有 **10 次成功識別**的機會（僅計算 `success=true` 且 `request_type='bill_parse'` 的記錄）
  - **使用量顯示**：前端顯示今日使用次數和剩餘次數，用完後暫時無法使用識別功能
  - **獎勵機制**（待實現）：
    - 用戶上傳食物圖片，每張真實食物圖片可獲得 +1 次識別機會
    - 每天最多可通過上傳食物圖片獲得 5 次額外機會
    - 總計每天最多 15 次識別機會（10 基礎 + 5 獎勵）
  - 可啟用監控/告警，額度用盡自動降級規則解析

- **Mistral AI 免費方案限制**：

  - 每分鐘 60 次，時 1500 次，每月 200 萬 token
  - 已於 `rateLimit.ts` 控速，`usageTracker.ts` 紀錄，API KEY 置於環境變數
  - 失敗錯誤回傳 OCR 文本給用戶手動輸入

- **Prompt 設計**：

  - 標準 prompt 模板：「任務說明＋期望 JSON 格式＋ few-shot 示例」
  - 支持 prompt 版本切換，易於優化與 A/B Test

- **降級方案**：
  1. 規則（正則表達式＋ heuristic）；
  2. 失敗/額度用盡時自動降級

### 1.3 難度與資源評估

- **開發難度**：中上
  - 後端已有圖片上傳（Multer/Express），可重用
  - OCR 微服務安裝簡單，API 封裝不繁瑣
  - 主要挑戰：「帳單格式差異」、「結構化解析」、「中英文混合處理」
- **電腦/計算需求**：
  - PaddleOCR：CPU 可、GPU 更快。每張 1~3 秒，500MB~1GB 記憶體
  - 併發需做 queue 或 worker pool 控管，或限流
- **優先度**：★★★★★（核心/穩健/風險小，對現核心價值加分）

---

## ✅ 2. 食物圖片識別（已完成 - TensorFlow.js 分層識別架構）

### 2.1 功能構想

- 用戶上傳餐照，系統識別食物類型（例：牛排、壽司、甜品...）
  - 可作「本次聚會吃了什麼」紀錄，也可反饋餐廳推薦
  - **用於獎勵機制**（待實現）：用戶上傳真實食物圖片可獲得額外 OCR 識別機會（+1 次/張，每天最多 5 次）

### 2.2 推薦工具 / Library

- **✅ 主要方案：TensorFlow.js 分層識別架構** ⭐⭐⭐⭐⭐

  - 詳見 `docs/FOOD_RECOGNITION_ARCHITECTURE.md`
  - **兩層架構**（第三層暫時隱藏）：
    1. **第一層：食物檢測**（Food/Non-Food 二分類）
       - 使用輕量級 CNN 模型
       - 快速過濾非食物圖像，減少後續計算
       - 輸出：`{is_food: boolean, confidence: number}`
    2. **第二層：國家分類**（10 個國家/地區）
       - 識別食物來源國家（中國、日本、韓國、泰國、印度、意大利、法國、墨西哥、美國、其他）
       - 輸出：`{country: string, country_confidence: number}`
    3. **第三層：細粒度分類**（暫時隱藏，代碼保留）
       - 按國家識別具體食物種類
       - 代碼已註釋，可隨時恢復
  - **技術棧**：
    - `@tensorflow/tfjs`（純 JavaScript 版本，無需 native 模塊）
    - `sharp`（圖像預處理）
    - 自定義 `FileSystemIOHandler`（文件系統模型加載）
  - **模型格式**：支持 `layers-model` 和 `graph-model` 格式
  - **模型轉換**：使用 Python `tensorflowjs` 工具將 H5/SavedModel 轉換為 TensorFlow.js 格式

- **✅ 備選方案：百度菜品識別 API** ⭐⭐⭐⭐

  - 總共有 1000 次免費調用
  - 無需信用卡，只需實名認證
  - 識別超過 5 萬種菜品，支持中文
  - 返回菜品名稱、卡路里、成分等詳細信息
  - 已實現完整集成，可作為備選或對比驗證

- **其他備選方案**（未採用）：
  - Google Cloud Vision API（每月 1000 次免費，需信用卡）
  - Azure Computer Vision（每月 5000 次免費，需信用卡）
  - Hugging Face Inference API（完全免費，有限額度）

### 2.3 難度與需求

- 雲端 API：中等；模型訓練：中高（須 ML 基礎、資料集）
- 訓練需 GPU（Colab、Kaggle），推理小模型可 CPU
- **優先度：★★★★☆**（提升：用於獎勵機制，增加用戶參與度）

### 2.4 實施計劃

1. **✅ 階段 1：API 註冊與測試**（已完成）

   - ✅ 註冊百度智能雲賬號
   - ✅ 申請菜品識別 API
   - ✅ 實現測試接口驗證效果

2. **✅ 階段 2：後端集成（百度 API）**（已完成）

   - ✅ 創建 `server/foodRecognition/` 目錄
   - ✅ 實現 `baiduClient.ts`（百度 API 客戶端）
   - ✅ 實現 `imageProcessor.ts`（圖片壓縮處理，使用 Sharp）
   - ✅ 實現 `foodImageManager.ts`（圖片存儲和管理）
   - ✅ 實現 `recognitionScheduler.ts`（異步識別調度器，10 秒延遲）
   - ✅ 實現 `usageTracker.ts`（API 使用量追蹤）
   - ✅ 實現 `healthCheck.ts`（未識別圖片自檢機制）
   - ✅ 添加 API 端點：
     - `POST /api/food/upload`：上傳食物圖片（最多 1 張/訂單）
     - `GET /api/food/images/:billId`：獲取訂單的食物圖片列表
     - `POST /api/food/recognize/:billId`：手動觸發識別
     - `GET /api/food/health`：健康檢查（未識別圖片統計）
     - `POST /api/food/fix-unrecognized`：批量修復未識別圖片
     - `GET /api/food/usage`：API 使用量統計
     - `GET /food_images/:filename`：提供圖片服務

3. **✅ 階段 3：TensorFlow.js 模型集成**（已完成）

   - ✅ 創建 `server/food-recognition/models/` 目錄結構
   - ✅ 實現 `ModelLoader.ts`（模型加載器，支持 layers-model 和 graph-model）
     - ✅ 自定義 `FileSystemIOHandler`（解決 Node.js 中 `file://` 協議不支持的問題）
     - ✅ 支持按需加載第三層模型（按國家）
   - ✅ 實現 `ImagePreprocessor.ts`（圖像預處理）
     - ✅ 使用 `sharp` 進行圖像解碼和預處理
     - ✅ 圖像驗證、縮放、歸一化
     - ✅ 支持批量預處理
   - ✅ 實現 `RecognitionPipeline.ts`（兩層級聯識別管道）
     - ✅ 第一層：食物檢測（Food/Non-Food）
     - ✅ 第二層：國家分類（10 個國家/地區）
     - ✅ 第三層：細粒度分類（暫時隱藏，代碼保留）
     - ✅ 早期拒絕機制（非食物圖像直接返回）
     - ✅ 張量內存管理（避免內存洩漏）
   - ✅ 模型轉換工具（Python）
     - ✅ `food-recognition-service/convert/convert_to_tfjs.py`
     - ✅ 支持 H5 和 SavedModel 格式轉換
     - ✅ 處理依賴問題（tensorflow_decision_forests、jax）
   - ✅ 服務器啟動時自動初始化模型
   - ✅ 錯誤處理和降級方案

4. **✅ 階段 4：資料庫更新**（已完成）

   - ✅ 新增 `food_images` 表（記錄圖片信息、識別狀態、識別結果）
   - ✅ 新增 `food_api_usage` 表（記錄百度 API 使用量）
   - ✅ 更新 `erd.txt` 和 `proxy.ts` 類型定義
   - ✅ 支持存儲 TensorFlow.js 模型識別結果

5. **✅ 階段 5：前端集成**（已完成）
   - ✅ 在 `calculator.html` 添加食物圖片上傳功能
   - ✅ 支持上傳前保存訂單（臨時存儲，保存訂單後關聯）
   - ✅ 顯示圖片預覽和識別狀態
   - ✅ 實現自動輪詢機制（每 5 秒刷新識別結果，最多 2 分鐘）
   - ✅ 顯示識別結果（是否食物、國家、置信度等）
   - ⏳ 獎勵機制顯示（待實現）

### 2.5 技術實現細節

- **圖片處理**：

  - 使用 `sharp` 庫進行圖片壓縮（最大 1920x1920，質量 85%）
  - 壓縮後存儲，原始圖片自動刪除
  - 支持常見圖片格式（JPG、PNG 等）
  - 圖像預處理：縮放到模型輸入尺寸（224x224），歸一化到 [0, 1]

- **TensorFlow.js 模型加載**：

  - **問題**：純 JavaScript 版本的 TensorFlow.js 在 Node.js 中不支持 `file://` 協議
  - **解決方案**：實現自定義 `FileSystemIOHandler`
    - 使用 `fs.readFile` 直接讀取模型文件
    - 支持 `layers-model` 和 `graph-model` 兩種格式
    - 正確解析 `model.json` 中的 `modelTopology`
  - **模型格式檢測**：自動檢測模型格式並使用對應的加載函數
    - `layers-model`：使用 `tf.loadLayersModel()`
    - `graph-model`：使用 `tf.loadGraphModel()`

- **識別流程（TensorFlow.js）**：

  1. 用戶上傳圖片 → 壓縮存儲 → 保存到數據庫（狀態：未識別）
  2. 訂單保存後，調度識別任務（10 秒延遲，測試用）
  3. **第一層推理**：食物檢測
     - 如果 `output < 0.5`：判定為食物（模型輸出為 `[food (0), non-food (1)]`）
     - 如果 `output >= 0.5`：判定為非食物，直接返回
  4. **第二層推理**：國家分類
     - 獲取 10 個國家的概率分佈
     - 選擇最高概率的國家
     - 如果置信度 < 0.3：返回 `country: "unknown"`
  5. **第三層推理**（暫時隱藏）：
     - 根據第二層識別的國家，按需加載對應的細粒度模型
     - 如果模型不存在或加載失敗：返回 `food_confidence: 0`，但流程繼續
  6. 更新數據庫（狀態：已識別/識別失敗）
  7. 前端自動輪詢更新識別結果

- **識別流程（百度 API，備選）**：

  1. 用戶上傳圖片 → 壓縮存儲 → 保存到數據庫（狀態：未識別）
  2. 訂單保存後，調度識別任務（10 秒延遲，測試用）
  3. 調用百度 API 進行識別 → 更新數據庫（狀態：已識別/識別失敗）
  4. 前端自動輪詢更新識別結果

- **使用量追蹤**：

  - 嚴格記錄每次 API 調用（成功/失敗）
  - 追蹤到 `food_api_usage` 表（僅百度 API）
  - TensorFlow.js 模型推理不計入 API 使用量
  - 提供使用量統計接口

- **錯誤處理**：

  - 識別失敗時記錄錯誤信息
  - 提供健康檢查和批量修復機制
  - 前端顯示識別狀態和錯誤信息
  - 模型加載失敗時提供降級方案（可切換到百度 API）

- **性能優化**：
  - 早期拒絕機制：非食物圖像在第一層就被過濾
  - 張量內存管理：及時釋放中間張量，避免內存洩漏
  - 按需加載：第三層模型按國家按需加載，減少內存佔用
  - 批量處理：支持批量圖像預處理（未來可擴展批量推理）

---

## 3. 餐廳資料自動抓取（如 OpenRice, Playwright）

### 3.1 功能構想

- 自動爬取餐廳資料（名稱、地點、評分、類型...），建立本地資料庫供推薦與心動模式

### 3.2 推薦工具

- 自動化瀏覽器 Playwright（較 Puppeteer 有更佳 TypeScript 支持）或 Puppeteer
- 資料寫入 SQLite（可沿用 knex/better-sqlite3 流程）

### 3.3 法律道德注意

- 理解目標網站 ToS/robots.txt，善用學習用途標註，避免高頻訪問

### 3.4 難度及資源需求

- 開發難度：中，重點在反爬、防結構變動、資料清洗
- 一般電腦即可，I/O 為主
- **優先度：★★★☆☆**

---

## ✅ 4. 餐廳推薦演算法（已完成 - 規則加權排序）

### 4.1 功能構想

- 為下次聚會推薦餐廳，考慮用戶歷史偏好（類型/價位）、距離、評分等

### 4.2 實施狀態

- ✅ **第一階段：規則加權排序**（已完成）

  - 實現多因素評分系統：
    ```
    score = w1 * preference_match + w2 * rating + w3 * distance + w4 * price_fit + w5 * cuisine_match
    ```
  - 權重配置：
    - 用戶偏好匹配：30%
    - 評分：25%
    - 距離：20%
    - 價格：15%
    - 菜系：10%
  - 實現用戶偏好提取（從歷史記錄和心動模式）
  - 實現距離計算（Haversine 公式）
  - API 端點：`GET /api/restaurants/recommend`
  - 支持篩選參數：位置、價格、菜系、最小分數

- ⏳ **第二階段：逐步引入推薦 ML**（未來擴展）
  - 可採 content-based filtering（屬性向量）或簡單協同過濾
  - 實作可先純 TS/JS，再考慮 Python + sklearn/LightFM 等

### 4.3 難度與需求

- 加權規則：容易（重點在 schema 和權重微調）✅ 已完成
- ML 推薦：中等（推薦系統知識；可循序導入）⏳ 待實現
- **優先度：★★★★☆**（核心功能已完成）

---

## ✅ 5. 「心動模式」：Tinder 式滑卡餐廳 UI（已完成）

### 5.1 功能構想

- 一頁只顯示一家餐廳（圖＋名＋菜系＋價位＋距離＋標籤），用戶「右滑喜歡、左滑不感興趣」記錄偏好

### 5.2 實施狀態

- ✅ **前端**：原生 HTML + Tailwind + JS
  - 新增 `public/heart-mode.html`
  - 實現滑動手勢（觸摸和鼠標支持）
  - 實現餐廳卡片展示（圖片、名稱、菜系、評分、價格、地址、標籤）
  - 實現篩選功能（菜系類型、最小評分）
  - 實現統計顯示（已查看、已喜歡、已收藏）
  - 實現 Toast 通知反饋
- ✅ **後端/DB**：
  - 資料表 `user_restaurant_preference`（`user_id`, `restaurant_id`, `preference`, `timestamp`）
  - API 端點：
    - `GET /api/restaurants/next`（獲取下一個餐廳）
    - `POST /api/restaurants/feedback`（記錄滑卡反饋）
    - `POST /api/restaurants/:id/preference`（記錄偏好：like/dislike/favorite）
    - `GET /api/users/:userId/preferences`（獲取用戶偏好列表）

### 5.3 難度與需求

- 難度：中（主要為產品設計和 UI）✅ 已完成
- 電腦需求低
- **優先度：★★★★☆**（已完成）

---

## 綜合建議與 Roadmap

### ✅ 短期（Phase 1）：重點功能實作（已完成）

1. ✅ **SQLite 結構更新與 README 同步**
2. ✅ **PaddleOCR OCR 服務（Python microservice）建立＋已整合 Node.js 後端＋ Mistral LLM 串接**
   - 完整技術棧包括：`ocr-service/` 微服務（Py, FastAPI），`server/llm` 相關（`mistral.ts` 主 LLM 客戶端，`rateLimit.ts`, `usageTracker.ts`, `billParser.ts`...）
   - 自動填表、前端（calculator.html）集成、錯誤/降級方案完善
3. ✅ **食物圖片識別（TensorFlow.js + 百度 API）集成**
   - **TensorFlow.js 分層識別**：
     - `server/food-recognition/models/` 模塊（`ModelLoader.ts`, `ImagePreprocessor.ts`, `RecognitionPipeline.ts`）
     - 自定義 `FileSystemIOHandler` 解決模型加載問題
     - 兩層級聯識別（第三層暫時隱藏）
     - 模型轉換工具（Python）
   - **百度 API 備選方案**：
     - `server/foodRecognition/` 模塊（`baiduClient.ts`, `imageProcessor.ts`, `foodImageManager.ts`, `recognitionScheduler.ts`, `usageTracker.ts`, `healthCheck.ts`）
   - 圖片壓縮（Sharp）、異步識別調度、前端輪詢更新結果

**技術架構摘要：**

**賬單 OCR 識別流程：**

```
前端 (calculator.html)
  ↓ POST /api/bill/ocr-upload
Node.js (server.ts) 儲存圖至 data/receipts/
  ↓ HTTP POST → ocr-service/main.py
PaddleOCR → 回傳文字
Node.js (billParser.ts)：
  rateLimit.ts 控速
  mistral.ts 串 LLM
  回傳結構化 JSON
前端自動填表
```

**食物圖片識別流程（TensorFlow.js）**：

```
前端 (calculator.html)
  ↓ POST /api/food/upload (最多 10 張/訂單)
Node.js (server.ts)：
  imageProcessor.ts 壓縮圖片
  foodImageManager.ts 存儲到 data/food_images/
  recognitionScheduler.ts 調度識別任務（10 秒延遲）
  ↓ 異步調用
RecognitionPipeline.ts：
  1. ImagePreprocessor.ts 預處理圖像（Sharp + TensorFlow.js）
  2. 第一層：食物檢測模型（Food/Non-Food）
     ├─ 非食物 → 返回 {is_food: false}
     └─ 是食物 → 繼續
  3. 第二層：國家分類模型（10 個國家）
     ├─ 置信度 < 0.3 → 返回 {country: "unknown"}
     └─ 置信度 ≥ 0.3 → 返回國家信息
  4. 第三層：細粒度分類（暫時隱藏）
     └─ 按國家按需加載模型
  ↓ 識別結果
foodImageManager.ts 更新數據庫
前端輪詢 GET /api/food/images/:billId（每 5 秒，最多 2 分鐘）
  顯示識別結果（是否食物、國家、置信度等）
```

**食物圖片識別流程（百度 API，備選）**：

```
前端 (calculator.html)
  ↓ POST /api/food/upload (最多 10 張/訂單)
Node.js (server.ts)：
  imageProcessor.ts 壓縮圖片
  foodImageManager.ts 存儲到 data/food_images/
  recognitionScheduler.ts 調度識別任務（10 秒延遲）
  ↓ 異步調用
baiduClient.ts → 百度菜品識別 API
  ↓ 識別結果
foodImageManager.ts 更新數據庫
前端輪詢 GET /api/food/images/:billId（每 5 秒，最多 2 分鐘）
  顯示識別結果（菜品名稱、置信度、卡路里等）
```

### 安裝與開發步驟（摘要）

1. **OCR 服務（詳見 ocr-service/SETUP.md）**

   ```bash
   cd ocr-service
   py -3.10 -m venv venv
   source venv/Scripts/activate      # 或 windows 下 venv\Scripts\activate
   python -m pip install --upgrade pip
   # 以下根據 CUDA 選擇一行
   python -m pip install paddlepaddle-gpu==3.2.1 -i https://www.paddlepaddle.org.cn/packages/stable/cu118/
   # or cu126, cu129 ...
   python -m pip install "paddleocr[all]"
   pip install -r requirements.txt
   python main.py
   # 或
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Node.js 後端**

   ```bash
   npm install
   # 複製 env.example 為 .env，設置以下環境變數：
   # - MISTRAL_AI_API_KEY：Mistral AI API 密鑰
   # - OCR_SERVICE_URL：OCR 服務地址（默認 http://localhost:8000）
   # - BAIDU_API_KEY：百度智能雲 API Key（食物圖片識別）
   # - BAIDU_SECRET_KEY：百度智能雲 Secret Key
   # - BAIDU_DISH_RECOGNITION_URL：百度菜品識別 API 地址
   npm run db:migrate
   npm run dev
   ```

3. **前端 / 快速測試**

   - 可同步啟動 OCR 服務和 Node.js (`npm run dev:all`)
   - 使用 `npm run ocr:test`、`npm run llm:test v1/v2/v3` 測試健康

4. **使用方法**
   - **賬單 OCR 識別**：http://localhost:3000/calculator.html → 上傳賬單圖片 → AI 識別自動填單
   - **食物圖片識別**：
     - 在計算頁面上傳食物圖片（最多 10 張/訂單）
     - 保存訂單後自動識別（10 秒延遲）
     - 查看識別結果（是否食物、國家、置信度等）
     - TensorFlow.js 模型識別（主要方案）或百度 API 識別（備選方案）

---

### ✅ 中期（Phase 2）：餐廳資料收集與個人偏好（已完成）

1. ✅ 建立餐廳 schema + seed 資料（10 個示例餐廳）
2. ✅ Playwright 爬蟲（OpenRice），將資料寫入 SQLite
3. ✅ 開發心動模式頁面（滑卡 UI, backend API, 偏好儲存）
4. ✅ **食物圖片識別**（已完成，提前完成）

### ✅ 中長期（Phase 3）：推薦系統和影像辨識（已完成）

1. ✅ 加權規則推薦（多因素評分系統）
2. ✅ **食物圖片分類**（已完成，使用百度 API + TensorFlow.js）
3. ⏳ ML 推薦模型（可選，未來擴展）

---

## 總結

- ✅ **最核心優先建議**：賬單 OCR + LLM，最大化現有體驗，已高效落地
- ✅ **食物圖片識別**：
  - **TensorFlow.js 分層識別**：已完成兩層模型集成（食物檢測 + 國家分類），第三層暫時隱藏
  - **百度 API 備選**：已完成集成，支持菜品識別和結果展示
- PaddleOCR（中文識別佳），Mistral AI（免費/中文支持）實戰驗證
- TensorFlow.js 模型加載和推理（純 JavaScript 版本，無需 native 模塊）實戰驗證
- 百度菜品識別 API（1000 次免費調用）實戰驗證
- 若要進一步提升：餐廳資料庫、推薦算法、心動滑卡三件套核心建議
- 架構選擇以「後端解耦、開源優先、壓力最小本機」原則
- 技術精要：
  - OCR/LLM：排隊控速（rateLimit.ts）、JSON 驗證（cast.ts）、錯誤/重試、自動降級、API 使用量記錄
  - 食物識別：TensorFlow.js 模型加載（自定義 FileSystemIOHandler）、圖像預處理（Sharp + TensorFlow.js）、兩層級聯推理、早期拒絕機制、張量內存管理
- 圖片處理：使用 Sharp 進行壓縮，異步調度識別任務，前端輪詢更新結果
- 其餘 AI 功能初期建議用雲端/預訓練為主，資源充裕再考慮自訓
- 路徑規劃彈性，依實際開發體感動態調整

---

## 附錄 A：01-mc-system 架構參考

### 關鍵設計模式

1. **速率限制**：全域 lastTime, queue 控速，簡單排隊防秒殺 API
2. **JSON 處理**：best-effort-json-parser 容忍非嚴格输出，cast.ts 嚴格型態驗證，自動重試
3. **錯誤處理**：解析失敗自動叫 LLM 修復，訊息明確
4. **資料庫結合**：better-sqlite3-proxy，類型安全儲存 LLM 資料

### 於 PBC 直接可採用/值得擴展的部份

- `rateLimit.ts` 可直接複用
- `billParser.ts` 參考 `generate.ts` 之錯誤和重試邏輯
- `types.ts` 寫 type 驗證
- 持續擴展 API 使用量紀錄（usageTracker.ts），做 user 等級用量監控與警報

---

## 附錄 B：PaddleOCR 快速上手指南

### 安裝（Python 環境）

```bash
python --version  # >=3.8
pip install paddleocr
# 首次運行自動下載模型
```

### Python 使用範例

```python
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang='ch')
result = ocr.ocr('path/to/bill.jpg', cls=True)

for line in result[0]:
    print(f"文字: {line[1][0]}, 置信度: {line[1][1]}")
```

### FastAPI 服務示例

```python
from fastapi import FastAPI, File, UploadFile
from paddleocr import PaddleOCR
import uvicorn

app = FastAPI()
ocr = PaddleOCR(use_angle_cls=True, lang='ch')

@app.post("/ocr")
async def ocr_image(file: UploadFile = File(...)):
    with open(f"temp_{file.filename}", "wb") as f:
        f.write(await file.read())
    result = ocr.ocr(f"temp_{file.filename}", cls=True)
    texts = [line[1][0] for line in result[0]]
    return {"text": "\n".join(texts), "raw_result": result}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Node.js 整合範例

```typescript
import FormData from "form-data";
import fs from "fs";

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "http://localhost:8000";

export async function ocrImage(imagePath: string): Promise<string> {
  const form = new FormData();
  form.append("file", fs.createReadStream(imagePath));
  const response = await fetch(`${OCR_SERVICE_URL}/ocr`, {
    method: "POST",
    body: form,
  });
  const data = await response.json();
  return data.text;
}
```

### LLM API 範例（參考 01-mc-system）

#### Le Chat 客戶端

```typescript
import { env } from "../env";
export class LeChatClient {
  private apiKey = env.LE_CHAT_API_KEY;
  private baseUrl = env.LE_CHAT_API_URL || "https://api.lechat.ai/v1";
  async chatComplete(messages: Array<{ role: string; content: string }>) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: "le-chat-model", messages }),
    });
    if (!response.ok)
      throw new Error(`Le Chat API error: ${response.statusText}`);
    return await response.json();
  }
}
export const leChat = new LeChatClient();
```

#### API 速率限制

```typescript
let lastTime = Date.now();
const interval = 2000;
export async function waitForRateLimit(label: string) {
  for (;;) {
    const now = Date.now();
    const delta = now - lastTime;
    if (delta < interval) {
      await new Promise((res) => setTimeout(res, interval - delta));
      continue;
    }
    lastTime = now;
    return;
  }
}
```

#### API 使用量紀錄

```typescript
import { proxy } from "../proxy";
export async function recordApiUsage({
  userId,
  requestType,
  tokensUsed,
  cost,
  success,
  errorMessage,
}: {
  userId?: number;
  requestType: string;
  tokensUsed?: number;
  cost?: number;
  success: boolean;
  errorMessage?: string;
}) {
  proxy.llm_api_usage.push({
    user_id: userId ?? null,
    request_type: requestType,
    tokens_used: tokensUsed ?? null,
    cost: cost ?? null,
    success,
    error_message: errorMessage ?? null,
    created_at: new Date(),
  });
}
```

#### 賬單解析 Type 定義

```typescript
import { object, string, number, array } from "cast.ts";
export const BillResponseFormat = `
{
restaurant: string
date: string  // ISO 8601 格式
items: Array<{
 name: string
 price: number
 quantity?: number
}>
subtotal: number
tip: number
total: number
currency: string
}`.trim();

export const BillParser = object({
  restaurant: string(),
  date: string(),
  items: array(
    object({
      name: string(),
      price: number(),
      quantity: number().optional(),
    })
  ),
  subtotal: number(),
  tip: number(),
  total: number(),
  currency: string(),
});
```

#### 主體賬單解析

```typescript
import { parse } from "best-effort-json-parser";
import { leChat } from "./leChatClient";
import { waitForRateLimit } from "./rateLimit";
import { recordApiUsage } from "./usageTracker";
import { BillParser, BillResponseFormat } from "./types";

function handleResponse(response: any) {
  if (response.choices[0].finishReason !== "stop")
    throw new Error(
      `Expected finishReason to be 'stop', got ${response.choices[0].finishReason}`
    );
  let content = response.choices[0].message.content;
  if (typeof content !== "string")
    throw new Error("Expected content to be a string");
  let idx = content.indexOf("{");
  if (idx === -1) throw new Error("Expected JSON output");
  let json = parse(content.slice(idx));
  return BillParser.parse(json);
}

export async function parseBillFromOCR(ocrText: string, userId?: number) {
  const prompt = `
請從以下賬單 OCR 文本中提取結構化信息：

${ocrText}

請以 JSON 格式返回，格式如下：
${BillResponseFormat}

只返回 JSON，不要其他文字。
`;
  try {
    await waitForRateLimit("parseBillFromOCR");
    const response = await leChat.chatComplete([
      { role: "user", content: prompt },
    ]);
    let result;
    try {
      result = handleResponse(response);
      await recordApiUsage({
        userId,
        requestType: "bill_parse",
        success: true,
      });
    } catch (error) {
      await waitForRateLimit("parseBillFromOCR (fix json)");
      const fixResponse = await leChat.chatComplete([
        { role: "user", content: prompt },
        { role: "assistant", content: response.choices[0]?.message?.content },
        {
          role: "user",
          content: `${error}\n請修復 JSON 並返回正確的格式：\n${BillResponseFormat}`,
        },
      ]);
      result = handleResponse(fixResponse);
      await recordApiUsage({
        userId,
        requestType: "bill_parse",
        success: true,
      });
    }
    return result;
  } catch (error) {
    await recordApiUsage({
      userId,
      requestType: "bill_parse",
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
```

#### 新增 llm_api_usage 表 migration 示範

```typescript
import { Knex } from "knex";
export async function up(knex: Knex) {
  if (!(await knex.schema.hasTable("llm_api_usage"))) {
    await knex.schema.createTable("llm_api_usage", (t) => {
      t.increments("id");
      t.integer("user_id").nullable();
      t.string("request_type").notNullable();
      t.integer("tokens_used").nullable();
      t.decimal("cost", 10, 4).nullable();
      t.boolean("success").notNullable();
      t.text("error_message").nullable();
      t.timestamps(false, true);
      // 可加外鍵: t.foreign('user_id').references('users.id');
    });
  }
}
export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists("llm_api_usage");
}
```

### 環境變數（.env）

```env
# OCR 服務
OCR_SERVICE_URL=http://localhost:8000

# Mistral AI（賬單解析 LLM）
MISTRAL_AI_API_KEY=your_mistral_api_key_here

# 百度智能雲（食物圖片識別）
BAIDU_API_KEY=your_baidu_api_key_here
BAIDU_SECRET_KEY=your_baidu_secret_key_here
BAIDU_DISH_RECOGNITION_URL=https://aip.baidubce.com/rest/2.0/image-classify/v2/dish
```

### 依賴安裝

```bash
npm install best-effort-json-parser cast.ts
npm install bull bullmq   # 如需支援進階 queue 管理
```
