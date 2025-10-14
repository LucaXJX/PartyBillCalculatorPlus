# 付款流程完整指南

## 📊 圖片存儲方案

### ✅ 選擇方案：局域網運行 + 本地存儲（方案 A）

**理由：**

- 🔒 **隱私性最高**：所有賬單和收據數據完全在本地，不會外傳
- ⚡ **速度快**：局域網傳輸，無網絡延遲
- 💰 **成本低**：無需第三方服務費用
- 🎯 **完全控制**：掌握所有數據和訪問權限
- 📚 **適合項目**：學校專題研習項目，本地存儲更合適

**存儲位置：**

- 收據圖片：`public/uploads/receipts/`
- 賬單數據：`data/bills.json`
- 用戶數據：`data/users.json`

---

## 🔄 完整付款流程

### 階段 1：智能計算頁面（付款人操作）

#### 1.1 選擇付款人

- 在"基本信息"區域，選擇誰是付款人
- 付款人將負責支付整個賬單的金額
- 其他參與者將向付款人支付各自的分攤金額

#### 1.2 計算賬單

- 點擊"開始計算"按鈕
- 系統自動計算每個參與者的分攤金額
- 如果有付款人，系統會顯示：
  - 付款人：標記為"付款人"
  - 其他參與者：顯示"需支付給 [付款人姓名]"

#### 1.3 上傳付款憑證（付款人專用）

- **顯示條件**：只有當前登錄用戶是付款人時才顯示
- **功能**：
  - 點擊"選擇圖片"按鈕
  - 選擇收據/發票照片
  - 系統自動預覽圖片
  - 圖片格式支持：JPG, PNG, GIF, WebP

#### 1.4 保存賬單

- 點擊"保存賬單"按鈕
- 系統自動執行：
  - ✅ 保存賬單到數據庫
  - ✅ 將付款人狀態設置為"已付款"
  - ✅ 記錄付款時間 (`paidAt`)
  - ✅ 如果上傳了收據，保存收據圖片 URL
  - ✅ 其他參與者狀態為"待支付"

---

### 階段 2：我的賬單頁面

#### 2.1 付款人視角（應收款）

**顯示內容：**

- 應收款總額：總賬單金額 - 自己的分攤金額
- 應收款筆數：其他參與者的數量

**操作功能：**

1. **查看應收款詳情**：

   - 點擊"查看應收款"按鈕
   - 顯示已支付和待支付的參與者列表
   - 已支付的參與者顯示：
     - 姓名、金額、支付時間
     - 收據圖片（點擊圖標查看）
     - "確認收款"按鈕或"已確認"標記

2. **查看收據**：

   - 點擊圖片圖標查看付款憑證
   - 以模態框形式全屏顯示

3. **確認收款**：
   - 點擊"確認收款"按鈕
   - 系統更新 `confirmedByPayer` 狀態
   - 防止假轉賬截圖或錯誤金額

#### 2.2 非付款人視角（應付款）

**顯示內容：**

- 應付款總額：自己的分攤金額
- 應付款筆數：通常為 1 筆

**操作功能：**

1. **查看賬單詳情**：

   - 查看自己需要支付的金額
   - 查看付款對象（付款人姓名）

2. **上傳付款憑證**：

   - 點擊"標記為已付款"
   - 選擇付款截圖/轉賬憑證
   - 上傳後狀態變為"已付款"
   - 等待付款人確認

3. **查看付款狀態**：
   - 待支付：紅色標記
   - 已付款未確認：黃色標記
   - 已付款已確認：綠色標記

---

## 🗂️ 數據結構

### CalculationResult 擴展

```typescript
export interface CalculationResult {
  participantId: string; // 參與者ID
  amount: number; // 應付金額
  breakdown: string; // 費用明細
  paymentStatus: "pending" | "paid"; // 支付狀態
  receiptImageUrl?: string; // 支付憑證圖片URL
  paidAt?: string; // 支付時間
  confirmedByPayer?: boolean; // 付款人確認收款
}
```

### BillRecord 擴展

```typescript
interface BillRecord extends Bill {
  results: CalculationResult[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  payerReceiptUrl?: string; // 付款人的付款憑證（整個賬單的收據）
}
```

---

## 🔌 API 端點

### 1. 上傳收據圖片

