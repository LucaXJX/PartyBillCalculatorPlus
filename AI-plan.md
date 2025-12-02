## PartyBillCalculator AI 發展方向規劃

本文件總結 PBC 在完成資料庫升級（JSON → SQLite）後，進一步引入 AI 能力的可能方向，並從「方向建議、推薦技術與 Library、難度、電腦與計算需求」幾個維度進行綜合評估，作為後續開發路線圖。

---

## 1. 賬單 OCR + NLP 自動填寫

### 1.1 功能構想

- 用戶拍照 / 上傳賬單圖片（餐廳帳單、收據）。
- 系統透過 **OCR** 讀取文字，並用簡單 **NLP / 規則解析**：
  - 自動識別日期、餐廳名稱、總額、小費、每項菜品名稱與價格。
  - 初步分配至「賬單項目列表」，用戶只需最後檢查與微調。
- 與現有「智能計算 → 創建賬單流程」整合，作為一種「從圖片導入賬單」的捷徑。

### 1.2 推薦工具 / Library（Node + TS 生態）

**OCR（重點推薦：PaddleOCR）**

- **PaddleOCR（老師推薦，中文識別效果優秀）** ⭐

  - **優勢**：
    - 專為中文優化，對繁體/簡體中文識別準確率高
    - 支持中英文數字混合、豎排文本、長文本
    - 超輕量級模型（8.6MB），推理速度快
    - 開源免費，無 API 費用
    - 支持 80+ 種語言（包括日文、韓文等）
  - **整合方案**：
    - PaddleOCR 是 Python 生態，建議採用 **Python microservice** 架構
    - 在項目中新增 `ocr-service/` 目錄，使用 Flask/FastAPI 建立 OCR 服務
    - Node.js 後端透過 HTTP API 呼叫 OCR 服務
    - 優點：解耦、可獨立部署、易於擴展
  - **技術棧**：
    - Python 3.8+
    - PaddleOCR（`pip install paddleocr`）
    - FastAPI（推薦，性能好、自動生成 API 文檔）或 Flask
    - 可選：Docker 容器化部署

- **替代方案（作為備選）**：
  - 雲端服務（精度高、實作快，但需付費）：
    - Google Cloud Vision API
    - Azure Computer Vision
    - AWS Textract
  - 純 Node.js 方案：
    - `tesseract.js`（Node 版本，純 JS 生態，但中文識別效果不如 PaddleOCR）

**NLP / 結構化解析（使用 LLM API）**

- **推薦方案：Le Chat API** ⭐

  - **優勢**：
    - 限量免費，適合學習和開發階段
    - 支持中文理解，適合處理繁體/簡體中文賬單
    - API 調用簡單，易於整合
  - **整合架構**（參考 `01-mc-system` 設計）：
    - 建立 `server/llm/` 目錄，包含：
      - `leChatClient.ts`：Le Chat API 客戶端封裝
      - `billParser.ts`：使用 LLM 解析 OCR 文本 → 結構化 JSON
      - `rateLimit.ts`：API 調用速率限制（排隊機制）
      - `usageTracker.ts`：API 使用量記錄與監控
      - `types.ts`：定義賬單解析的響應格式和驗證器
    - 使用 `cast.ts` 驗證 LLM 返回的 JSON 結構
    - 使用 `best-effort-json-parser` 處理可能不完整的 JSON
    - 實現錯誤處理和自動重試機制

- **排隊機制設計**：

  - 參考 `01-mc-system/rate-limit.ts` 的實現
  - 使用全局變量追蹤最後 API 調用時間
  - 確保每次調用之間有適當間隔（例如 1-2 秒）
  - 支持併發請求的隊列管理
  - 可選：使用 `Bull` 或 `BullMQ` 實現更複雜的任務隊列

- **API 使用量記錄**：

  - 在資料庫中新增 `llm_api_usage` 表，記錄：
    - `user_id`：使用者 ID（可選，用於追蹤個人使用量）
    - `request_type`：請求類型（如 'bill_parse'）
    - `tokens_used`：使用的 token 數量（如果 API 提供）
    - `cost`：成本（如果 API 提供）
    - `timestamp`：調用時間
    - `success`：是否成功
    - `error_message`：錯誤訊息（如果失敗）
  - 實現使用量監控和告警機制
  - 在達到免費額度上限時自動降級到規則解析

