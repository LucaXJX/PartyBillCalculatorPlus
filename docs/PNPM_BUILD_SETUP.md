# pnpm 構建腳本配置指南

## 問題說明

pnpm 默認不會構建依賴包，除非明確加入白名單。對於使用 C/C++ 開發的 native 模塊（如 `better-sqlite3`、`sharp`、`bcrypt`），必須構建才能生成 `.node` 文件，否則會導致運行時錯誤。

## 老師的建議

> "Pnpm do not build the dependency by default, unless whitelisted explicitly. If sqlite is not built, the .node file will be absent. This step is needed for packages that are developed with c. Sqlite is developed with c, not plain javascript."

**理解**：

- pnpm 默認不構建依賴，需要明確配置
- 用 C/C++ 開發的包必須構建才能生成 `.node` 文件
- 如果沒有構建，運行時會找不到模塊

## 解決方案

### 方法 1：在 package.json 中配置白名單（推薦）

在 `package.json` 中添加 `pnpm.onlyBuiltDependencies` 配置：

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["better-sqlite3", "sharp", "bcrypt"]
  }
}
```

**需要構建的依賴**：

- `better-sqlite3`：SQLite 數據庫驅動（C 開發）**必須構建**
- `sharp`：圖片處理庫（C++ 開發）**通常使用預構建版本，但加入白名單確保兼容性**
- `bcrypt`：密碼加密庫（C 開發）**通常使用預構建版本，但加入白名單確保兼容性**
- `@tensorflow/tfjs-node`：如果使用 TensorFlow.js（可選）

**重要說明**：

- `sharp` 和 `bcrypt` 新版本通常提供預構建二進制文件
  - `sharp`：通過 `@img/sharp-win32-x64` 等包提供預構建版本
  - `bcrypt`：在 `prebuilds/` 目錄中提供預構建版本
- 如果預構建版本可用，pnpm 會自動使用，**無需本地構建**
- 將它們加入白名單可以確保在預構建不可用時自動構建，提高兼容性
- 如果看到 `@img/sharp-*` 或 `prebuilds/` 目錄，說明正在使用預構建版本，這是正常的

### 方法 2：使用 pnpm approve-builds 命令

運行以下命令，交互式選擇需要構建的依賴：

```bash
pnpm approve-builds
```

然後選擇需要構建的包（better-sqlite3、sharp、bcrypt 等）。

### 方法 3：手動構建特定包

如果只想構建特定包，可以運行：

```bash
# 構建 better-sqlite3
pnpm rebuild better-sqlite3

# 構建 sharp
pnpm rebuild sharp

# 構建 bcrypt
pnpm rebuild bcrypt
```

## 驗證構建是否成功

### 檢查 .node 文件是否存在

不同包的構建文件位置可能不同：

```bash
# better-sqlite3: 構建在 build/Release/ 目錄
ls node_modules/better-sqlite3/build/Release/*.node

# sharp: 使用預構建二進制（@img/sharp-*），或構建在 src/build/Release/
# 新版本 sharp 通常使用預構建，不需要本地構建
ls node_modules/@img/sharp-*/sharp.node 2>/dev/null || echo "使用預構建版本"

# bcrypt: 使用預構建（prebuilds/）或構建在 build/Release/
# Windows 通常使用 prebuilds/win32-x64/bcrypt.node
ls node_modules/bcrypt/prebuilds/win32-x64/bcrypt.node
ls node_modules/bcrypt/build/Release/*.node 2>/dev/null || echo "使用預構建版本"
```

**注意**：

- `sharp` 和 `bcrypt` 新版本通常提供預構建二進制文件，可能不需要本地構建
- 如果預構建版本可用，pnpm 會自動使用，無需構建
- 只有在預構建不可用時才需要本地構建

### 運行時測試

```bash
# 測試 better-sqlite3
node -e "require('better-sqlite3'); console.log('✅ better-sqlite3 正常')"

# 測試 sharp
node -e "require('sharp'); console.log('✅ sharp 正常')"

# 測試 bcrypt
node -e "require('bcrypt'); console.log('✅ bcrypt 正常')"
```

如果沒有錯誤，說明包可以正常使用（無論是預構建還是本地構建）。

## 完整安裝流程

1. **更新 package.json**（已包含白名單配置）

2. **重新安裝依賴**：

   ```bash
   pnpm install
   ```

3. **驗證構建**：

   ```bash
   # 檢查 .node 文件
   ls node_modules/better-sqlite3/build/Release/*.node
   ls node_modules/sharp/build/Release/*.node
   ls node_modules/bcrypt/lib/binding/*.node
   ```

4. **如果構建失敗**：
   - **Windows**：安裝 Visual Studio Build Tools 或 Visual Studio（包含 C++ 編譯器）
   - **macOS**：安裝 Xcode Command Line Tools：`xcode-select --install`
   - **Linux**：安裝 build-essential：`sudo apt-get install build-essential`

## 常見問題

### Q: 為什麼需要構建？

A: 這些包包含 C/C++ 代碼，需要編譯成 `.node` 文件才能在 Node.js 中運行。pnpm 為了安全，默認不執行構建腳本，需要明確允許。

### Q: 構建失敗怎麼辦？

A:

1. 確保已安裝編譯工具（Visual Studio、Xcode、build-essential）
2. 檢查 Node.js 版本是否兼容
3. 嘗試清除緩存後重新安裝：`pnpm store prune && pnpm install`

### Q: 可以跳過構建嗎？

A: 不可以。這些 native 模塊必須構建才能使用。如果跳過構建，運行時會報錯：`Cannot find module` 或 `The specified module could not be found`。

## 參考資料

- [pnpm 官方文檔 - onlyBuiltDependencies](https://pnpm.io/package_json#pnpmonlybuiltdependencies)
- [pnpm 構建腳本安全](https://pnpm.io/cli/install#--ignore-scripts)