```
POST /api/receipt/upload
Headers: Authorization: Bearer {sessionId}
Body: FormData
  - receipt: File (圖片文件)
  - billId: string
  - type: "payer" | "participant"

Response:
  - receiptUrl: string (圖片URL)
```

### 2. 更新支付狀態

```
POST /api/bill/payment-status
Headers: Authorization: Bearer {sessionId}
Body: FormData
  - billId: string
  - participantId: string
  - paymentStatus: "pending" | "paid"
  - receipt: File (可選)

Response:
  - message: "支付狀態已更新"
```

### 3. 確認收款

```
POST /api/bill/confirm-payment
Headers: Authorization: Bearer {sessionId}
Body: JSON
  - billId: string
  - participantId: string
  - confirmed: boolean

Response:
  - message: "收款確認已更新"
```

---

## 🎯 核心邏輯

### 付款人邏輯

1. **付款人支付全額**：

   - 付款人需要支付整個賬單的金額
   - 保存賬單時自動標記為"已付款"
   - 可以上傳整個賬單的收據

2. **付款人應收款**：

   - 應收款 = 總賬單金額 - 自己的分攤金額
   - 應收款筆數 = 其他參與者數量

3. **付款人確認收款**：
   - 查看其他參與者的付款憑證
   - 確認收款防止假轉賬截圖
   - 確認後標記 `confirmedByPayer = true`

### 參與者邏輯

1. **參與者應付款**：

   - 應付款 = 自己的分攤金額
   - 需要向付款人支付

2. **參與者上傳憑證**：

   - 完成轉賬後上傳付款截圖
   - 狀態變為"已付款"
   - 等待付款人確認

3. **支付狀態追蹤**：
   - `pending`：待支付
   - `paid`：已支付（上傳了憑證）
   - `confirmedByPayer = true`：付款人已確認收款

---

## 📝 已實現功能清單

### 智能計算頁面（calculator.html）

- ✅ 選擇付款人功能
- ✅ 付款人上傳收據 UI
- ✅ 圖片預覽功能
- ✅ 保存賬單時自動上傳收據
- ✅ 付款人自動標記為已付款

### 我的賬單頁面（my-bills.html）

- ✅ 應收款和應付款統計顯示
- ✅ 區分付款人和參與者視角
- ✅ 查看應收款詳情（付款人）
- ✅ 查看收據圖片
- ✅ 確認收款功能
- ✅ 已有上傳付款憑證功能（來自之前的實現）

### 後端 API（server.ts）

- ✅ `/api/receipt/upload` - 上傳收據
- ✅ `/api/bill/save` - 保存賬單（付款人自動標記為已付款）
- ✅ `/api/bill/payment-status` - 更新支付狀態
- ✅ `/api/bill/confirm-payment` - 確認收款

### 數據存儲（storage.ts）

- ✅ `updateBillReceipt()` - 更新賬單收據
- ✅ `updatePaymentStatus()` - 更新支付狀態
- ✅ `confirmPayment()` - 確認收款

---

## 🧪 測試場景

### 測試 1：付款人流程

1. 登錄為 testuser
2. 創建新賬單，選擇 testuser 為付款人
3. 添加其他參與者
4. 計算賬單
5. 上傳付款收據（應該顯示上傳區域）
6. 保存賬單
7. 到"我的賬單"查看，應該看到應收款

### 測試 2：參與者流程

1. 登錄為其他參與者
2. 到"我的賬單"頁面
3. 應該看到應付款
4. 點擊"標記為已付款"
5. 上傳轉賬憑證
6. 等待付款人確認

### 測試 3：付款人確認流程

1. 登錄為付款人
2. 到"我的賬單"頁面
3. 點擊"查看應收款"
4. 查看已支付的參與者
5. 查看收據圖片
6. 點擊"確認收款"

---

## 🎉 完成狀態

所有核心功能已實現完成！🎊

- ✅ 付款人上傳收據功能
- ✅ 保存賬單自動標記付款人已付款
- ✅ 應收款和應付款記錄創建
- ✅ 我的賬單頁面區分應收款和應付款顯示
- ✅ 付款確認 UI
- ✅ 收據圖片查看功能
- ✅ 收據存儲目錄結構

**下一步：測試完整流程並根據反饋進行優化**