- **Mistral AI 免費方案限制（備註）**：

  若未來在此專案中改用或同時使用 Mistral AI 作為 LLM 提供者，目前官方免費方案的主要限制如下（以你提供的數據為準，實際以官方文件為最終依據）：

  - **每分鐘請求限制（RPM）**：60 次請求
  - **每小時請求限制**：1,500 次請求
  - **每月 token 限制**：總計約 2,000,000 個 token（包含輸入與輸出）

  在設計 `rateLimit.ts` 和 `usageTracker.ts` 時，可以預留配置項，讓：

  - 同一套排隊與監控機制，既可用於 Le Chat，也可以套用到 Mistral
  - 透過環境變數配置不同提供者的 RPM / token 上限
  - 一旦接近某一提供者的免費額度，就自動切換到其他提供者或降級到規則解析

- **問詢語句格式設計**：

  - 設計標準化的 prompt 模板，包含：
    - 任務描述（從 OCR 文本解析賬單）
    - 期望的 JSON 輸出格式
    - 示例（few-shot learning）
  - 支持動態調整 prompt 以適應不同賬單格式
  - 實現 prompt 版本管理，方便優化和 A/B 測試

- **降級方案**：
  - 第一階段：規則解析（正則表達式 + heuristic 規則）
  - 第二階段：LLM 輔助解析（Le Chat API）
  - 當 LLM API 失敗或達到額度上限時，自動降級到規則解析

### 1.3 難度與資源評估

- **開發難度**：中等偏上
  - **後端整合**：圖片上傳已有（Multer/Express），可重用現有 `/api/receipt/upload` 邏輯
  - **OCR 服務**：需要建立 Python microservice，但 PaddleOCR 安裝簡單，API 封裝不複雜
  - **主要挑戰**：
    - 「賬單格式差異大」：不同餐廳格式不同，需要 robust 的解析邏輯
    - 「解析為結構化欄位」：從 OCR 文本提取日期、餐廳、項目、金額等
    - 「中英文混合」：PaddleOCR 對此支持好，但仍需處理特殊字符
- **電腦 / 計算需求**：
  - **PaddleOCR**：
    - CPU 即可運行（無需 GPU，但 GPU 會更快）
    - 單張圖片處理時間：約 1-3 秒（取決於圖片大小和複雜度）
    - 內存需求：約 500MB-1GB（模型加載後）
    - 建議：開發階段本機運行即可，生產環境可考慮 Docker 容器化
  - **併發處理**：
    - 若併發量大，建議使用 queue（如 Bull/BullMQ）或 worker pool
    - 或限制同時處理的請求數量
- **建議優先度：★★★★★**
  - 與 PBC 核心價值高度契合，是「記賬體驗 AI 化」的第一步
  - PaddleOCR 對中文支持優秀，符合項目需求
  - 技術風險可控（即使 OCR 不完美，仍可讓用戶人工修正）
  - 開源免費，無 API 費用壓力

---

## 2. 食物圖片識別（TensorFlow / 影像分類）

### 2.1 功能構想

- 用戶上傳餐桌、菜品照片。
- 系統識別出食物類型，例如「牛排」「壽司」「火鍋」「甜品」等：
  - 用於記錄「本次聚會吃了什麼」。
  - 或與未來「餐廳推薦」互動（分析使用者喜歡吃什麼）。

### 2.2 推薦工具 / Library

**實務上建議優先使用：**

- 雲端圖像識別 API（標籤 / 類別偵測）：
  - Google Cloud Vision（Label Detection）
  - Azure Custom Vision（可訓練自訂食物分類器）
  - 其他 ML 服務平台（如 Clarifai 等）

**若你想自己訓練模型：**

- Node 生態下較合適的是：
  - `@tensorflow/tfjs-node`（Node 上的 TensorFlow.js，加速較好）
- 或額外開一個 **Python + TensorFlow / PyTorch** microservice：
  - 使用 transfer learning（例如 MobileNet、EfficientNet 預訓練模型），在食物資料集（如 Food-101）上微調。
  - Node 後端透過 HTTP 或 gRPC 呼叫推理服務。

