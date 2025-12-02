## PartyBillCalculator AI 發展方向規劃

本文件總結 PBC 在完成資料庫升級（JSON → SQLite）後，進一步引入 AI 能力的可能方向。內容涵蓋「方向建議」、「推薦技術與 Library」、「難度」、「電腦與計算需求」等面向，作為後續開發參考路線圖。

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

- **API 使用量記錄**：

  - SQLite 新增 `llm_api_usage` table，欄位：`user_id` (可選)、`request_type`、`tokens_used`、`cost`、`timestamp`、`success`、`error_message`
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

## 2. 食物圖片識別（TensorFlow / 影像分類）

### 2.1 功能構想

- 用戶上傳餐照，系統識別食物類型（例：牛排、壽司、甜品...）
  - 可作「本次聚會吃了什麼」紀錄，也可反饋餐廳推薦

### 2.2 推薦工具 / Library

- **建議雲端圖像 API**（Google Vision, Azure Custom Vision...）
- **若要自行訓練模型**：用 `@tensorflow/tfjs-node`、或另開 Python Microservice，採 Transfer learning（ImageNet Food-101 dataset）

### 2.3 難度與需求

- 雲端 API：中等；模型訓練：中高（須 ML 基礎、資料集）
- 訓練需 GPU（Colab、Kaggle），推理小模型可 CPU
- **優先度：★★★☆☆**（非核心、加分項）

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

## 4. 餐廳推薦演算法（偏好 + 距離 + 評分）

### 4.1 功能構想

- 為下次聚會推薦餐廳，考慮用戶歷史偏好（類型/價位）、距離、評分等

### 4.2 推薦技術路線

- **第一階段：規則加權排序**（無需 ML）

  - 範例公式：
    ```
    score = w1 * rating + w2 * f(distance) + w3 * match_preference + w4 * price_fit
    ```
  - 權重、運算可以配置檔與 DB 管理；偏好來自歷史紀錄或心動模式 like/dislike 表

- **第二階段：逐步引入推薦 ML**
  - 可採 content-based filtering（屬性向量）或簡單協同過濾
  - 實作可先純 TS/JS，再考慮 Python + sklearn/LightFM 等

### 4.3 難度與需求

- 加權規則：容易（重點在 schema 和權重微調）
- ML 推薦：中等（推薦系統知識；可循序導入）
- **優先度：★★★★☆**

---

## 5. 「心動模式」：Tinder 式滑卡餐廳 UI

### 5.1 功能構想

- 一頁只顯示一家餐廳（圖＋名＋菜系＋價位＋距離＋標籤），用戶「右滑喜歡、左滑不感興趣」記錄偏好

### 5.2 工具

- **前端**：原生 HTML + Tailwind + JS ／ 新增 `public/heart-mode.html` ／ 使用簡單 JS/CSS 動畫
- **後端/DB**：資料表 `user_restaurant_preferences`（`user_id`, `restaurant_id`, `preference`, `timestamp`），API 見 `/api/restaurants/next`／`/feedback`

### 5.3 難度與需求

- 難度：中（主要為產品設計和 UI）
- 電腦需求低
- **優先度：★★★★☆**

---

## 綜合建議與 Roadmap

### ✅ 短期（Phase 1）：重點功能實作（已完成）

1. ✅ **SQLite 結構更新與 README 同步**
2. ✅ **PaddleOCR OCR 服務（Python microservice）建立＋已整合 Node.js 後端＋ Mistral LLM 串接**
   - 完整技術棧包括：`ocr-service/` 微服務（Py, FastAPI），`server/llm` 相關（`mistral.ts` 主 LLM 客戶端，`rateLimit.ts`, `usageTracker.ts`, `billParser.ts`...）
   - 自動填表、前端（calculator.html）集成、錯誤/降級方案完善

**技術架構摘要：**

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
   # 複製 env.example 為 .env，設置 MISTRAL_AI_API_KEY、OCR_SERVICE_URL
   npm run db:migrate
   npm run dev
   ```

3. **前端 / 快速測試**

   - 可同步啟動 OCR 服務和 Node.js (`npm run dev:all`)
   - 使用 `npm run ocr:test`、`npm run llm:test v1/v2/v3` 測試健康

4. **使用方法**
   - http://localhost:3000/calculator.html → 上傳賬單圖片 → AI 識別自動填單

---

### 中期（Phase 2）：餐廳資料收集與個人偏好

1. 建立餐廳 schema + seed 資料（手動/開放 dataset）
2. Playwright/Puppeteer 爬蟲，將少量資料寫入 SQLite
3. 開發心動模式頁面（滑卡 UI, backend API, 偏好儲存）

### 中長期（Phase 3）：推薦系統和影像辨識

1. 加權規則推薦 → 漸進引入推薦 ML
2. 食物圖片分類（先雲端，後自訓，有餘力再學術探索）

---

## 總結

- ✅ **最核心優先建議**：賬單 OCR + LLM，最大化現有體驗，已高效落地
- PaddleOCR（中文識別佳），Mistral AI（免費/中文支持）實戰驗證
- 若要進一步提升：餐廳資料庫、推薦算法、心動滑卡三件套核心建議
- 架構選擇以「後端解耦、開源優先、壓力最小本機」原則
- 技術精要：排隊控速（rateLimit.ts）、JSON 驗證（cast.ts）、錯誤/重試、自動降級、API 使用量記錄
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
OCR_SERVICE_URL=http://localhost:8000
LE_CHAT_API_KEY=your_api_key_here
LE_CHAT_API_URL=https://api.lechat.ai/v1
```

### 依賴安裝

```bash
npm install best-effort-json-parser cast.ts
npm install bull bullmq   # 如需支援進階 queue 管理
```
