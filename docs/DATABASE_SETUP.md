# 資料庫設置指南

本指南說明如何使用 `quick-erd` 和 `SQLite3` 設置和管理資料庫結構。

## 📋 目錄

1. [安裝步驟](#安裝步驟)
2. [部署資料庫結構](#部署資料庫結構)
3. [安裝 Scripts](#安裝-scripts)
4. [首次部署資料庫](#首次部署資料庫)
5. [後續常用命令](#後續常用命令)

---

## 1. 安裝步驟

### 1.1 安裝 quick-erd

```bash
npm install -D quick-erd
```

這會將 `quick-erd` 安裝為開發依賴。

### 1.2 準備 erd.txt 文件

確保項目根目錄下有 `erd.txt` 文件，包含資料庫結構定義（使用 quick-erd 格式）。

---

## 2. 部署資料庫結構

### 2.1 執行 auto-migrate 初始化

**對於 SQLite3：**
```bash
npx auto-migrate dev.sqlite3 < erd.txt
```

**對於 PostgreSQL：**
```bash
npx auto-migrate pg < erd.txt
```

**對於 MySQL：**
```bash
npx auto-migrate mysql < erd.txt
```

### 2.2 自動設置的內容

執行 `auto-migrate` 後，會自動：

- ✅ 創建/更新 `package.json` 中的 `db:*` scripts
- ✅ 創建 `knexfile.ts` 配置文件
- ✅ 創建 `server/db.ts` 資料庫連接文件（SQLite3）
- ✅ 創建 `server/env.ts` 環境變數文件（PostgreSQL/MySQL）
- ✅ 創建 `server/knex.ts` Knex 實例文件
- ✅ 創建首次 migration 文件在 `migrations/` 目錄
- ✅ 自動安裝必要的依賴（knex, better-sqlite3, npm-run-all 等）
- ✅ 更新 `.gitignore` 文件

---

## 3. 安裝 Scripts

執行 `auto-migrate` 後，以下 scripts 會自動添加到 `package.json`：

### 3.1 SQLite3 的 Scripts

```json
{
  "scripts": {
    "db:ui": "erd-ui erd.txt",
    "db:setup": "npm run db:migrate",
    "db:dev": "run-s db:migrate db:plan db:update",
    "db:migrate": "knex migrate:latest",
    "db:plan": "auto-migrate dev.sqlite3 < erd.txt",
    "db:rename": "auto-migrate --rename dev.sqlite3 < erd.txt",
    "db:update": "run-s db:migrate db:gen-proxy",
    "db:gen-proxy": "erd-to-proxy < erd.txt > server\\proxy.ts"
  }
}
```

### 3.2 PostgreSQL/MySQL 的 Scripts

```json
{
  "scripts": {
    "db:ui": "erd-ui erd.txt",
    "db:setup": "npm run db:migrate",
    "db:dev": "run-s db:migrate db:plan db:update",
    "db:migrate": "knex migrate:latest",
    "db:plan": "auto-migrate pg < erd.txt",
    "db:rename": "auto-migrate --rename pg < erd.txt",
    "db:update": "run-s db:migrate db:gen-types",
    "db:gen-types": "erd-to-types < erd.txt > server\\types.ts"
  }
}
```

---

## 4. 首次部署資料庫

### 4.1 執行 Migration

首次設置資料庫時，執行：

```bash
npm run db:setup
```

或者分步驟執行：

```bash
# 執行所有未執行的 migration
npm run db:migrate
```

這會在 SQLite3 資料庫中創建所有表結構。

---

## 5. 後續常用命令

### 5.1 日常開發流程

#### 修改資料庫結構後

```bash
# 1. 根據 erd.txt 產生新的 migration（不執行）
npm run db:plan

# 2. 執行 migration 並更新 proxy/types
npm run db:update

# 或者使用完整開發流程（推薦）
npm run db:dev
```

`db:dev` 會自動執行：
1. `db:migrate` - 執行 migration
2. `db:plan` - 產生新的 migration
3. `db:update` - 更新 proxy/types

### 5.2 各命令說明

| 命令 | 說明 | 使用場景 |
|------|------|----------|
| `npm run db:ui` | 打開 ERD 可視化界面 | 查看/編輯資料庫結構 |
| `npm run db:setup` | 首次設定資料庫 | 新環境初始化 |
| `npm run db:migrate` | 執行所有未執行的 migration | 更新資料庫結構 |
| `npm run db:plan` | 根據 erd.txt 產生新的 migration | 修改 erd.txt 後 |
| `npm run db:update` | 執行 migration + 更新 proxy/types | 完整的更新流程 |
| `npm run db:dev` | 開發時的完整流程 | 日常開發推薦 |
| `npm run db:rename` | 檢測並處理重命名的表/列 | 重構資料庫結構 |
| `npm run db:gen-proxy` | 生成 TypeScript proxy 類型 | 僅更新類型定義 |

### 5.3 更新 erd.txt 的工作流程

1. **編輯 `erd.txt`** - 修改資料庫結構定義
2. **產生 migration** - `npm run db:plan`
3. **檢查 migration** - 查看 `migrations/` 目錄中新產生的文件
4. **執行 migration** - `npm run db:migrate`
5. **更新類型** - `npm run db:update` 或 `npm run db:gen-proxy`

### 5.4 可視化資料庫結構

```bash
npm run db:ui
```

這會在瀏覽器中打開 ERD 編輯器，可以：
- 可視化資料庫結構
- 拖拽調整表位置
- 編輯資料庫結構
- 導出更新後的 erd.txt

---

## 6. 配置文件說明

### 6.1 knexfile.ts

Knex 配置文件，定義資料庫連接：

```typescript
// SQLite3
import type { Knex } from 'knex'
import { dbFile } from './server/db'

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'better-sqlite3',
    useNullAsDefault: true,
    connection: {
      filename: dbFile,
    },
  }
}
```

### 6.2 server/db.ts

SQLite3 資料庫連接文件：

```typescript
import { toSafeMode, newDB, DBInstance } from 'better-sqlite3-schema'

export const dbFile = resolveFile('dev.sqlite3')
export const db: DBInstance = newDB({
  path: dbFile,
  migrate: false,
})
```

### 6.3 erd.txt

資料庫結構定義文件，使用 quick-erd 格式：

```
user
----
id varchar(64) PK
username varchar(64) unique
email varchar(255) unique
password varchar(255)
created_at varchar(64)
```

---

## 7. 常見問題

### Q: 如果忘記執行 auto-migrate 怎麼辦？

A: 直接執行 `npx auto-migrate dev.sqlite3 < erd.txt`，它會自動檢測並添加缺失的配置。

### Q: 如何從現有資料庫生成 erd.txt？

A: 使用反向工程命令：
```bash
# SQLite3
npx sqlite-to-erd dev.sqlite3 > erd.txt

# PostgreSQL
npx pg-to-erd > erd.txt

# MySQL
npx mysql-to-erd > erd.txt
```

### Q: migration 文件在哪裡？

A: 在 `migrations/` 目錄下，文件名格式為：`YYYYMMDDHHMMSS_description.ts`

### Q: 如何回滾 migration？

A: 使用 knex 命令：
```bash
npx knex migrate:rollback
```

---

## 8. 快速參考

### 完整初始化流程（新項目）

```bash
# 1. 安裝 quick-erd
npm install -D quick-erd

# 2. 準備 erd.txt（已存在）

# 3. 執行 auto-migrate 初始化
npx auto-migrate dev.sqlite3 < erd.txt

# 4. 首次部署資料庫
npm run db:setup
```

### 日常開發流程

```bash
# 修改 erd.txt 後
npm run db:dev

# 或分步驟
npm run db:plan    # 產生 migration
npm run db:migrate # 執行 migration
npm run db:update  # 更新 proxy/types
```

---

## 9. 相關資源

- [quick-erd GitHub](https://github.com/beenotung/quick-erd)
- [quick-erd 線上編輯器](https://quick-erd.surge.sh)
- [Knex.js 文檔](https://knexjs.org/)
- [better-sqlite3 文檔](https://github.com/WiseLibs/better-sqlite3)

---

**最後更新：** 2025-11-20