### 2.3 難度與資源評估

- **開發難度**：
  - 若用雲端 API：中等；只需處理圖片上傳與 API 封裝。
  - 若自行訓練模型：中高，需要 ML 基礎與資料集。
- **電腦 / 計算需求**：
  - 訓練階段：建議用 GPU 環境（雲端、Colab、Kaggle Notebook 等），本機 CPU 訓練會非常慢。
  - 推理階段：小模型 CPU 也 OK，可容忍幾百毫秒延遲。
- **建議優先度：★★★☆☆**
  - 有趣但與主線「算賬單」的關聯稍弱，偏向「體驗加分」與「為將來推薦系統收集偏好特徵」。
  - 可考慮在「賬單 OCR」穩定後作為第二階段探索。

---

## 3. 抓取 OpenRice / 其他餐廳資訊（Playwright 等）

### 3.1 功能構想

- 透過自動化工具抓取公允美食網站（OpenRice 等）的餐廳資訊：
  - 餐廳名稱、地點、大致價位、菜系、評分、評價數量等。
- 作為你自己本地的 **餐廳資料庫**，後續提供「選餐廳」與「聚會推薦」。

### 3.2 推薦工具 / Library

- **瀏覽器自動化 / 資料抓取**
  - `Playwright`（推薦）：跨瀏覽器、TS 友好，有更好現代網站支援。
  - `Puppeteer`：傳統 headless Chrome 控制，生態成熟。
- **資料存儲**
  - 直接寫入現有 SQLite（使用現有 `knex`/`better-sqlite3` 管線），新增餐廳相關 tables（例如 `restaurants`, `restaurant_ratings`, `restaurant_tags` 等）。

### 3.3 法律 / 道德注意事項

- 必須確認目標網站的 **服務條款（ToS）** 與 robots.txt：
  - 某些網站禁止自動爬取或限制使用頻率。
  - 建議專案中標註：「僅供學習用途，不用於商業用途」。
- 避免高頻率請求，使用合理的延遲與 cache。

### 3.4 難度與資源評估

- **開發難度**：中等
  - Playwright / Puppeteer 本身不難，難在處理網站結構變動、反爬機制，以及資料清洗。
- **電腦 / 計算需求**：
  - 一般開發機即可（有 Node + 瀏覽器 driver 就行），主要消耗在 IO 與網路。
- **建議優先度：★★★☆☆**
  - 如果你打算做「餐廳推薦」，那這是必要基礎；但可以階段性進行：
    - 初期可手工 seed 少量餐廳（或用公開 dataset）。
    - 之後再做爬蟲自動擴充。

---

## 4. 餐廳推薦演算法（偏好 + 距離 + 評分加權）

### 4.1 功能構想

- 目標：為「下一次聚會」推薦餐廳：
  - 考慮使用者歷史喜好（菜系 / 價位 / 是否常選某類型）。
  - 距離（使用者常用區域 / 手動輸入地點）。
  - 餐廳評分、菜式評價及熱門程度。
- 真正把 PBC 從「算完這次賬」擴展為「規劃下一次聚會」。

### 4.2 推薦技術路線（實作上循序漸進）

**第一階段：規則 + 加權排序（不需要 ML）**

- 定義一個簡單的「評分函數」，例如：
  \[
  score = w_1 \cdot \text{rating} + w_2 \cdot f(\text{distance}) + w_3 \cdot \text{match_preference} + w_4 \cdot \text{price_fit}
  \]
- 所有權重與函數可手動調整、寫在設定檔或 DB。
- 使用者喜好可以來自：
  - 資料表的統計（常吃什麼類型、接受價位）。
  - 心動模式中的「喜歡 / 不喜歡」紀錄（見下一節）。

**第二階段：引入簡單的 ML / Recommendation**

- 基於記錄的「點讚 / 踩」與歷史選擇，建立：
  - Content-based filtering（以餐廳的屬性 + 使用者向量計算相似度）。
  - 或嘗試簡單的協同過濾（若有足夠多使用者）。
- 工具上可以：
  - 先用純 TS/JS 實作小型推薦引擎（例如用 cosine similarity）。
  - 若未來資料量變大，再考慮 Python + scikit-learn / LightFM 等。

