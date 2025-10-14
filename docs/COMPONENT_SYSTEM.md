# 組件系統使用指南

## 概述

本項目實現了一個統一的組件系統，用於管理所有頁面的 header、footer 和其他共享 UI 組件。這確保了整個應用程序的一致性，並簡化了維護工作。

## 文件結構

```
public/js/
├── auth.js          # 認證管理器
├── components.js    # 組件管理器
└── page-setup.js    # 頁面設置工具
```

## 核心組件

### 1. ComponentManager (`components.js`)

負責生成和管理所有共享組件。

#### 主要功能：

- 生成統一的 Header HTML
- 生成統一的 Footer HTML
- 動態渲染組件到指定元素
- 自動設置認證相關功能

#### 使用示例：

```javascript
// 初始化組件管理器
window.componentManager.init(window.authManager);

// 渲染 Header
window.componentManager.render("header", "body", {
  currentPage: "calculator",
  showCalculator: true,
  showMyBills: true,
});

// 渲染 Footer
window.componentManager.render("footer", "body");
```

### 2. PageSetup (`page-setup.js`)

提供統一的頁面初始化流程。

#### 主要功能：

- 自動檢查認證狀態
- 統一渲染頁面組件
- 設置頁面特定功能
- 等待依賴項加載

#### 使用示例：

```javascript
// 頁面初始化
document.addEventListener("DOMContentLoaded", async () => {
  const pageInitialized = await window.pageSetup.init({
    currentPage: "calculator",
    requireAuth: true,
    showHeader: true,
    showFooter: true,
  });

  if (!pageInitialized) {
    return; // 認證失敗，頁面會重定向
  }

  // 設置頁面特定功能
  window.pageSetup.setupPageFeatures({
    updateUserDisplay: true,
    setupLogout: true,
    setupAuthCheck: true,
  });
});
```

## 頁面模板

### 基本頁面結構

```html
<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <!-- 必要的 CSS 和 meta 標籤 -->
  </head>
  <body class="font-sans text-dark bg-gray-50 min-h-screen">
    <!-- Header 將由 JavaScript 動態插入 -->

    <!-- 主要內容 -->
    <main class="pt-24 pb-20">
      <!-- 頁面特定內容 -->
    </main>

    <!-- Footer 將由 JavaScript 動態插入 -->

    <!-- 引入必要的腳本 -->
    <script src="/js/auth.js"></script>
    <script src="/js/components.js"></script>
    <script src="/js/page-setup.js"></script>

    <script type="module">
      // 頁面初始化邏輯
    </script>
  </body>
</html>
```

## 配置選項

### Header 配置

```javascript
{
  currentPage: 'calculator',     // 當前頁面標識
  showCalculator: true,          // 是否顯示智能計算鏈接
  showMyBills: true,            // 是否顯示我的賬單鏈接
  showContact: true             // 是否顯示聯絡我們鏈接
}
```

### 頁面初始化配置

```javascript
{
  currentPage: 'calculator',     // 當前頁面標識
  requireAuth: true,            // 是否需要認證
  showHeader: true,             // 是否顯示 Header
  showFooter: true,             // 是否顯示 Footer
  headerOptions: {},            // Header 特定選項
  footerOptions: {}             // Footer 特定選項
}
```

### 頁面功能配置

```javascript
{
  updateUserDisplay: true,      // 是否更新用戶顯示
  setupLogout: true,           // 是否設置登出功能
  setupAuthCheck: true         // 是否設置認證檢查
}
```

## 頁面標識

系統使用以下頁面標識來高亮當前頁面的導航鏈接：

- `calculator` - 智能計算頁面
- `my-bills` - 我的賬單頁面
- `inbox` - 收件箱頁面（未來）
- `profile` - 個人資料頁面（未來）

## 安全特性

### 1. 認證檢查

- 自動檢查用戶認證狀態
- 未認證用戶自動重定向到登錄頁面
- 支持頁面級別的認證要求

### 2. 組件隔離

- 組件之間相互獨立
- 避免全局變量污染
- 使用命名空間管理

### 3. 錯誤處理

- 優雅的錯誤處理機制
- 詳細的錯誤日誌
- 用戶友好的錯誤提示

## 遷移指南

### 從舊頁面遷移

1. **移除靜態 Header/Footer**

   ```html
   <!-- 移除這些靜態內容 -->
   <header>...</header>
   <footer>...</footer>
   ```

2. **添加組件腳本**

   ```html
   <script src="/js/auth.js"></script>
   <script src="/js/components.js"></script>
   <script src="/js/page-setup.js"></script>
   ```

3. **更新頁面初始化**
   ```javascript
   // 替換原有的初始化邏輯
   document.addEventListener("DOMContentLoaded", async () => {
     const pageInitialized = await window.pageSetup.init({
       currentPage: "your-page",
       requireAuth: true,
     });

     if (pageInitialized) {
       // 頁面特定邏輯
     }
   });
   ```

## 最佳實踐

### 1. 頁面命名

- 使用一致的頁面標識
- 避免使用特殊字符
- 保持簡潔明瞭

### 2. 組件配置

- 只配置必要的選項
- 保持配置的一致性
- 文檔化自定義配置

### 3. 錯誤處理

- 總是檢查初始化結果
- 提供適當的錯誤反饋
- 記錄重要的錯誤信息

### 4. 性能優化

- 避免重複渲染組件
- 使用事件委託
- 最小化 DOM 操作

## 故障排除

### 常見問題

1. **組件未正確渲染**

   - 檢查腳本加載順序
   - 確認目標元素存在
   - 查看控制台錯誤信息

2. **認證檢查失敗**

   - 確認 auth.js 已加載
   - 檢查認證狀態
   - 驗證 API 端點

3. **樣式問題**
   - 確認 CSS 文件已加載
   - 檢查 Tailwind 配置
   - 驗證自定義樣式

### 調試技巧

1. **啟用詳細日誌**

   ```javascript
   // 在控制台中啟用調試模式
   window.componentManager.debug = true;
   ```

2. **檢查組件狀態**

   ```javascript
   // 查看已加載的組件
   console.log(window.componentManager.components);
   ```

3. **驗證認證狀態**
   ```javascript
   // 檢查當前認證狀態
   console.log(window.authManager.isAuthenticated());
   ```

## 未來擴展

### 計劃中的功能

1. **動態組件加載**

   - 按需加載組件
   - 減少初始加載時間
   - 支持組件版本管理

2. **主題系統**

   - 支持多種主題
   - 動態主題切換
   - 用戶偏好保存

3. **國際化支持**

   - 多語言組件
   - 動態語言切換
   - 本地化配置

4. **組件庫擴展**
   - 更多共享組件
   - 可重用 UI 元素
   - 組件文檔生成
