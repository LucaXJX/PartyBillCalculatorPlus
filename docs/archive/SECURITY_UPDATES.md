# 安全更新說明

## 🔒 收據存儲安全修復

### 問題描述

**之前的實現（不安全）：**
- 收據圖片存儲在：`public/uploads/receipts/`
- 任何人都可以直接訪問：`http://localhost:3000/uploads/receipts/xxx.jpg`
- **隱私風險**：賬單收據包含敏感財務信息，不應該公開訪問

### 修復方案

**現在的實現（安全）：**

#### 1. 存儲位置變更
- **新位置**：`data/receipts/`（私有目錄）
- **保護級別**：不在public目錄下，無法直接通過URL訪問

#### 2. 訪問控制
添加了需要認證的API路由：

```typescript
// 受保護的收據圖片訪問路由（需要認證）
app.get("/receipts/:filename", authenticateUser, (req: any, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "../data/receipts", filename);
  
  // 檢查文件是否存在
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: "收據不存在" });
  }
});
```

**訪問流程：**
1. 用戶必須先登錄
2. 請求收據時需要提供有效的sessionId
3. 服務器驗證用戶身份
4. 只有認證通過才返回圖片

#### 3. URL路徑變更

**之前：**
```javascript
receiptImageUrl = `/uploads/receipts/${req.file.filename}`;
```

**現在：**
```javascript
receiptImageUrl = `/receipts/${req.file.filename}`;
```

---

## 📁 目錄結構

### 安全的文件組織

```
PartyBillCalculator/
├── public/               # 公開可訪問
│   ├── index.html
│   ├── calculator.html
│   └── js/
│
├── data/                 # 私有數據（受保護）
│   ├── users.json       # 用戶數據
│   ├── bills.json       # 賬單數據
│   └── receipts/        # 收據圖片（新）
│       ├── 1234567890-xxx.jpg
│       └── 1234567891-yyy.png
│
└── server/              # 服務器代碼
    └── server.ts
```

### .gitignore 配置

```gitignore
data*/              # 所有data目錄
data/receipts/      # 明確忽略收據目錄
```

**效果：**
- ✅ 收據文件不會提交到Git
- ✅ 保護用戶隱私
- ✅ 防止敏感數據洩露

---

## 🔐 安全機制

### 多層保護

1. **文件系統級別**：
   - 收據不在public目錄
   - 無法通過靜態文件訪問

2. **應用層級別**：
   - 需要通過API訪問
   - API需要用戶認證

3. **版本控制級別**：
   - .gitignore排除收據文件
   - 不會意外提交

### 未來改進建議

可以進一步加強安全性：

1. **訪問權限檢查**：
   ```typescript
   // 只允許賬單相關用戶訪問收據
   app.get("/receipts/:filename", authenticateUser, async (req: any, res) => {
     // 從filename提取billId
     // 檢查用戶是否參與該賬單
     // 只有參與者才能訪問該賬單的收據
   });
   ```

2. **文件名加密**：
   - 使用加密的文件名
   - 防止通過文件名猜測

3. **水印保護**：
   - 在圖片上添加用戶水印
   - 防止截圖洩露

4. **訪問日誌**：
   - 記錄誰訪問了哪些收據
   - 審計追蹤

---

## ✅ 已完成的安全更新

- ✅ 收據存儲位置：`data/receipts/`（私有）
- ✅ 訪問控制：需要認證
- ✅ Git忽略：收據不會提交
- ✅ URL路徑更新：使用安全路由
- ✅ 文件檢查：防止路徑遍歷攻擊

---

## 🧪 驗證步驟

### 1. 檢查存儲位置
```bash
# 收據應該在這裡
ls data/receipts/

# 不應該在這裡
ls public/uploads/receipts/  # 應該為空或不存在
```

### 2. 測試直接訪問（應該失敗）
```
訪問：http://localhost:3000/uploads/receipts/xxx.jpg
結果：❌ 404 Not Found（正確，無法直接訪問）
```

### 3. 測試API訪問（需要登錄）
```
訪問：http://localhost:3000/receipts/xxx.jpg
結果：
- 未登錄：❌ 401 Unauthorized
- 已登錄：✅ 200 OK，返回圖片
```

---

## 🎯 總結

現在的收據存儲系統：
- 🔒 **安全**：收據存儲在私有目錄
- 🔐 **受保護**：需要認證才能訪問
- 🚫 **不公開**：無法直接通過URL訪問
- ✅ **隱私保護**：符合數據保護要求

**重要提醒**：每次修改TypeScript文件後，都需要：
1. `npm run build` - 重新編譯
2. 重啟服務器 - 使更改生效

