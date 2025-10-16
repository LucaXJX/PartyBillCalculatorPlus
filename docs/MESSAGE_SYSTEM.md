# 消息系統說明文檔

## 📋 概述

消息系統用於通知用戶賬單相關的重要事件，包括新建賬單、付款提交、收款確認等。

---

## 🎯 功能特性

### 消息類型

1. **新建賬單** (`new_bill`)

   - 當有人創建包含你的賬單時
   - 通知對象：除創建者外的所有參與者

2. **付款提交** (`payment_submitted`)

   - 當參與者提交付款憑證時
   - 通知對象：收款人（付款人）
   - 可操作：確認收款、拒絕收款

3. **收款確認** (`payment_confirmed`)

   - 當收款人確認收到款項時
   - 通知對象：付款人

4. **收款拒絕** (`payment_rejected`)

   - 當收款人拒絕收款時
   - 通知對象：付款人
   - 包含拒絕原因

5. **逾期提醒** (`overdue_reminder`)
   - 賬單超過 15 天未支付時
   - 通知對象：未支付的參與者
   - 每天提醒一次

---

## 🚀 使用說明

### 訪問消息頁面

1. 登入系統
2. 點擊頂部導航欄的「我的消息」
3. 如有未讀消息，會顯示紅色數字徽章

### 查看消息

- **未讀消息**：藍色背景高亮
- **已讀消息**：白色背景
- 每條消息顯示：
  - 消息類型圖標
  - 標題和內容
  - 相關賬單名稱
  - 發送時間
  - 付款憑證（如有）

### 標記已讀

- **單條消息**：點擊消息卡片或點擊「✓」圖標
- **全部已讀**：點擊右上角「全部已讀」按鈕

### 處理付款通知

當收到付款提交通知時：

1. 點擊「查看憑證」檢查付款截圖
2. 選擇操作：
   - **確認收款**：確認已收到款項
   - **拒絕收款**：選擇原因
     - 未收到款項
     - 錯誤單據

### 刪除消息

點擊消息右上角的垃圾桶圖標

---

## 🔧 技術實現

### 後端 API

#### 獲取所有消息

```
GET /api/messages
Authorization: Bearer {sessionId}
```

響應：

```json
{
  "messages": [
    {
      "id": "msg001",
      "type": "new_bill",
      "recipientId": "user123",
      "billId": "bill001",
      "billName": "團隊午餐",
      "title": "📋 新賬單：團隊午餐",
      "content": "testuser 創建了一筆新賬單...",
      "isRead": false,
      "createdAt": "2025-10-15T12:00:00.000Z"
    }
  ]
}
```

#### 獲取未讀數量

```
GET /api/messages/unread-count
Authorization: Bearer {sessionId}
```

響應：

```json
{
  "count": 5
}
```

#### 標記已讀

```
POST /api/messages/mark-read
Content-Type: application/json

{
  "messageId": "msg001"
}
```

#### 全部已讀

```
POST /api/messages/mark-all-read
```

#### 確認收款（從消息）

```
POST /api/messages/confirm-payment
Content-Type: application/json

{
  "messageId": "msg001",
  "billId": "bill001",
  "participantId": "p001"
}
```

#### 拒絕收款（從消息）

```
POST /api/messages/reject-payment
Content-Type: application/json

{
  "messageId": "msg001",
  "billId": "bill001",
  "participantId": "p001",
  "reason": "not_received" // or "wrong_receipt"
}
```

#### 刪除消息

```
DELETE /api/messages/{messageId}
```

---

## 📊 數據結構

### Message 接口

```typescript
interface Message {
  id: string;
  type: MessageType;
  recipientId: string; // 接收者用戶 ID
  senderId?: string; // 發送者用戶 ID（系統消息為空）
  billId: string;
  billName: string;
  title: string; // 消息標題
  content: string; // 消息內容
  imageUrl?: string; // 相關圖片（收據等）
  metadata?: {
    participantId?: string;
    amount?: number;
    daysOverdue?: number;
  };
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  actionable?: boolean; // 是否可以執行操作
  actionType?: "confirm_payment" | "reject_payment";
  actionCompleted?: boolean; // 操作是否已完成
}
```

---

## 🎨 UI 組件

### 統計卡片

顯示四個統計數據：

- 全部消息
- 未讀消息
- 支付通知
- 待處理

### 消息列表

- 時間線式展示
- 未讀消息高亮
- 消息類型圖標和顏色區分
- 相對時間顯示（剛剛、X 分鐘前、X 小時前、X 天前）

### 紅點提示

- 顯示在頂部導航欄「我的消息」鏈接
- 實時更新未讀數量
- 超過 99 顯示"99+"

---

## 🧪 測試步驟

### 測試場景 1：新建賬單通知

1. 登入 **testuser** (`test@example.com` / `123456`)
2. 創建一筆新賬單，添加 alice_wong 和 bob_lee 為參與者
3. 提交賬單
4. 登出並登入 **alice_wong** (`alice@example.com` / `123456`)
5. 查看「我的消息」，應該看到新賬單通知和紅點

### 測試場景 2：付款提交通知

1. 以 **alice_wong** 身份
2. 進入「我的賬單」，找到待支付的賬單
3. 點擊「標記已支付」，上傳收據
4. 登出並登入 **testuser**
5. 查看「我的消息」，應該看到付款提交通知

### 測試場景 3：確認收款

1. 以 **testuser** 身份
2. 在「我的消息」中找到付款提交通知
3. 點擊「查看憑證」檢查收據
4. 點擊「確認收款」
5. 登出並登入 **alice_wong**
6. 查看「我的消息」，應該看到收款確認通知

### 測試場景 4：拒絕收款

1. 以 **testuser** 身份
2. 在「我的消息」中找到付款提交通知
3. 點擊「拒絕收款」
4. 選擇原因：「未收到款項」或「錯誤單據」
5. 確認
6. 登出並登入該參與者
7. 查看「我的消息」，應該看到拒絕通知

---

## ⚠️ 已知限制

1. **逾期提醒**：需要配置定時任務，目前僅有接口未實現
2. **實時推送**：目前需要刷新頁面才能看到新消息
3. **消息分類**：暫無按類型篩選功能
4. **消息搜索**：暫無搜索功能

---

## 🔮 未來改進

1. **WebSocket 實時通知**：新消息即時推送
2. **桌面通知**：使用 Notification API
3. **聲音提醒**：可選的提示音
4. **消息分類**：按類型篩選
5. **消息搜索**：搜索特定賬單或內容
6. **定時任務**：實現逾期提醒功能
7. **郵件通知**：重要消息發送郵件

---

## 📝 相關文件

- 後端：

  - `server/types.ts` - 類型定義
  - `server/messageManager.ts` - 消息管理
  - `server/messageHelper.ts` - 消息助手
  - `server/server.ts` - API 路由

- 前端：

  - `public/messages.html` - 消息頁面
  - `public/js/components.js` - Header 紅點
  - `public/js/page-setup.js` - 自動加載未讀數量

- 數據：
  - `data/messages.json` - 消息存儲