### 4.3 難度與資源評估

- **開發難度**：
  - 第一階段（規則加權）：中等偏低，重點在資料 schema 設計與權重調整。
  - 第二階段（ML 推薦）：中等，需要一些推薦系統概念，但可以漸進式實作。
- **電腦 / 計算需求**：
  - 規則加權：極低，一般 SQLite 查詢 → JS 計算即可。
  - 小規模推薦：CPU 足夠，無需 GPU。
- **建議優先度：★★★★☆**
  - 一旦有一定數量的餐廳資料與偏好紀錄，推薦系統是非常有價值的功能。
  - 可以在「爬蟲 / 餐廳資料庫到一定規模」後啟動。

---

## 5. 「心動模式」：類似翻卡的餐廳滑動體驗

### 5.1 功能構想

- 提供一個 UI 類似交友 App（Tinder）：
  - 一次展示一家餐廳卡片（圖片 + 名稱 +菜系 + 價位 + 距離 + 標籤）。
  - 用戶可以「喜歡（右滑）」或「不感興趣（左滑）」。
- 同時記錄這些行為作為推薦系統「偏好標記」：
  - `likes` / `dislikes` 表。
  - 作為 4. 餐廳推薦演算法中的偏好來源。

### 5.2 推薦工具 / 技術

- **前端**：
  - 目前 UI 是原生 HTML + Tailwind + JS，可以：
    - 新增一個 `public/heart-mode.html` 頁面。
    - 使用自製 JS（或簡單 CSS 動畫）實作卡片滑動。
- **後端 / 資料庫**：
  - 新增如 `user_restaurant_preferences` 資料表：
    - `user_id`, `restaurant_id`, `preference`（like / dislike）, `timestamp` 等。
  - 提供 API：
    - `POST /api/restaurants/next`：取得下一家要顯示的餐廳。
    - `POST /api/restaurants/feedback`：記錄喜歡 / 不喜歡。

### 5.3 難度與資源評估

- **開發難度**：中等（偏產品設計 + UI 交互）
  - 後端邏輯相對簡單。
  - 主要工作在前端互動設計與體驗打磨。
- **電腦 / 計算需求**：低
- **建議優先度：★★★★☆**
  - 與推薦系統高度耦合，是蒐集訓練資料與提升「玩感」的重要部分。
  - 也很容易對 Demo / 展示加分。

---

## 綜合建議與分階段 Roadmap

### 短期（Phase 1）：與現有功能緊密結合、最快看到成效

1. **完成 SQLite 結構與 README 同步更新**

   - 更新 `README.md` 的「數據存儲」部分，反映目前已使用 SQLite。
   - 確認 `knex` migration、`proxy.ts` 所產 schema 與現有邏輯一致。

