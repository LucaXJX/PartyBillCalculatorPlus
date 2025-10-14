# PostgreSQL 數據庫設置指南

## 📋 概述

本項目已升級為使用 PostgreSQL 數據庫，支持多人並發訪問和完整的數據持久化。

## 🛠️ 安裝步驟

### 1. 安裝 PostgreSQL

#### Windows:

```bash
# 下載並安裝 PostgreSQL
# 訪問 https://www.postgresql.org/download/windows/
# 或使用 Chocolatey
choco install postgresql
```

#### macOS:

```bash
# 使用 Homebrew
brew install postgresql
brew services start postgresql
```

#### Ubuntu/Debian:

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. 創建數據庫和用戶

```bash
# 切換到 postgres 用戶
sudo -u postgres psql

# 創建數據庫
CREATE DATABASE party_bill_calculator;

# 創建用戶（可選，或使用默認的 postgres 用戶）
CREATE USER pbc_user WITH PASSWORD 'your_password';

# 授予權限
GRANT ALL PRIVILEGES ON DATABASE party_bill_calculator TO pbc_user;

# 退出
\q
```

### 3. 安裝 Node.js 依賴

```bash
# 在項目根目錄執行
npm install pg @types/pg dotenv
```

### 4. 配置環境變量

```bash
# 複製環境變量模板
cp env.example .env

# 編輯 .env 文件，設置您的數據庫連接信息
DB_HOST=localhost
DB_PORT=5432
DB_NAME=party_bill_calculator
DB_USER=postgres
DB_PASSWORD=your_password_here
PORT=3000
NODE_ENV=development
```

### 5. 初始化數據庫架構

```bash
# 執行 SQL 腳本創建表結構
psql -U postgres -d party_bill_calculator -f database/schema.sql
```

### 6. 啟動應用程序

```bash
npm run dev
```

## 📊 數據庫架構

### 主要表結構：

1. **users** - 用戶表

   - id, username, email, password
   - created_at, updated_at

2. **user_sessions** - 會話表

   - id, user_id, created_at, expires_at

3. **bills** - 賬單表

   - id, name, date, location, tip_percentage
   - created_by, created_at, updated_at

4. **participants** - 參與者表

   - id, name, user_id, created_at

5. **bill_participants** - 賬單參與者關聯表

   - bill_id, participant_id

6. **bill_items** - 消費項目表

   - id, bill_id, name, amount, is_shared, created_at

7. **item_participants** - 項目參與者關聯表

   - item_id, participant_id

8. **calculation_results** - 計算結果表
   - id, bill_id, participant_id, total_amount, breakdown, created_at

## 🔧 數據庫操作

### 連接測試：

```bash
psql -U postgres -d party_bill_calculator -c "SELECT version();"
```

### 查看表結構：

```bash
psql -U postgres -d party_bill_calculator -c "\dt"
```

### 查看測試數據：

```bash
psql -U postgres -d party_bill_calculator -c "SELECT * FROM users;"
```

## 🚀 部署到生產環境

### 1. 環境變量設置

```bash
# 生產環境配置
DB_HOST=your_production_host
DB_PORT=5432
DB_NAME=party_bill_calculator_prod
DB_USER=your_prod_user
DB_PASSWORD=your_secure_password
NODE_ENV=production
```

### 2. 數據庫備份

```bash
# 創建備份
pg_dump -U postgres party_bill_calculator > backup_$(date +%Y%m%d_%H%M%S).sql

# 恢復備份
psql -U postgres party_bill_calculator < backup_file.sql
```

### 3. 性能優化

- 已創建必要的索引
- 定期清理過期會話
- 監控數據庫性能

## 🔍 故障排除

### 常見問題：

1. **連接失敗**

   - 檢查 PostgreSQL 服務是否運行
   - 驗證連接參數（主機、端口、用戶名、密碼）
   - 檢查防火牆設置

2. **權限錯誤**

   - 確保用戶有數據庫訪問權限
   - 檢查表權限設置

3. **表不存在**
   - 確認已執行 schema.sql 腳本
   - 檢查數據庫名稱是否正確

### 調試命令：

```bash
# 檢查 PostgreSQL 狀態
sudo systemctl status postgresql

# 查看連接
psql -U postgres -c "SELECT * FROM pg_stat_activity;"

# 查看數據庫大小
psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('party_bill_calculator'));"
```

## 📈 監控和維護

### 定期維護任務：

1. 清理過期會話
2. 備份數據庫
3. 更新統計信息
4. 監控性能指標

### 監控查詢：

```sql
-- 查看活躍連接
SELECT count(*) FROM pg_stat_activity;

-- 查看數據庫大小
SELECT pg_size_pretty(pg_database_size('party_bill_calculator'));

-- 查看表大小
SELECT schemaname,tablename,pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

**設置完成後，您的應用程序將具備完整的數據持久化能力，支持多用戶並發訪問！**
