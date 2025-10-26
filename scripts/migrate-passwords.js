import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, "../data/users.json");

/**
 * 遷移現有用戶密碼到 bcrypt 加密
 */
async function migratePasswords() {
  try {
    console.log("🔄 開始遷移用戶密碼到 bcrypt 加密...");

    // 讀取現有用戶數據
    if (!fs.existsSync(USERS_FILE)) {
      console.error("❌ 用戶數據文件不存在:", USERS_FILE);
      return;
    }

    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    console.log(`📊 找到 ${users.length} 個用戶`);

    // 檢查是否已經加密
    const firstUser = users[0];
    if (firstUser && firstUser.password && firstUser.password.startsWith("$2")) {
      console.log("✅ 密碼已經使用 bcrypt 加密，無需遷移");
      return;
    }

    // 遷移密碼
    let migratedCount = 0;
    for (const user of users) {
      const originalPassword = user.password;
      
      // 使用 bcrypt 加密密碼
      const saltRounds = 12;
      const hashedPassword = bcrypt.hashSync(originalPassword, saltRounds);
      
      // 更新用戶密碼
      user.password = hashedPassword;
      migratedCount++;
      
      console.log(`  ✅ ${user.username}: 密碼已加密`);
    }

    // 備份原始文件
    const backupFile = USERS_FILE + ".backup." + Date.now();
    fs.writeFileSync(backupFile, JSON.stringify(users, null, 2), "utf-8");
    console.log(`💾 已創建備份文件: ${backupFile}`);

    // 保存更新後的用戶數據
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
    console.log(`✅ 已遷移 ${migratedCount} 個用戶的密碼`);

    // 驗證遷移結果
    console.log("🔍 驗證遷移結果...");
    const testUser = users[0];
    if (testUser && bcrypt.compareSync("Test123!", testUser.password)) {
      console.log("✅ 密碼驗證成功！遷移完成");
    } else {
      console.error("❌ 密碼驗證失敗！請檢查遷移結果");
    }

    console.log("🎉 密碼遷移完成！");
    console.log("🔐 所有密碼現在都使用 bcrypt 加密存儲");

  } catch (error) {
    console.error("❌ 遷移密碼時出錯:", error);
  }
}

// 執行遷移
migratePasswords().catch(console.error);