2. **實作「賬單 OCR 導入」 MVP（使用 PaddleOCR）** ⭐

   **步驟 2.1：建立 OCR 服務（Python microservice）**

   - 在項目根目錄建立 `ocr-service/` 目錄
   - 建立 `ocr-service/requirements.txt`（包含 PaddleOCR、FastAPI 等）
   - 建立 `ocr-service/main.py`（FastAPI 服務，提供 `/ocr` 端點）
   - 建立 `ocr-service/Dockerfile`（可選，用於容器化）
   - 測試 OCR 服務獨立運行

   **步驟 2.2：Node.js 後端整合**

   - 在 `server/` 目錄新增 `ocrClient.ts`（HTTP 客戶端，呼叫 OCR 服務）
   - 建立 `server/llm/` 目錄，實現 LLM 相關功能：
     - `leChatClient.ts`：Le Chat API 客戶端封裝
     - `rateLimit.ts`：API 調用速率限制（參考 `01-mc-system`）
     - `usageTracker.ts`：API 使用量記錄
     - `types.ts`：定義賬單解析的響應格式
     - `billParser.ts`：整合 OCR 文本 + LLM 解析 → 結構化賬單數據
   - 在 `server.ts` 新增 API 端點：
     - `POST /api/bill/ocr-upload`：接收圖片，呼叫 OCR，返回解析結果
   - 可複用現有 Multer 圖片上傳邏輯
   - 實現資料庫 migration，新增 `llm_api_usage` 表

   **步驟 2.3：前端整合**

   - 在 `public/calculator.html` 或新建 `public/bill-ocr.html`
   - 新增「拍照上傳賬單」按鈕和圖片預覽
   - 上傳後顯示 OCR 結果，允許用戶編輯後保存
   - 與現有「智能計算」流程整合

   **步驟 2.4：錯誤處理與優化**

   - OCR 失敗時的降級方案（提示用戶手動輸入）
   - 圖片預處理（旋轉、裁剪、增強對比度等）
   - 解析結果的置信度評分
   - 用戶反饋機制（標記 OCR 錯誤，用於改進）

   **技術架構示意**：

   ```
   前端 (calculator.html)
     ↓ POST /api/bill/ocr-upload (multipart/form-data)
   Node.js 後端 (server.ts)
     ↓ 保存圖片到 data/receipts/
     ↓ HTTP POST → OCR Service
   Python OCR Service (ocr-service/main.py)
     ↓ PaddleOCR.ocr(img_path)
     ↓ 返回 OCR 文本結果
   Node.js 後端 (billParser.ts)
     ↓ 檢查 rateLimit.ts（排隊機制）
     ↓ 調用 leChatClient.ts → Le Chat API
     ↓ 使用 LLM 解析 OCR 文本 → 結構化 JSON
     ↓ usageTracker.ts 記錄 API 使用量
     ↓ 驗證 JSON 格式（使用 cast.ts）
     ↓ 返回 JSON { restaurant, date, items: [...], total, tip }
   前端
     ↓ 顯示結果，允許編輯
     ↓ 保存到現有賬單計算流程
   ```

   **LLM 解析流程詳解**：

   ```
   OCR 文本輸入
     ↓
   構建 Prompt（包含格式要求、示例）
     ↓
   rateLimit.ts 檢查並等待（確保不超過 API 限制）
     ↓
   調用 Le Chat API
     ↓
   使用 best-effort-json-parser 解析響應
     ↓
   使用 cast.ts 驗證 JSON 結構
     ↓
   如果驗證失敗 → 自動重試（修復 JSON）
     ↓
   記錄到 llm_api_usage 表
     ↓
   返回結構化數據
   ```

### 中期（Phase 2）：餐廳資料與偏好收集

1. **建立餐廳資料 schema + seed 資料**
   - 可先用手動 seed / 公開 dataset，之後再接爬蟲。
2. **Playwright / Puppeteer 爬蟲（僅限練習與非商業用途）**
   - 把少量餐廳資料抓到 SQLite 中，供推薦 / 心動模式使用。
3. **開發「心動模式」頁面**
   - 前端翻卡 UI + 後端 API + 偏好儲存。

### 中長期（Phase 3）：推薦系統與圖像識別深化

1. **規則加權推薦 → 簡單推薦模型**
   - 從加權排序開始，實驗不同權重與規則。
   - 有足夠資料後，可加入簡單 ML 模型（content-based / collaborative filtering）。
2. **食物圖片識別（若你有 ML 興趣）**
   - 先用雲端圖像標籤 API 做 Demo。
   - 有餘力再嘗試自己訓練小模型（使用雲端 GPU）。

---

## 總結

- **最貼合 PBC 主題且回報最高的起點**：賬單 OCR + LLM NLP，自動填寫賬單信息，直接優化現有核心流程。
  - **推薦使用 PaddleOCR**：老師推薦，對中文識別效果優秀，開源免費，符合項目需求。
  - **推薦使用 Le Chat API**：限量免費，適合學習和開發階段，支持中文理解。
- **拓展 Party 體驗的關鍵功能**：餐廳資料庫 + 推薦演算法 + 心動模式三件套，讓 PBC 從「分賬工具」升級為「聚會策劃助手」。
- **技術架構建議**：
  - **OCR**：採用 **Python microservice + PaddleOCR**，與 Node.js 後端解耦
  - **NLP**：採用 **Le Chat API + 排隊機制 + 使用量記錄**（參考 `01-mc-system` 架構）
  - **關鍵技術點**：
    - 使用 `best-effort-json-parser` 處理可能不完整的 JSON
    - 使用 `cast.ts` 驗證 LLM 響應格式
    - 實現速率限制（`rateLimit.ts`）避免超過 API 限制
    - 記錄 API 使用量到資料庫（`llm_api_usage` 表）
    - 實現自動重試和錯誤處理機制
  - 其他 AI 功能可視情況使用雲端 API 或自建服務
  - 把本機計算壓力降到最低，只在你想深挖 ML 時再考慮自訓模型與 GPU
