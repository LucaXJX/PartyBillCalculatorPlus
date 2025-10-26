import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, "../data/users.json");
const TEST_USERS_DOC = path.join(__dirname, "../docs/TEST_USERS.md");

// 統一的密碼和郵箱後綴
const UNIFIED_PASSWORD = "Test123!";
const UNIFIED_EMAIL_DOMAIN = "@test.com";

async function unifyTestUsers() {
  try {
    console.log("🔄 開始統一測試用戶數據...");

    // 讀取現有用戶數據
    if (!fs.existsSync(USERS_FILE)) {
      console.error("❌ 用戶數據文件不存在:", USERS_FILE);
      return;
    }

    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    console.log(`📊 找到 ${users.length} 個用戶`);

    // 統一密碼和郵箱後綴
    let updatedCount = 0;
    users.forEach((user) => {
      const oldEmail = user.email;
      const oldPassword = user.password;

      // 提取用戶名部分（@ 前面的部分）
      const emailPrefix = user.email.split("@")[0];
      
      // 更新郵箱後綴
      user.email = `${emailPrefix}${UNIFIED_EMAIL_DOMAIN}`;
      
      // 更新密碼
      user.password = UNIFIED_PASSWORD;

      if (oldEmail !== user.email || oldPassword !== user.password) {
        updatedCount++;
        console.log(`  ✅ ${user.username}: ${oldEmail} → ${user.email}, 密碼已統一`);
      }
    });

    // 保存更新後的用戶數據
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
    console.log(`✅ 已更新 ${updatedCount} 個用戶的數據`);

    // 更新 TEST_USERS.md 文檔
    await updateTestUsersDocument(users);

    console.log("🎉 測試用戶數據統一完成！");
    console.log(`📧 統一郵箱後綴: ${UNIFIED_EMAIL_DOMAIN}`);
    console.log(`🔐 統一密碼: ${UNIFIED_PASSWORD}`);

  } catch (error) {
    console.error("❌ 統一測試用戶數據時出錯:", error);
  }
}

async function updateTestUsersDocument(users) {
  try {
    console.log("📝 更新 TEST_USERS.md 文檔...");

    // 生成用戶表格
    const userTable = users.map((user, index) => {
      return `| ${index + 1} | ${user.username} | ${user.email} | ${user.password} | 10+ |`;
    }).join("\n");

    // 更新文檔內容
    const newContent = `# 測試用戶列表

## 密碼要求

所有測試用戶的密碼都符合以下要求：
- **至少 8 個字符**
- **包含大小寫字母、數字和特殊字符**
- **便於測試記憶**

## 統一測試配置

為了便於測試，所有用戶使用相同的配置：
- **統一密碼**: \`${UNIFIED_PASSWORD}\`
- **統一郵箱後綴**: \`${UNIFIED_EMAIL_DOMAIN}\`

## 測試用戶列表（${users.length} 個）

### 用戶信息

| 序號 | 用戶名 | 郵箱 | 密碼 | 賬單數量 |
|------|--------|------|------|----------|
${userTable}

## 測試數據統計

- **總用戶數**: ${users.length} 個
- **總賬單數**: 220+ 個
- **平均每用戶賬單數**: 10+ 個
- **數據時間範圍**: 過去 90 天內
- **賬單類型**: 聚餐、KTV、燒烤、電影、購物等 20 種不同場景

## 測試建議

### 快速測試

- 使用 **alice_wong** / alice.wong@test.com / ${UNIFIED_PASSWORD} 進行快速測試
- 使用 **bob_lee** / bob.lee@test.com / ${UNIFIED_PASSWORD} 進行對比測試

### 功能測試場景

1. **用戶隔離測試**
   - 使用不同用戶登入，確認數據完全隔離
   - 每個用戶只能看到自己創建或參與的賬單

2. **參與者管理測試**
   - 每個用戶都有多個不同的參與者組合
   - 測試添加、刪除參與者功能

3. **賬單計算測試**
   - 測試共享項目和個人項目的計算
   - 測試不同小費百分比的計算
   - 驗證支付狀態的更新

4. **會話管理測試**
   - 測試登入、登出功能
   - 測試會話過期處理
   - 測試多設備登入

5. **支付流程測試**
   - 測試標記支付狀態
   - 測試上傳收據功能
   - 測試確認收款功能

### 演示建議

1. **展示用戶隔離**
   - 使用 alice_wong 登入，展示她的賬單
   - 切換到 bob_lee，展示完全不同的賬單列表

2. **展示賬單多樣性**
   - 展示不同類型的聚餐場景
   - 展示不同參與者數量的賬單
   - 展示不同支付狀態的賬單

3. **展示計算功能**
   - 選擇一個複雜的賬單，展示計算結果
   - 展示共享項目和個人項目的分配
   - 展示小費計算

## 數據特點

### 真實性
- 使用真實的餐廳名稱和活動類型
- 合理的價格範圍和消費項目
- 真實的時間分布（過去 90 天）

### 多樣性
- 20 種不同的餐廳和活動類型
- 3-5 人的不同參與者組合
- 不同的支付狀態分布（約 60% 已支付）

### 關聯性
- 用戶之間有相互的賬單關係
- 每個用戶既是創建者也是參與者
- 模擬真實的社交聚餐場景

## 注意事項

- 這些是測試用戶，密碼雖然符合要求但相對簡單
- 在生產環境中應該使用更複雜的密碼
- 建議定期清理和更新測試數據
- 所有數據都是模擬數據，不涉及真實個人信息

## 數據更新

如需更新測試數據，可以運行：
\`\`\`bash
# 統一用戶密碼和郵箱
node scripts/unify-test-users.js

# 重新生成測試賬單數據
node scripts/generate-test-data.js
\`\`\`

這將重新生成所有測試賬單數據，保持用戶數據不變。`;

    // 寫入更新後的文檔
    fs.writeFileSync(TEST_USERS_DOC, newContent, "utf-8");
    console.log("✅ TEST_USERS.md 文檔已更新");

  } catch (error) {
    console.error("❌ 更新 TEST_USERS.md 文檔時出錯:", error);
  }
}

// 執行統一操作
unifyTestUsers().catch(console.error);
