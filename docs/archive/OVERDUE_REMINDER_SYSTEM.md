# 逾期賬單提醒系統

## 📋 概述

逾期賬單提醒系統會自動檢測超過 7 天未支付的賬單，並在每天晚上 8 點（香港時間）向相關用戶發送提醒消息。

---

## ✨ 功能特點

### 1. **自動定時檢查**

- ⏰ 每天晚上 8:00 自動執行
- 🔍 檢查所有建立超過 7 天的賬單
- 📊 只針對 `pending` 狀態的參與者

### 2. **智能提醒邏輯**

- ✅ 只提醒非付款人的參與者
- 🚫 避免重複提醒（每天最多一次）
- 📅 計算逾期天數並在消息中顯示

### 3. **一鍵跳轉**

- 🔗 消息中包含「前往支付」按鈕
- 🎯 點擊後直接跳轉到我的賬單頁面
- ✨ 自動高亮顯示對應的賬單（3 秒後消失）

---

## 🏗️ 系統架構

### **文件結構**

```
server/
├── overdueReminderService.ts  # 逾期提醒服務（核心邏輯）
└── server.ts                   # 服務器啟動文件（集成服務）

public/
├── messages.html               # 消息頁面（顯示提醒）
└── my-bills.html              # 我的賬單頁面（高亮功能）

public/js/
└── page-setup.js              # 未讀消息輪詢（10秒間隔）
```

---

## 🔧 技術實現

### **1. 後端服務 (`overdueReminderService.ts`)**

#### **核心方法**

##### `start()`

啟動定時提醒服務，自動安排每天晚上 8 點執行。

```typescript
overdueReminderService.start();
// ✅ 逾期提醒服務已啟動
// 📅 下次逾期檢查時間: 2025/10/17 下午8:00:00
```

##### `checkAndSendReminders()`

檢查所有賬單，生成並發送逾期提醒。

**檢查條件**:

1. 賬單建立日期 ≥ 7 天
2. 賬單狀態 ≠ `completed` 或 `cancelled`
3. 參與者支付狀態 = `pending`
4. 參與者 ≠ 付款人
5. 今天尚未發送過提醒

**生成消息**:

```json
{
  "id": "msg_1729123456789_abc123",
  "recipientId": "user123",
  "billId": "bill456",
  "type": "overdue_reminder",
  "title": "⏰ 逾期未支付提醒",
  "content": "您在賬單「週末聚會」中的分攤金額 $150.00 已逾期 10 天未支付。請盡快完成支付，避免影響其他參與者。",
  "actionText": "前往支付",
  "actionUrl": "/my-bills.html?billId=bill456&highlight=true",
  "isRead": false,
  "createdAt": "2025-10-16T12:00:00.000Z"
}
```

**注意**: 使用 `recipientId` 而非 `userId`，以便與 `messageManager.getUserMessages()` 兼容。

##### `triggerCheck()`

手動觸發檢查（用於測試）。

```typescript
// 測試用途
await overdueReminderService.triggerCheck();
```

---

### **2. 消息顯示 (`messages.html`)**

#### **消息類型定義**

```javascript
overdue_reminder: {
  icon: "fa fa-exclamation-triangle",
  iconColor: "text-orange-600",
  bgColor: "bg-orange-100",
}
```

#### **跳轉按鈕**

```html
<button
  onclick="navigateToAction('/my-bills.html?billId=xxx&highlight=true')"
  class="btn-primary text-sm"
>
  <i class="fa fa-arrow-right mr-1"></i>前往支付
</button>
```

```javascript
window.navigateToAction = function (url) {
  console.log("跳轉到:", url);
  if (url) {
    window.location.href = url;
  }
};
```

**注意**: 使用 `window.navigateToAction` 確保函數在全局作用域中可用。

---

### **3. 賬單高亮 (`my-bills.html`)**

#### **URL 參數解析**

```javascript
const urlParams = new URLSearchParams(window.location.search);
const highlightBillId = urlParams.get("billId"); // 賬單 ID
const shouldHighlight = urlParams.get("highlight"); // 是否高亮
```

#### **高亮函數**

```javascript
function highlightBill(billId) {
  const billElement = document.querySelector(`[data-bill-id="${billId}"]`);

  if (billElement) {
    // 1. 滾動到賬單（平滑動畫）
    billElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // 2. 添加高亮效果（淡黃色背景 + 橙色邊框）
    billElement.style.backgroundColor = "#fef3c7";
    billElement.style.border = "3px solid #f59e0b";
    billElement.style.transition = "all 0.3s ease";

    // 3. 3秒後移除高亮
    setTimeout(() => {
      billElement.style.backgroundColor = "";
      billElement.style.border = "";
    }, 3000);

    // 4. 清除 URL 參數
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}
```

---

### **4. 未讀消息輪詢 (`page-setup.js`)**

#### **輪詢頻率優化**

```javascript
// 從 30 秒 → 10 秒（提升實時性）
this.startUnreadCountPolling(10000);
```

#### **徽章更新**

```javascript
async loadUnreadMessageCount() {
  const response = await fetch("/api/messages/unread-count", {
    headers: { Authorization: `Bearer ${sessionId}` },
  });

  if (response.ok) {
    const data = await response.json();
    this.componentManager.updateUnreadCount(data.count);
  }
}
```

---

## 📊 消息示例

### **逾期提醒消息**

