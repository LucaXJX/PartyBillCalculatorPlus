# OCR + LLM 賬單識別功能實作文檔

## 概述

本文檔記錄了「賬單 OCR + NLP 自動填寫」功能的實作進度。

## 已完成的工作

### 1. OCR 服務（Python）

**位置**: `ocr-service/`

- ✅ `requirements.txt` - Python 依賴配置
- ✅ `main.py` - FastAPI OCR 服務
  - `/ocr` 端點：接收圖片，返回 OCR 識別結果
  - `/health` 端點：健康檢查
  - 使用 PaddleOCR 進行中英文識別
- ✅ `Dockerfile` - Docker 容器化配置
- ✅ `README.md` - 使用說明文檔

**運行方式**:
```bash
cd ocr-service
pip install -r requirements.txt
python main.py
# 或
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Node.js 後端整合

**OCR 客戶端** (`server/ocrClient.ts`):
- ✅ `ocrImage()` - 調用 OCR 服務識別圖片
- ✅ `checkOCRService()` - 檢查 OCR 服務健康狀態

**LLM 模組** (`server/llm/`):
- ✅ `env.ts` - 環境變數配置（Mistral AI API Key）
- ✅ `mistral.ts` - Mistral AI 客戶端
- ✅ `rateLimit.ts` - API 調用速率限制（1 秒間隔）
- ✅ `types.ts` - 賬單解析類型定義和驗證器
- ✅ `usageTracker.ts` - API 使用量記錄
- ✅ `billParser.ts` - 核心解析邏輯（OCR 文本 → 結構化 JSON）

**API 端點** (`server/server.ts`):
- ✅ `POST /api/bill/ocr-upload` - 上傳圖片，自動識別和解析賬單

### 3. 資料庫

**Migration** (`migrations/20250101000000_add_llm_api_usage.ts`):
- ✅ 創建 `llm_api_usage` 表，記錄 API 調用信息

**Proxy 更新** (`server/proxy.ts`):
- ✅ 添加 `LLMApiUsage` 類型定義
- ✅ 更新 `DBProxy` 類型

**ERD 更新** (`erd.txt`):
- ✅ 添加 `llm_api_usage` 表定義

### 4. 環境配置

**`env.example`**:
- ✅ 添加 `OCR_SERVICE_URL`
- ✅ 添加 `MISTRAL_AI_API_KEY`

## 待完成的工作

### 前端整合

- ⏳ 在 `public/calculator.html` 添加「拍照上傳賬單」功能
- ⏳ 圖片預覽
- ⏳ 顯示 OCR 和解析結果
- ⏳ 允許用戶編輯後保存到現有計算流程

### 依賴安裝

需要安裝以下 npm 包：
```bash
npm install form-data @types/form-data best-effort-json-parser cast.ts @mistralai/mistralai
```

### 資料庫 Migration

運行 migration 創建 `llm_api_usage` 表：
```bash
npm run db:migrate
```

## 使用流程

1. **啟動 OCR 服務**:
   ```bash
   cd ocr-service
   python main.py
   ```

2. **配置環境變數**:
   在 `.env` 文件中設置：
   ```
   OCR_SERVICE_URL=http://localhost:8000
   MISTRAL_AI_API_KEY=your_api_key_here
   ```

3. **運行資料庫 Migration**:
   ```bash
   npm run db:migrate
   ```

4. **啟動 Node.js 服務**:
   ```bash
   npm run dev
   ```

5. **測試 API**:
   ```bash
   curl -X POST http://localhost:3000/api/bill/ocr-upload \
     -H "Cookie: session=..." \
     -F "billImage=@/path/to/bill.jpg"
   ```

## API 響應格式

### 成功響應
```json
{
  "success": true,
  "ocrText": "識別出的完整文字...",
  "bill": {
    "restaurant": "餐廳名稱",
    "date": "2024-01-01",
    "items": [
      {
        "name": "菜品名稱",
        "price": 100,
        "quantity": 1
      }
    ],
    "subtotal": 500,
    "tip": 50,
    "total": 550,
    "currency": "HKD"
  },
  "message": "賬單識別成功"
}
```

### 失敗響應（LLM 解析失敗）
```json
{
  "success": false,
  "ocrText": "識別出的文字...",
  "error": "自動解析失敗，請手動輸入賬單信息"
}
```

## 技術架構

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
  ↓ 調用 mistral.ts → Mistral AI API
  ↓ 使用 LLM 解析 OCR 文本 → 結構化 JSON
  ↓ usageTracker.ts 記錄 API 使用量
  ↓ 驗證 JSON 格式（使用 cast.ts）
  ↓ 返回 JSON { restaurant, date, items: [...], total, tip }
前端
  ↓ 顯示結果，允許編輯
  ↓ 保存到現有賬單計算流程
```

## 注意事項

1. **OCR 服務**：首次運行時，PaddleOCR 會自動下載模型（約 8.6MB）
2. **速率限制**：Mistral AI 免費計劃限制為 60 RPM，已實現 1 秒間隔限制
3. **錯誤處理**：如果 LLM 解析失敗，會返回 OCR 文本，讓用戶手動輸入
4. **使用量記錄**：所有 API 調用都會記錄到 `llm_api_usage` 表

## 下一步

1. 完成前端整合
2. 測試完整流程
3. 優化錯誤處理和用戶體驗
4. 添加使用量監控和告警

