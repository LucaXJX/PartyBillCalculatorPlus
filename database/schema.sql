-- PostgreSQL 數據庫架構
-- 聚賬通應用程序數據庫設計

-- 創建數據庫（需要在PostgreSQL中手動執行）
-- CREATE DATABASE party_bill_calculator;

-- 使用數據庫
-- \c party_bill_calculator;

-- 用戶表
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 會話表
CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 賬單表
CREATE TABLE IF NOT EXISTS bills (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATE,
    location VARCHAR(255),
    tip_percentage DECIMAL(5,2) DEFAULT 0,
    created_by VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 參與者表
CREATE TABLE IF NOT EXISTS participants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 賬單參與者關聯表
CREATE TABLE IF NOT EXISTS bill_participants (
    bill_id VARCHAR(50) NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    participant_id VARCHAR(50) NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    PRIMARY KEY (bill_id, participant_id)
);

-- 消費項目表
CREATE TABLE IF NOT EXISTS bill_items (
    id VARCHAR(50) PRIMARY KEY,
    bill_id VARCHAR(50) NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    is_shared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 項目參與者關聯表
CREATE TABLE IF NOT EXISTS item_participants (
    item_id VARCHAR(50) NOT NULL REFERENCES bill_items(id) ON DELETE CASCADE,
    participant_id VARCHAR(50) NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, participant_id)
);

-- 計算結果表
CREATE TABLE IF NOT EXISTS calculation_results (
    id VARCHAR(50) PRIMARY KEY,
    bill_id VARCHAR(50) NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    participant_id VARCHAR(50) NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    total_amount DECIMAL(10,2) NOT NULL,
    breakdown TEXT, -- JSON格式的詳細分攤信息
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 創建索引以提高查詢性能
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_bills_created_by ON bills(created_by);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_participants_bill_id ON bill_participants(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_participants_participant_id ON bill_participants(participant_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_item_participants_item_id ON item_participants(item_id);
CREATE INDEX IF NOT EXISTS idx_item_participants_participant_id ON item_participants(participant_id);
CREATE INDEX IF NOT EXISTS idx_calculation_results_bill_id ON calculation_results(bill_id);
CREATE INDEX IF NOT EXISTS idx_calculation_results_participant_id ON calculation_results(participant_id);

-- 創建觸發器自動更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON bills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入測試數據
INSERT INTO users (id, username, email, password) VALUES
('user1', 'testuser', 'test@example.com', 'password123'),
('user2', 'alice', 'alice@example.com', 'password123'),
('user3', 'bob', 'bob@example.com', 'password123'),
('user4', 'charlie', 'charlie@example.com', 'password123'),
('user5', 'diana', 'diana@example.com', 'password123')
ON CONFLICT (id) DO NOTHING;
