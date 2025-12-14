# PartyBillCalculatorPlus (PBC+ 聚賬通 Plus)

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.2+-lightgrey.svg)](https://expressjs.com/)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一個現代化的聚會賬單分攤計算系統，支持多用戶認證、智能計算和支付狀態管理。

## 📋 目錄

- [功能特色](#功能特色)
- [技術棧](#技術棧)
- [安裝指南](#安裝指南)
- [使用方法](#使用方法)
- [API 文檔](#api-文檔)
- [項目結構](#項目結構)
- [開發指南](#開發指南)
- [測試](#測試)
- [部署](#部署)
- [貢獻指南](#貢獻指南)
- [許可證](#許可證)
- [引用說明](#引用說明)

## ✨ 功能特色 {#功能特色}

### 🔐 用戶認證系統

- 用戶註冊和登入
- 會話管理和安全驗證
- 個人資料管理

### 💰 智能賬單計算

- 多參與者賬單分攤
- 自定義項目和金額
- 小費計算
- 付款人指定功能

### 🤖 AI 功能

#### 賬單識別（Beta）

- **OCR 圖片識別**：使用 PaddleOCR 識別賬單圖片中的文字
- **LLM 智能解析**：使用 Mistral AI 將 OCR 文本解析為結構化數據
- **自動填充**：識別結果自動填充到表單，減少手動輸入
- 支持中英文混合識別
- API 使用量追蹤與每日限制（10 次/天）

#### 食物圖片識別

- **TensorFlow.js 分層識別**：使用本地模型進行食物識別
  - 第一層：食物檢測（Food/Non-Food 二分類）
  - 第二層：國家分類（10 個國家/地區）
  - 第三層：細粒度分類（代碼保留，暫時隱藏）
- 圖片壓縮與存儲（Sharp）
- 異步識別調度機制
- 健康檢查與批量修復機制

#### 餐廳推薦系統

- **餐廳資料爬蟲**：使用 Playwright 從 OpenRice 自動抓取餐廳資料
- **心動模式**：Tinder 式滑卡 UI 瀏覽餐廳（heart-mode.html）
- **智能推薦算法**：規則加權排序，考慮用戶偏好、LLM 評分、距離、價格、菜系
- **LLM 餐廳評分**：使用 Mistral AI 根據餐廳名稱和 URL 獲取評分（帶 7 天緩存）
- **距離計算**：集成 Google Maps Distance Matrix API（可選），支持瀏覽器端位置獲取
- **我的餐廳**：查看收藏和喜歡的餐廳（my-restaurants.html），支持取消收藏和直接跳轉 OpenRice
- 用戶偏好記錄與分析

### 📊 賬單管理

- 個人賬單列表（創建的和參與的）
- 支付狀態追蹤（待支付/已支付）
- 憑證圖片上傳（最多 6 張，帶預覽）
- 賬單搜索和篩選（5 種狀態篩選）
- 應收款/應付款統計和管理
- 確認收款功能 ⭐
- 拒絕收款功能（未收到款/錯誤單據）⭐

### 💬 消息系統

- 新賬單通知：創建賬單時自動通知所有參與者
- 支付提交通知：參與者提交支付時通知收款人
- 支付確認通知：收款人確認收款時通知付款人
- 消息狀態管理：標記已讀、刪除消息
- 消息頁面（messages.html）：統一查看和管理所有消息

### 🎨 用戶界面

- 響應式設計
- 現代化 UI/UX
- 直觀的操作流程

## 🛠 技術棧 {#技術棧}

### 前端

- **HTML5** - 語義化標記
- **CSS3** - 樣式設計
- **Tailwind CSS** - 實用優先的 CSS 框架
- **JavaScript (ES6+)** - 現代 JavaScript 特性
- **Font Awesome** - 圖標庫

### 後端

- **Node.js** - JavaScript 運行環境
- **Express.js** - Web 應用框架
- **TypeScript** - 類型安全的 JavaScript
- **Multer** - 文件上傳處理
- **Better-SQLite3** - SQLite 資料庫驅動
- **Knex.js** - 資料庫遷移和查詢構建器

### AI 服務

- **PaddleOCR** - 中文優化的 OCR 識別引擎（Python microservice）
- **Mistral AI** - LLM API 用於賬單文本結構化解析和餐廳評分
- **TensorFlow.js** - 本地食物圖片識別模型（需先訓練）
- **TensorFlow (Python)** - 模型訓練框架（用於訓練食物識別模型）
- **Playwright** - 餐廳資料爬蟲（OpenRice）
- **Google Maps API** - 距離計算（可選，支持 Distance Matrix API）

### 數據存儲

- **SQLite3** - 使用 `better-sqlite3` 進行數據存儲
- **Knex.js** - 資料庫遷移和查詢構建器

### 開發工具

- **ts-node** - TypeScript 執行環境
- **ESLint** - 代碼質量檢查
- **Git** - 版本控制

## 🚀 安裝指南 {#安裝指南}

### 系統要求

- Node.js 18.0 或更高版本
- npm 8.0 或更高版本
- 現代瀏覽器（Chrome、Firefox、Safari、Edge）

### 安裝步驟

1. **克隆項目**

   ```bash
   git clone https://github.com/LucaXJX/PartyBillCalculatorPlus.git
   cd PartyBillCalculator
   ```

2. **安裝依賴**

   ```bash
   npm install
   ```

3. **環境配置**

   複製環境變量示例文件：

   ```bash
   # Linux/macOS
   cp env.example .env

   # Windows (CMD)
   copy env.example .env

   # Windows (PowerShell)
   Copy-Item env.example .env
   ```

   然後編輯 `.env` 文件，配置必要的環境變量：

   - `SESSION_SECRET`：會話密鑰（請設置為隨機字符串）
   - `MISTRAL_AI_API_KEY`：Mistral AI API 密鑰（用於 AI 賬單識別）
   - `OCR_SERVICE_URL`：OCR 服務地址（默認：http://localhost:8000）
   - `GOOGLE_MAPS_API_KEY`：Google Maps API 密鑰（可選，用於距離計算）

4. **設置 OCR 服務**（可選，如需使用 AI 賬單識別功能）

   參考 `ocr-service/SETUP.md` 進行設置：

   ```bash
   cd ocr-service

   # 創建 Python 3.10 虛擬環境
   py -3.10 -m venv venv

   # 激活虛擬環境（Windows Git Bash）
   source venv/Scripts/activate
   # 或 Windows PowerShell/CMD
   venv\Scripts\activate

   # 安裝依賴
   python -m pip install --upgrade pip
   python -m pip install paddlepaddle-gpu==3.2.1 -i https://www.paddlepaddle.org.cn/packages/stable/cu118/
   python -m pip install "paddleocr[all]"
   pip install -r requirements.txt

   # 啟動 OCR 服務
   python main.py
   ```

   或使用 npm 腳本：

   ```bash
   npm run ocr:dev
   ```

5. **設置食物識別模型訓練**（可選，如需訓練自定義模型）

   參考 `food-recognition-service/README.md` 進行設置：

   ```bash
   cd food-recognition-service

   # 創建 Python 虛擬環境
   python -m venv venv

   # 激活虛擬環境（Windows Git Bash）
   source venv/Scripts/activate
   # 或 Windows PowerShell/CMD
   venv\Scripts\activate

   # 安裝依賴
   pip install -r requirements.txt

   # 訓練第一層模型（食物檢測）
   python train/train_level1.py

   # 訓練第二層模型（國家分類）
   python train/train_level2.py

   # 訓練第三層模型（細粒度分類，可選）
   python train/train_level3.py

   # 轉換模型為 TensorFlow.js 格式
   python convert/convert_to_tfjs.py
   ```

   或使用 npm 腳本：

   ```bash
   npm run train:python:level1  # 訓練第一層
   npm run train:python:level2  # 訓練第二層
   npm run train:python:level3  # 訓練第三層
   npm run train:python:convert # 轉換模型
   ```

   轉換後的模型會保存在 `food-recognition-service/models_tfjs/` 目錄中。

6. **初始化資料庫**

   ```bash
   # 運行資料庫遷移
   npm run db:migrate
   ```

7. **啟動服務器**

   - **開發模式**（代碼熱更新，適合開發調試）：

     ```bash
     npm run dev
     ```

   - **同時啟動 Node.js 和 OCR 服務**（推薦，如需使用 AI 功能）：

     ```bash
     npm run dev:all
     ```

   - **正式啟動**（生產或模擬真實部署，正式編譯 TypeScript 源碼）：

     ```bash
     npm run build
     npm start
     ```

8. **訪問應用**
   打開瀏覽器訪問 `http://localhost:3000`

## 📖 使用方法 {#使用方法}

### 基本流程

1. **註冊/登入**

   - 訪問首頁，點擊「登入」或「註冊」
   - 填寫用戶信息完成註冊
   - 使用郵箱和密碼登入

2. **創建賬單**

   - 點擊「智能計算」進入計算器頁面
   - **方式一：AI 自動識別**（Beta）
     - 點擊「AI 賬單識別（Beta）」區域的「選擇圖片」按鈕
     - 選擇賬單圖片並點擊「識別賬單」
     - 系統自動填充表單，檢查並編輯後保存
   - **方式二：手動輸入**
     - 填寫聚會基本信息（名稱、日期、地點、小費比例）
     - 添加參與者
     - 添加消費項目並分配給參與者
     - 選擇付款人（可選）

3. **計算結果**

   - 點擊「開始計算」查看分攤結果
   - 保存賬單到個人賬單列表

4. **管理賬單**

   - 在「我的賬單」頁面查看所有賬單
   - 查看統計數據（6 個統計卡片）
   - 標記支付狀態（待支付/已支付）
   - 上傳支付憑證（最多 6 張圖片）
   - 查看應收款詳情
   - 確認收款或拒絕收款
   - 使用篩選和搜索功能

5. **餐廳推薦**（心動模式）

   - 訪問「心動模式」頁面瀏覽餐廳
   - 滑動卡片記錄偏好（喜歡/不喜歡/收藏）
   - 查看餐廳詳情（評分、LLM 評分、地址、菜系、價格）
   - 系統根據偏好推薦餐廳
   - 支持距離計算（需配置 Google Maps API Key）

6. **我的餐廳**

   - 訪問「我的餐廳」頁面查看收藏和喜歡的餐廳
   - 按類型篩選（全部/收藏/喜歡）
   - 取消收藏或取消喜歡
   - 直接跳轉到 OpenRice 餐廳頁面

7. **消息管理**
   - 訪問「消息」頁面查看所有通知
   - 查看新賬單、支付提交、支付確認等消息
   - 標記消息為已讀
   - 通過消息直接確認收款或拒絕收款

## 📚 API 文檔 {#api-文檔}

### 認證相關

- `POST /api/auth/register` - 用戶註冊
- `POST /api/auth/login` - 用戶登入
- `POST /api/auth/logout` - 用戶登出
- `GET /api/auth/me` - 獲取當前用戶信息

### 賬單管理

- `GET /api/bills` - 獲取用戶賬單列表
- `POST /api/bill/save` - 保存賬單
- `POST /api/bill/info` - 更新賬單信息
- `POST /api/bill/reset` - 重置當前賬單

### 參與者管理

- `POST /api/participant` - 添加參與者
- `DELETE /api/participant/:id` - 刪除參與者
- `GET /api/participants` - 獲取參與者列表

### 項目管理

- `POST /api/item` - 添加消費項目
- `DELETE /api/item/:id` - 刪除項目

### 計算功能

- `GET /api/calculate` - 計算賬單分攤

### 支付管理

- `POST /api/bill/payment-status` - 更新支付狀態
- `POST /api/bill/confirm-payment` - 確認收款 ⭐
- `POST /api/bill/reject-payment` - 拒絕收款 ⭐
- `POST /api/receipt/upload` - 上傳收據圖片
- `GET /receipts/:filename` - 獲取收據圖片（需認證）

### AI 功能

- `POST /api/bill/ocr-upload` - 上傳賬單圖片進行 OCR + LLM 識別
- `POST /api/food/upload` - 上傳食物圖片進行識別
- `GET /api/food/recommendations` - 根據識別結果獲取食物推薦

### 餐廳相關

- `GET /api/restaurants/recommend` - 獲取餐廳推薦列表
- `GET /api/restaurants/next` - 獲取下一個餐廳（心動模式）
- `GET /api/restaurants/search` - 搜索餐廳（根據菜系、食物類型、評分）
- `GET /api/restaurants/:id` - 獲取餐廳詳情
- `GET /api/restaurants/my-favorites` - 獲取用戶收藏和喜歡的餐廳
- `GET /api/restaurants/recommend-by-food` - 根據食物識別結果推薦餐廳
- `POST /api/restaurants/preference` - 記錄用戶餐廳偏好（喜歡/不喜歡/收藏）

### 消息相關

- `GET /api/messages` - 獲取用戶的所有消息
- `GET /api/messages/unread-count` - 獲取未讀消息數量
- `POST /api/messages/mark-read` - 標記消息為已讀
- `POST /api/messages/mark-all-read` - 標記所有消息為已讀
- `POST /api/messages/confirm-payment` - 通過消息確認收款
- `POST /api/messages/reject-payment` - 通過消息拒絕收款
- `DELETE /api/messages/:id` - 刪除消息

## 📁 項目結構 {#項目結構}

```
PartyBillCalculator/
├── public/                      # 前端靜態文件
│   ├── index.html              # 首頁
│   ├── calculator.html         # 智能計算頁面
│   ├── my-bills.html           # 我的賬單頁面
│   ├── my-restaurants.html     # 我的餐廳頁面（收藏和喜歡）⭐
│   ├── heart-mode.html         # 心動模式（餐廳推薦）⭐
│   ├── messages.html           # 消息頁面
│   ├── login-page.html         # 登入頁面
│   ├── registration-page.html  # 註冊頁面
│   ├── copyright.html          # 版權聲明
│   ├── privacy-policy.html     # 隱私政策
│   ├── disclaimer.html         # 免責聲明
│   ├── js/                     # JavaScript 模組
│   │   ├── auth.js            # 認證管理
│   │   ├── components.js      # UI組件
│   │   └── page-setup.js      # 頁面設置
│   └── img/                    # 圖片資源
├── server/                     # 後端服務器代碼
│   ├── server.ts              # 主服務器文件
│   ├── types.ts               # TypeScript 類型定義
│   ├── dataManager.ts         # 數據管理
│   ├── storage.ts             # 數據存儲 ⭐
│   ├── messageManager.ts      # 消息管理
│   ├── billCalculator.ts      # 計算邏輯
│   ├── restaurantRecommender.ts  # 餐廳推薦算法 ⭐
│   ├── foodRecognition/       # 食物識別模組 ⭐
│   │   ├── foodImageManager.ts
│   │   ├── recognitionScheduler.ts
│   │   ├── foodRecommendationService.ts
│   │   └── healthCheck.ts
│   └── food-recognition/      # TensorFlow.js 模型管理 ⭐
│       └── models/
├── docs/                       # 項目文檔
│   ├── CHANGELOG.md                        # 更新日誌
│   ├── COMPONENT_SYSTEM.md                 # 組件系統文檔
│   ├── MESSAGE_SYSTEM.md                   # 消息系統文檔
│   ├── MY_BILLS_PAGE.md                    # 我的賬單頁面文檔
│   ├── PAYMENT_FLOW.md                     # 支付流程文檔
│   ├── RESTAURANT_RECOMMENDATION.md        # 餐廳推薦系統文檔 ⭐
│   ├── GOOGLE_MAPS_SETUP.md                # Google Maps API 設置指南 ⭐
│   ├── FOOD_RECOGNITION_ARCHITECTURE.md     # 食物識別架構文檔 ⭐
│   ├── TEST_USERS.md                       # 測試用戶列表
│   ├── TESTING_REPORT.md                   # 全面測試報告
│   ├── TROUBLESHOOTING.md                  # 故障排除
│   └── archive/               # 開發歷史文檔
│       ├── AUTH_SYSTEM_UPGRADE.md
│       ├── COMPLETE_UI_OPTIMIZATION_REPORT.md
│       ├── DOCUMENTATION_CONSOLIDATION_SUMMARY.md
│       ├── FINAL_SUMMARY.md
│       ├── MESSAGE_TESTING_GUIDE.md
│       ├── MY_BILLS_PAGE_IMPLEMENTATION.md
│       ├── OVERDUE_REMINDER_SYSTEM.md
│       ├── PARTICIPANT_CARD_REFACTOR.md
│       ├── RECEIPT_GENERATION_REPORT.md
│       ├── SECURITY_TEST_GUIDE.md
│       ├── SECURITY_UPDATES.md
│       ├── TEST_RESULTS.md
│       └── README.md
├── data/                       # 數據文件
│   └── receipts/              # 收據圖片 ⭐
├── ocr-service/                 # OCR 服務（Python microservice）
│   ├── main.py                # FastAPI 服務主文件
│   ├── requirements.txt       # Python 依賴
│   ├── Dockerfile             # Docker 配置
│   ├── README.md              # OCR 服務文檔
│   └── SETUP.md               # 安裝設置指南
├── food-recognition-service/    # 食物識別服務（Python + TensorFlow.js）⭐
│   ├── train/                 # 模型訓練腳本
│   ├── convert/               # 模型轉換腳本（Python → TensorFlow.js）
│   ├── models_tfjs/           # 轉換後的 TensorFlow.js 模型
│   └── README.md              # 食物識別服務文檔
├── scraper/                     # 餐廳資料爬蟲 ⭐
│   ├── scrapers/              # 爬蟲實現
│   │   ├── openrice-scraper.ts  # OpenRice 爬蟲
│   │   └── types.ts            # 類型定義
│   ├── examples/              # 示例腳本
│   │   └── run-scraper.ts     # 運行爬蟲腳本
│   ├── utils/                 # 工具函數
│   └── README.md              # 爬蟲文檔
├── server/                     # 後端服務器代碼
│   ├── server.ts              # 主服務器文件
│   ├── types.ts               # TypeScript 類型定義
│   ├── dataManager.ts         # 數據管理
│   ├── storage.ts             # 數據存儲 ⭐
│   ├── messageManager.ts      # 消息管理
│   ├── billCalculator.ts      # 計算邏輯
│   ├── ocrClient.ts           # OCR 服務客戶端 ⭐
│   └── llm/                   # LLM 相關模組 ⭐
│       ├── mistral.ts         # Mistral AI 客戶端
│       ├── billParser.ts      # 賬單解析邏輯
│       ├── rateLimit.ts       # API 速率限制
│       ├── usageTracker.ts    # API 使用量追蹤
│       ├── prompts.ts         # Prompt 版本管理
│       ├── types.ts           # 類型定義
│       ├── env.ts             # 環境變數
│       ├── restaurantRatingService.ts  # LLM 餐廳評分服務
│       ├── restaurantRecommendationService.ts  # LLM 餐廳推薦服務
│       ├── restaurantCache.ts  # LLM 結果緩存（7 天）
│       ├── restaurantLLMService.ts  # LLM 服務整合
│       └── userImageStatsService.ts  # 用戶圖片統計
├── migrations/                 # 資料庫遷移文件
│   ├── 20250101000000_add_llm_api_usage.ts
│   ├── 20250115000000_add_model_recognition_fields.ts
│   ├── 20250120000000_add_restaurant_tables.ts
│   └── 20251204020000_add_food_tables.ts
├── tests/                      # 測試文件
│   ├── api-test.js            # API 功能測試
│   ├── comprehensive-test.js  # 全面系統測試
│   ├── quick-test.js          # 快速功能測試
│   ├── TESTING_REPORT.md      # 全面測試報告
│   └── html/                  # HTML 測試頁面
├── scripts/                    # 工具腳本
│   ├── add-test-data.js       # 添加測試數據
│   ├── fix-bill-data.js       # 修復賬單數據
│   ├── generate-receipt-images.js  # 生成收據圖片
│   ├── migrate-passwords.js   # 密碼加密遷移
│   ├── unify-test-users.js    # 統一測試用戶配置
│   └── README.md              # 腳本使用說明
├── dist/                       # TypeScript 編譯輸出
├── .github/                    # GitHub 配置
│   ├── ISSUE_TEMPLATE/        # Issue 模板
│   │   ├── bug_report.md     # Bug 報告模板
│   │   └── feature_request.md # 功能請求模板
│   └── pull_request_template.md  # PR 模板
├── package.json                # 項目配置
├── tsconfig.json               # TypeScript 配置
├── env.example                 # 環境變量示例
├── .gitignore                  # Git 忽略文件
├── LICENSE                     # MIT 許可證
├── README.md                   # 項目說明
├── CONTRIBUTING.md             # 貢獻指南
├── CODE_OF_CONDUCT.md          # 行為準則
└── SECURITY.md                 # 安全政策
```

## 🔧 開發指南 {#開發指南}

### 開發環境設置

1. **安裝開發依賴**

   ```bash
   npm install --save-dev @types/node @types/express
   ```

2. **代碼格式化**

   ```bash
   npm run format
   ```

3. **類型檢查**
   ```bash
   npm run type-check
   ```

### 開發規範

- 使用 TypeScript 進行類型安全開發
- 遵循 ESLint 代碼規範
- 提交前進行代碼格式化
- 編寫清晰的註釋和文檔

### 添加新功能

1. 在 `server/types.ts` 中定義相關類型
2. 在 `server/` 目錄中實現後端邏輯
3. 在 `public/` 目錄中實現前端界面
4. 如需資料庫變更，創建 migration 文件
5. 更新 API 文檔
6. 添加相應測試

### 開發腳本

- `npm run dev` - 啟動開發服務器
- `npm run dev:all` - 同時啟動 Node.js 和 OCR 服務
- `npm run ocr:dev` - 啟動 OCR 服務
- `npm run ocr:test` - 測試 OCR 服務健康狀態
- `npm run llm:test` - 測試 LLM prompt（需要指定版本）
- `npm run db:migrate` - 運行資料庫遷移
- `npm run db:gen-proxy` - 生成資料庫 proxy 類型
- `npm run scraper:run` - 運行餐廳資料爬蟲
- `npm run scraper:test` - 測試爬蟲功能
- `npm run train:python:level1` - 訓練第一層模型（食物檢測）
- `npm run train:python:level2` - 訓練第二層模型（國家分類）
- `npm run train:python:level3` - 訓練第三層模型（細粒度分類）
- `npm run train:python:convert` - 轉換模型為 TensorFlow.js 格式

## 🧪 測試 {#測試}

### 快速測試

```bash
# 快速驗證系統基本功能
node tests/quick-test.js

# 全面測試系統功能和數據完整性
node tests/comprehensive-test.js
```

### API 測試

```bash
# 啟動服務器
npm run dev

# 在另一個終端運行 API 測試
node tests/api-test.js
```

### 測試文檔

```bash
# 查看測試報告
cat tests/TESTING_REPORT.md

# 查看測試用戶信息
cat docs/TEST_USERS.md

# 查看腳本使用說明
cat scripts/README.md
```

### 測試覆蓋範圍

- 用戶認證流程
- 賬單創建和計算
- 支付狀態管理
- API 端點功能
- 食物識別功能
- 餐廳推薦系統

## 🚀 部署 {#部署}

### 生產環境部署

1. **構建項目**

   ```bash
   npm run build
   ```

2. **設置環境變量**

   ```bash
   export NODE_ENV=production
   export PORT=3000
   ```

3. **啟動服務**
   ```bash
   npm start
   ```

### Docker 部署（計劃中）

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 貢獻指南 {#貢獻指南}

我們歡迎社區貢獻！請遵循以下步驟：

1. Fork 本項目
2. 創建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

### 貢獻類型

- 🐛 Bug 修復
- ✨ 新功能開發
- 📚 文檔改進
- 🎨 UI/UX 優化
- ⚡ 性能優化

## 📄 許可證 {#許可證}

本項目採用 MIT 許可證 - 查看 [LICENSE](LICENSE) 文件了解詳情。

## 📚 引用說明 {#引用說明}

### 第三方庫和框架

#### 前端框架和庫

- **Tailwind CSS** v2.2.19

  - 許可證: MIT
  - 用途: CSS 框架
  - 引用: https://tailwindcss.com/

- **Font Awesome** v6.0.0

  - 許可證: Free License
  - 用途: 圖標庫
  - 引用: https://fontawesome.com/

- **html2canvas** v1.4.1
  - 許可證: MIT
  - 用途: HTML 轉圖片功能
  - 引用: https://html2canvas.hertzen.com/

#### 後端框架和庫

- **Express.js** v4.18.2

  - 許可證: MIT
  - 用途: Web 應用框架
  - 引用: https://expressjs.com/

- **TypeScript** v5.0.4

  - 許可證: Apache-2.0
  - 用途: 類型安全的 JavaScript
  - 引用: https://www.typescriptlang.org/

- **Multer** v1.4.5

  - 許可證: MIT
  - 用途: 文件上傳處理
  - 引用: https://github.com/expressjs/multer

- **ts-node** v10.9.1
  - 許可證: MIT
  - 用途: TypeScript 執行環境
  - 引用: https://github.com/TypeStrong/ts-node

#### 開發工具

- **Node.js** v18+
  - 許可證: MIT
  - 用途: JavaScript 運行環境
  - 引用: https://nodejs.org/

### 字體資源

- **系統字體** - 使用系統默認字體
  - 用途: 用戶界面文字顯示
  - 引用: 使用 Tailwind CSS 的默認字體堆棧

### 圖片資源

- 項目圖標和 Logo
  - 用途: 品牌識別和用戶界面
  - 位置: `public/img/` 目錄

### 致謝

感謝所有開源社區的貢獻者，他們的優秀工作使這個項目成為可能。

---

**注意**: 這是一個教育項目，用於 DAE 課程學習目的。在生產環境使用前，請確保進行充分的安全審查和測試。
