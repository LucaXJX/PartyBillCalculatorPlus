# 開發工具腳本

本目錄包含用於開發和維護的實用腳本。

> **注意**：測試腳本已移動到 `tests/` 目錄，請查看 `tests/` 目錄獲取測試相關腳本。

## 📋 可用腳本

### 1. `generate-receipt-images.js`

**用途**：生成模擬收據圖片並自動綁定到測試賬單數據

**功能**：

- 為測試賬單生成 SVG 格式的收據圖片
- 自動更新 `bills.json` 中的收據 URL
- 支持付款人總賬單收據和參與者付款憑證

**使用方法**：

```bash
node scripts/generate-receipt-images.js
```

**生成位置**：

- 收據圖片：`data/receipts/`
- 更新數據：`data/bills.json`

**生成內容**：

- 付款人總賬單：`payer_[billId].svg`
- 參與者收據：`receipt_[billId]_[participantId].svg`

**示例輸出**：

```
✅ 成功生成 15 張收據圖片
✅ 成功更新 bills.json 中的收據 URL
```

---

### 2. `fix-missing-payerid.js`

**用途**：自動修復缺少 `payerId` 字段的賬單

**功能**：

- 掃描所有賬單檢查 `payerId` 字段
- 自動備份原始數據
- 為缺少 `payerId` 的賬單自動添加（使用第一個參與者）
- 生成詳細的修復報告

**使用方法**：

```bash
node scripts/fix-missing-payerid.js
```

**修復規則**：

- 如果賬單有參與者，將第一個參與者設為付款人
- 如果沒有參與者，標記為無法修復
- 自動創建備份文件：`data/bills.backup.json`

**示例輸出**：

```
✅ 已備份原始數據
⚠️ 發現問題: 賬單 "下午茶" 缺少 payerId
✅ 已修復: payerId = xxx (testuser)
📊 修復完成！已修復 6 筆賬單
```

**安全提示**：

- ⚠️ 會直接修改 `data/bills.json`
- ✅ 自動創建備份文件
- 💡 修復後建議重啟服務器

---

### 3. `add-test-data.js`

**用途**：批量添加測試賬單數據到 `bills.json`

**功能**：

- 從 `test-bills-data.json` 讀取測試數據
- 檢查是否已存在測試數據（避免重複添加）
- 合併測試數據到現有賬單列表

**使用方法**：

```bash
node scripts/add-test-data.js
```

**數據來源**：

- 測試數據：`data/test-bills-data.json`
- 目標文件：`data/bills.json`

**安全機制**：

- 自動檢測重複數據
- 保留原有賬單數據
- 測試數據放在列表前面（方便查看）

**示例輸出**：

```
✅ 成功添加測試數據！
   - 原有賬單: 3 個
   - 測試賬單: 6 個
   - 總計: 9 個

📋 測試賬單列表:
   1. 團隊午餐 - 2025-10-10 - 港式茶餐廳
      付款人: testuser
      參與者: testuser, alice_wong, bob_lee
```

---

### 4. `migrate-passwords.js`

**用途**：將現有用戶密碼遷移到 bcrypt 加密

**功能**：

- 讀取現有用戶數據
- 使用 bcrypt 加密所有明文密碼
- 自動創建備份文件
- 驗證遷移結果

**使用方法**：

```bash
node scripts/migrate-passwords.js
```

**安全特性**：

- 使用 bcrypt 12 輪鹽值加密
- 自動創建時間戳備份文件
- 遷移後驗證密碼正確性

**示例輸出**：

```
✅ alice_wong: 密碼已加密
✅ bob_lee: 密碼已加密
💾 已創建備份文件: users.json.backup.1761492187733
✅ 密碼驗證成功！遷移完成
```

---

### 5. `unify-test-users.js`

**用途**：統一測試用戶的密碼和郵箱後綴

**功能**：

- 統一所有測試用戶密碼為 `Test123!`
- 統一所有測試用戶郵箱後綴為 `@test.com`
- 自動更新 `TEST_USERS.md` 文檔

**使用方法**：

```bash
node scripts/unify-test-users.js
```

**統一配置**：

- 統一密碼：`Test123!`
- 統一郵箱後綴：`@test.com`
- 便於測試和演示

---

## 🔧 開發建議

### 創建新賬單測試數據

1. **編輯測試數據**：

   ```bash
   # 編輯 data/test-bills-data.json
   ```

2. **添加測試數據**：

   ```bash
   node scripts/add-test-data.js
   ```

3. **生成收據圖片**：
   ```bash
   node scripts/generate-receipt-images.js
   ```

### 重置測試環境

如需完全重置測試數據：

1. **備份原始數據**（如有需要）
2. **手動編輯** `data/bills.json` 移除測試賬單
3. **重新運行腳本**添加測試數據

---

## 📝 注意事項

### 數據安全

- ⚠️ 這些腳本會 **直接修改** `data/bills.json`
- 建議在修改前備份重要數據
- 測試數據的 `id` 均以 `test_bill_` 開頭

### Git 管理

- ✅ **應該提交**：腳本文件本身（`.js` 和 `README.md`）
- ❌ **不應提交**：生成的收據圖片（`data/receipts/` 已在 `.gitignore`）
- ❌ **不應提交**：測試數據文件（`data/` 已在 `.gitignore`）

### 運行環境

- 需要 Node.js ES Module 支持
- 確保 `package.json` 中有 `"type": "module"`
- 需要文件系統讀寫權限

---

## 🤝 貢獻

如果你開發了新的開發工具腳本：

1. 添加到本目錄
2. 更新本 README
3. 確保腳本有適當的錯誤處理
4. 添加使用示例和說明

---

## 📚 相關文檔

- [項目 README](../README.md)
- [貢獻指南](../CONTRIBUTING.md)
- [API 文檔](../docs/MY_BILLS_PAGE.md)