```
┌──────────────────────────────────────────────┐
│ ⚠️  ⏰ 逾期未支付提醒             [未讀]    │
│                                              │
│ 您在賬單「週末聚會」中的分攤金額 $150.00    │
│ 已逾期 10 天未支付。請盡快完成支付，避免     │
│ 影響其他參與者。                              │
│                                              │
│ 🕒 2 小時前  📄 週末聚會                    │
│                                              │
│ [➡️ 前往支付]                                │
└──────────────────────────────────────────────┘
```

---

## 🧪 測試方法

### **1. 手動觸發檢查**

在服務器控制台執行：

```typescript
import { overdueReminderService } from "./overdueReminderService.js";

// 手動觸發一次檢查
await overdueReminderService.triggerCheck();
```

### **2. 使用測試頁面**

訪問測試頁面進行完整測試：

```
http://localhost:3000/test-overdue-reminder.html
```

**測試步驟**:

1. 點擊「觸發逾期檢查」
2. 點擊「查看生成的消息」
3. 登入測試用戶（alice_wong 或 bob_lee）
4. 前往「我的消息」查看提醒
5. 點擊「前往支付」測試跳轉和高亮功能

### **3. 手動創建測試數據**

修改 `data/bills.json`，創建一個 8 天前的賬單：

```javascript
{
  "id": "test_bill_001",
  "name": "測試逾期賬單",
  "createdAt": "2025-10-08T12:00:00.000Z",  // 8 天前
  "status": "active",
  "payerId": "p001",
  "participants": [
    { "id": "p001", "userId": "user001", "name": "付款人" },
    { "id": "p002", "userId": "user002", "name": "參與者A" }  // 必須有 userId
  ],
  "results": [
    { "participantId": "p001", "amount": 200, "paymentStatus": "completed" },
    { "participantId": "p002", "amount": 100, "paymentStatus": "pending" }  // 逾期
  ]
}
```

**重要**:

- ✅ `participants` 必須包含 `userId` 字段
- ✅ `createdAt` 設置為 8 天前的日期
- ✅ `paymentStatus` 為 `pending`

### **4. 驗證流程**

1. ✅ 服務器啟動時顯示「逾期提醒服務: 已啟動」
2. ✅ 手動觸發後，`messages.json` 中新增消息（使用 `recipientId`）
3. ✅ 用戶登錄後，Header 未讀徽章顯示數字
4. ✅ 點擊「我的消息」，看到逾期提醒
5. ✅ 點擊「前往支付」，跳轉到我的賬單頁面
6. ✅ 對應賬單高亮顯示（淡黃色背景 + 橙色邊框，3 秒後消失）

### **5. 測試用戶**

- **alice_wong**: alice.wong@email.com / password123
- **bob_lee**: bob.lee@email.com / password123

---

## ⚙️ 配置選項

### **修改檢查時間**

編輯 `server/overdueReminderService.ts`:

```typescript
// 修改為每天早上 9 點
target.setHours(9, 0, 0, 0);
```

### **修改逾期天數閾值**

```typescript
// 從 7 天改為 3 天
if (daysSinceCreation >= 3) {
  // ...
}
```

### **修改輪詢間隔**

編輯 `public/js/page-setup.js`:

```javascript
// 從 10 秒改為 5 秒
this.startUnreadCountPolling(5000);
```

---

## 🐛 故障排除

### **問題 1: 消息沒有發送**

**檢查**:

1. 服務器是否正常啟動？
2. `overdueReminderService.start()` 是否被調用？
3. 控制台是否有錯誤信息？

**解決**:

```bash
# 查看服務器日誌
✅ 逾期提醒服務已啟動
📅 下次逾期檢查時間: ...
```

### **問題 2: 消息重複發送**

**原因**: `isToday()` 檢查邏輯錯誤

**解決**: 確保時區設置正確（香港時間 UTC+8）

### **問題 3: 高亮不生效**

**檢查**:

1. `data-bill-id` 屬性是否正確添加？
2. URL 參數是否正確傳遞？
3. 賬單是否在當前篩選視圖中？

**調試**:

```javascript
// 控制台測試
highlightBill("test_bill_001");
```

---

## 📈 未來優化

- [ ] **多時區支持**: 根據用戶所在時區發送提醒
- [ ] **自定義提醒時間**: 允許用戶設置提醒時間
- [ ] **提醒頻率控制**: 3 天、7 天、14 天等級別的提醒
- [ ] **推送通知**: 集成瀏覽器推送 API
- [ ] **郵件提醒**: 發送郵件通知
- [ ] **SMS 提醒**: 發送短信通知

---

## 📝 更新記錄

### v2.2.0 (2025-10-16)

- ✅ 實現逾期賬單自動檢測（≥7 天）
- ✅ 每天晚上 8 點定時提醒
- ✅ 消息跳轉與賬單高亮功能
- ✅ 未讀消息輪詢從 30 秒優化到 10 秒
- ✅ 手動觸發 API 端點 (`/api/admin/trigger-overdue-check`)
- ✅ 完整的測試頁面 (`/test-overdue-reminder.html`)
- ✅ 優化高亮效果（淡黃色背景 + 橙色邊框）
- ✅ 修復消息字段兼容性（使用 `recipientId`）

---

## 🔗 相關文檔

- [消息系統文檔](MESSAGE_SYSTEM.md)
- [我的賬單頁面文檔](MY_BILLS_PAGE.md)
- [更新檢查清單](UPDATE_CHECKLIST.md)