- 以上規劃可以按階段實作，隨時根據實際開發體驗與資源情況調整優先順序。

---

## 附錄 A：參考項目架構說明（01-mc-system）

### 關鍵架構模式

`01-mc-system` 項目展示了如何優雅地整合 LLM API，以下是值得參考的設計模式：

1. **速率限制機制**（`rate-limit.ts`）

   - 使用全局變量追蹤最後調用時間
   - 簡單但有效的排隊機制
   - 確保不超過 API 限制

2. **JSON 解析與驗證**（`generate.ts` + `types.ts`）

   - 使用 `best-effort-json-parser` 處理可能不完整的 JSON
   - 使用 `cast.ts` 進行類型驗證
   - 自動重試機制（如果 JSON 解析失敗）

3. **錯誤處理策略**

   - 捕獲 JSON 解析錯誤
   - 自動調用 LLM 修復 JSON
   - 清晰的錯誤訊息

4. **資料庫整合**
   - 使用 `better-sqlite3-proxy` 進行類型安全的資料庫操作
   - 將 LLM 生成結果保存到資料庫

### 在 PBC 項目中的應用

- **直接可用的模式**：

  - `rateLimit.ts`：可以直接參考實現
  - `billParser.ts`：參考 `generate.ts` 的錯誤處理和重試邏輯
  - `types.ts`：參考如何定義響應格式和驗證器

- **需要擴展的部分**：
  - 添加 API 使用量記錄（`usageTracker.ts`）
  - 添加用戶級別的使用量追蹤
  - 實現使用量監控和告警

---

## 附錄 B：PaddleOCR 快速開始指南

### 安裝 PaddleOCR（Python 環境）

```bash
# 1. 確保有 Python 3.8+
python --version

# 2. 安裝 PaddleOCR
pip install paddleocr

# 3. 首次運行會自動下載模型（約 8.6MB）
```

### 基本使用示例（Python）

```python
from paddleocr import PaddleOCR

# 初始化 OCR（支持中英文）
ocr = PaddleOCR(use_angle_cls=True, lang='ch')  # ch 表示中英文

# 識別圖片
result = ocr.ocr('path/to/bill.jpg', cls=True)

# 結果格式：[[[座標], (文字, 置信度)], ...]
for line in result[0]:
    print(f"文字: {line[1][0]}, 置信度: {line[1][1]}")
```

### FastAPI 服務示例（ocr-service/main.py）

```python
from fastapi import FastAPI, File, UploadFile
from paddleocr import PaddleOCR
import uvicorn

app = FastAPI()
ocr = PaddleOCR(use_angle_cls=True, lang='ch')

@app.post("/ocr")
async def ocr_image(file: UploadFile = File(...)):
    # 保存上傳的圖片
    with open(f"temp_{file.filename}", "wb") as f:
        f.write(await file.read())

    # OCR 識別
    result = ocr.ocr(f"temp_{file.filename}", cls=True)

    # 提取所有文字
    texts = [line[1][0] for line in result[0]]

    return {"text": "\n".join(texts), "raw_result": result}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Node.js 呼叫 OCR 服務示例（server/ocrClient.ts）

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
  return data.text; // 返回 OCR 識別的文字
}
```

### LLM API 整合示例（參考 01-mc-system 架構）

#### 1. Le Chat API 客戶端（server/llm/leChatClient.ts）

```typescript
import { env } from "../env";

// 根據 Le Chat API 文檔調整
export class LeChatClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = env.LE_CHAT_API_KEY;
    this.baseUrl = env.LE_CHAT_API_URL || "https://api.lechat.ai/v1";
  }

  async chatComplete(messages: Array<{ role: string; content: string }>) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "le-chat-model", // 根據實際模型名稱調整
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Le Chat API error: ${response.statusText}`);
    }

    return await response.json();
  }
}

