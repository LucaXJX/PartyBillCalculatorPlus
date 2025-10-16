# 貢獻指南

感謝您對 PartyBillCalculator 項目的關注！我們歡迎所有形式的貢獻。

## 🚀 快速開始

### 設置開發環境

1. Fork 本項目到您的 GitHub 賬戶
2. 克隆您的 fork：

   ```bash
   git clone https://github.com/your-username/PartyBillCalculator.git
   cd PartyBillCalculator
   ```

3. 安裝依賴：

   ```bash
   npm install
   ```

4. 啟動開發服務器：
   ```bash
   npm run dev
   ```

## 📝 貢獻類型

### 🐛 Bug 修復

- 在提交修復前，請確保創建一個 issue 描述問題
- 使用描述性的提交信息
- 包含測試用例來驗證修復

### ✨ 新功能

- 在開始開發前，請先創建 issue 討論功能需求
- 確保新功能與現有代碼風格一致
- 添加適當的文檔和測試

### 📚 文檔改進

- 修復拼寫錯誤
- 改進現有文檔的清晰度
- 添加新的使用示例

### 🎨 UI/UX 改進

- 保持與現有設計風格一致
- 確保響應式設計
- 測試不同瀏覽器的兼容性

## 🔧 開發規範

### 代碼風格

- 使用 TypeScript 進行類型安全開發
- 遵循現有的代碼格式
- 使用有意義的變量名和函數名
- 添加適當的註釋

### 提交規範

使用以下格式的提交信息：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

類型包括：

- `feat`: 新功能
- `fix`: Bug 修復
- `docs`: 文檔更新
- `style`: 代碼格式調整
- `refactor`: 代碼重構
- `test`: 測試相關
- `chore`: 構建過程或輔助工具的變動

### 分支命名

- `feature/功能名稱` - 新功能
- `bugfix/問題描述` - Bug 修復
- `docs/文檔更新` - 文檔改進
- `hotfix/緊急修復` - 緊急修復

## 🧪 測試

### 運行測試

```bash
# 類型檢查
npm run type-check

# 代碼格式化
npm run format

# 代碼檢查
npm run lint
```

### 測試新功能

1. 在本地環境測試所有相關功能
2. 確保沒有破壞現有功能
3. 測試不同的用戶場景

## 📋 Pull Request 流程

1. **創建分支**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **提交更改**

   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. **推送分支**

   ```bash
   git push origin feature/your-feature-name
   ```

4. **創建 Pull Request**
   - 使用清晰的標題和描述
   - 引用相關的 issue
   - 添加截圖（如果是 UI 更改）

### PR 模板

```markdown
## 描述

簡要描述此 PR 的內容

## 類型

- [ ] Bug 修復
- [ ] 新功能
- [ ] 文檔更新
- [ ] 代碼重構
- [ ] 其他

## 測試

- [ ] 本地測試通過
- [ ] 沒有破壞現有功能
- [ ] 添加了新的測試用例

## 截圖（如適用）

添加相關截圖

## 相關 Issue

Closes #issue_number
```

## 🏗 項目結構

了解項目結構有助於更好地貢獻：

```
PartyBillCalculator/
├── public/          # 前端文件
├── server/          # 後端代碼
├── docs/           # 文檔
├── data/           # 數據文件
├── database/       # 數據庫架構
├── tests/          # 測試文件
├── scripts/        # 工具腳本
└── .github/        # GitHub 配置
```

## 🐛 報告問題

### Bug 報告模板

```markdown
**描述**
簡潔明瞭地描述問題

**重現步驟**

1. 進入 '...'
2. 點擊 '...'
3. 滾動到 '...'
4. 看到錯誤

**預期行為**
描述您期望發生的事情

**實際行為**
描述實際發生的事情

**環境信息**

- OS: [e.g. Windows 10]
- 瀏覽器: [e.g. Chrome 91]
- Node.js 版本: [e.g. 18.0.0]

**附加信息**
添加任何其他相關信息
```

## 💡 功能請求

### 功能請求模板

```markdown
**功能描述**
簡潔明瞭地描述您想要的功能

**使用場景**
描述這個功能將如何被使用

**替代方案**
描述您考慮過的其他解決方案

**附加信息**
添加任何其他相關信息或截圖
```

## 📞 獲取幫助

如果您在貢獻過程中遇到問題：

1. 查看現有的 [Issues](https://github.com/LucaXJX/PartyBillCalculator/issues)
2. 查看 [文檔](docs/)
3. 創建新的 issue 尋求幫助

## 🎉 感謝

感謝您對 PartyBillCalculator 項目的貢獻！您的努力讓這個項目變得更好。

---

**注意**: 通過提交 Pull Request，您同意將您的貢獻在 MIT 許可證下發布。