export const leChat = new LeChatClient();
```

#### 2. 速率限制（server/llm/rateLimit.ts）

```typescript
// 參考 01-mc-system/rate-limit.ts
let lastTime = Date.now();
const interval = 2000; // 2 秒間隔（根據 Le Chat API 限制調整）

export async function waitForRateLimit(label: string) {
  for (;;) {
    const now = Date.now();
    const passedTime = now - lastTime;

    if (passedTime < interval) {
      await new Promise((resolve) =>
        setTimeout(resolve, interval - passedTime)
      );
      continue;
    }

    lastTime = now;
    return;
  }
}
```

#### 3. API 使用量記錄（server/llm/usageTracker.ts）

```typescript
import { proxy } from "../proxy";

export async function recordApiUsage(options: {
  userId?: number;
  requestType: string;
  tokensUsed?: number;
  cost?: number;
  success: boolean;
  errorMessage?: string;
}) {
  proxy.llm_api_usage.push({
    user_id: options.userId ?? null,
    request_type: options.requestType,
    tokens_used: options.tokensUsed ?? null,
    cost: options.cost ?? null,
    success: options.success,
    error_message: options.errorMessage ?? null,
    created_at: new Date(),
  });
}

export async function getUsageStats(userId?: number) {
  // 查詢使用量統計
  // 實現邏輯...
}
```

#### 4. 賬單解析類型定義（server/llm/types.ts）

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
}
`.trim();

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

#### 5. 賬單解析主邏輯（server/llm/billParser.ts）

```typescript
import { parse } from "best-effort-json-parser";
import { leChat } from "./leChatClient";
import { waitForRateLimit } from "./rateLimit";
import { recordApiUsage } from "./usageTracker";
import { BillParser, BillResponseFormat } from "./types";

parse.onExtraToken = (text, data, reminding) => {
  // 忽略額外的 token
};

function handleResponse(response: any) {
  if (response.choices[0].finishReason !== "stop") {
    throw new Error(
      `Expected finishReason to be 'stop', but got ${response.choices[0].finishReason}`
    );
  }

  let content = response.choices[0].message.content;
  if (typeof content !== "string") {
    throw new Error("Expected content to be a string");
  }

  // 提取 JSON 部分
  let startIndex = content.indexOf("{");
  if (startIndex === -1) {
    throw new Error("Expected content to contain a JSON object");
  }

  let text = content.slice(startIndex);
  let json = parse(text);
  let bill = BillParser.parse(json);

  return bill;
}

export async function parseBillFromOCR(
  ocrText: string,
  userId?: number
): Promise<any> {
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
      {
        role: "user",
        content: prompt,
      },
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
      // 如果 JSON 解析失敗，嘗試修復
      await waitForRateLimit("parseBillFromOCR (fix json)");

      const fixResponse = await leChat.chatComplete([
        {
          role: "user",
          content: prompt,
        },
        {
          role: "assistant",
          content: response.choices[0].message.content,
        },
        {
          role: "user",
          content: `
${error}

請修復 JSON 並返回正確的格式：
${BillResponseFormat}
`,
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

#### 6. 資料庫 Migration（新增 llm_api_usage 表）

```typescript
// migrations/xxxxx_add_llm_api_usage.ts
import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("llm_api_usage"))) {
    await knex.schema.createTable("llm_api_usage", (table) => {
      table.increments("id");
      table.integer("user_id").nullable();
      table.string("request_type").notNullable();
      table.integer("tokens_used").nullable();
      table.decimal("cost", 10, 4).nullable();
      table.boolean("success").notNullable();
      table.text("error_message").nullable();
      table.timestamps(false, true);

      // 外鍵（如果 users 表存在）
      // table.foreign('user_id').references('id').inTable('users');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("llm_api_usage");
}
```

### 環境變數配置（.env）

```env
# OCR 服務地址
OCR_SERVICE_URL=http://localhost:8000

# Le Chat API 配置
LE_CHAT_API_KEY=your_api_key_here
LE_CHAT_API_URL=https://api.lechat.ai/v1

# 其他現有配置...
```

### 依賴安裝

```bash
# 安裝 LLM 相關依賴
npm install best-effort-json-parser cast.ts

# 如果需要更複雜的隊列管理
npm install bull bullmq
```
