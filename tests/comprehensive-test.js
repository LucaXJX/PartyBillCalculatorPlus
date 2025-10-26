import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, "../data/users.json");
const BILLS_FILE = path.join(__dirname, "../data/bills.json");
const MESSAGES_FILE = path.join(__dirname, "../data/messages.json");

/**
 * 全面測試腳本
 * 測試密碼加密、數據完整性、功能正常性
 */
async function runComprehensiveTest() {
  console.log("🧪 開始全面測試...\n");

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  // 測試結果收集
  const results = {
    passwordSecurity: [],
    dataIntegrity: [],
    functionality: [],
    performance: []
  };

  // 測試函數
  function test(name, testFn) {
    totalTests++;
    try {
      const result = testFn();
      if (result) {
        passedTests++;
        console.log(`✅ ${name}`);
        return true;
      } else {
        failedTests++;
        console.log(`❌ ${name}`);
        return false;
      }
    } catch (error) {
      failedTests++;
      console.log(`❌ ${name} - 錯誤: ${error.message}`);
      return false;
    }
  }

  // 1. 密碼安全測試
  console.log("🔐 密碼安全測試");
  console.log("=" * 50);

  test("密碼已使用 bcrypt 加密", () => {
    if (!fs.existsSync(USERS_FILE)) return false;
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    const firstUser = users[0];
    return firstUser && firstUser.password && firstUser.password.startsWith("$2b$");
  });

  test("所有用戶密碼都已加密", () => {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    return users.every(user => user.password && user.password.startsWith("$2b$"));
  });

  test("密碼驗證功能正常", () => {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    const testUser = users[0];
    return bcrypt.compareSync("Test123!", testUser.password);
  });

  test("錯誤密碼驗證失敗", () => {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    const testUser = users[0];
    return !bcrypt.compareSync("WrongPassword", testUser.password);
  });

  // 2. 數據完整性測試
  console.log("\n📊 數據完整性測試");
  console.log("=" * 50);

  test("用戶數據文件存在且有效", () => {
    if (!fs.existsSync(USERS_FILE)) return false;
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    return Array.isArray(users) && users.length > 0;
  });

  test("賬單數據文件存在且有效", () => {
    if (!fs.existsSync(BILLS_FILE)) return false;
    const bills = JSON.parse(fs.readFileSync(BILLS_FILE, "utf-8"));
    return Array.isArray(bills) && bills.length > 0;
  });

  test("消息數據文件存在且有效", () => {
    if (!fs.existsSync(MESSAGES_FILE)) return false;
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf-8"));
    return Array.isArray(messages);
  });

  test("用戶數據結構完整", () => {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    const requiredFields = ["id", "username", "email", "password", "createdAt"];
    return users.every(user => requiredFields.every(field => user.hasOwnProperty(field)));
  });

  test("所有用戶都有統一郵箱後綴", () => {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    return users.every(user => user.email.endsWith("@test.com"));
  });

  test("用戶數量符合預期", () => {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    return users.length === 21;
  });

  // 3. 功能測試
  console.log("\n⚙️ 功能測試");
  console.log("=" * 50);

  test("賬單數據包含必要字段", () => {
    const bills = JSON.parse(fs.readFileSync(BILLS_FILE, "utf-8"));
    if (bills.length === 0) return true; // 空數組也是有效的
    
    const requiredFields = ["id", "name", "date", "location", "participants", "items", "results"];
    return bills.every(bill => requiredFields.every(field => bill.hasOwnProperty(field)));
  });

  test("賬單結果數據結構正確", () => {
    const bills = JSON.parse(fs.readFileSync(BILLS_FILE, "utf-8"));
    if (bills.length === 0) return true;
    
    const billWithResults = bills.find(bill => bill.results && bill.results.length > 0);
    if (!billWithResults) return true; // 沒有結果也是有效的
    
    const requiredFields = ["participantId", "amount", "paymentStatus"];
    return billWithResults.results.every(result => 
      requiredFields.every(field => result.hasOwnProperty(field))
    );
  });

  test("消息數據結構正確", () => {
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf-8"));
    if (messages.length === 0) return true;
    
    const requiredFields = ["id", "type", "recipientId", "billId", "title", "content", "isRead", "createdAt"];
    return messages.every(message => 
      requiredFields.every(field => message.hasOwnProperty(field))
    );
  });

  // 4. 性能測試
  console.log("\n⚡ 性能測試");
  console.log("=" * 50);

  test("密碼加密性能測試", () => {
    const startTime = Date.now();
    const hashedPassword = bcrypt.hashSync("TestPassword123!", 12);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // bcrypt 加密應該在合理時間內完成（通常 < 1000ms）
    return duration < 2000 && hashedPassword.startsWith("$2b$");
  });

  test("密碼驗證性能測試", () => {
    const hashedPassword = bcrypt.hashSync("TestPassword123!", 12);
    const startTime = Date.now();
    const isValid = bcrypt.compareSync("TestPassword123!", hashedPassword);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return isValid && duration < 1000;
  });

  test("數據文件讀取性能", () => {
    const startTime = Date.now();
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    const bills = JSON.parse(fs.readFileSync(BILLS_FILE, "utf-8"));
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf-8"));
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 所有文件讀取應該在 100ms 內完成
    return duration < 100 && users.length > 0;
  });

  // 5. 邊界條件測試
  console.log("\n🔍 邊界條件測試");
  console.log("=" * 50);

  test("空密碼處理", () => {
    try {
      const hashedPassword = bcrypt.hashSync("", 12);
      return hashedPassword.startsWith("$2b$");
    } catch (error) {
      return false;
    }
  });

  test("長密碼處理", () => {
    const longPassword = "A".repeat(1000);
    try {
      const hashedPassword = bcrypt.hashSync(longPassword, 12);
      return hashedPassword.startsWith("$2b$");
    } catch (error) {
      return false;
    }
  });

  test("特殊字符密碼處理", () => {
    const specialPassword = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~";
    try {
      const hashedPassword = bcrypt.hashSync(specialPassword, 12);
      return hashedPassword.startsWith("$2b$");
    } catch (error) {
      return false;
    }
  });

  // 6. 數據一致性測試
  console.log("\n🔄 數據一致性測試");
  console.log("=" * 50);

  test("用戶 ID 唯一性", () => {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    const userIds = users.map(user => user.id);
    const uniqueIds = new Set(userIds);
    return userIds.length === uniqueIds.size;
  });

  test("用戶郵箱唯一性", () => {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    const emails = users.map(user => user.email);
    const uniqueEmails = new Set(emails);
    return emails.length === uniqueEmails.size;
  });

  test("用戶名唯一性", () => {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    const usernames = users.map(user => user.username);
    const uniqueUsernames = new Set(usernames);
    return usernames.length === uniqueUsernames.size;
  });

  // 生成測試報告
  console.log("\n📋 測試報告");
  console.log("=" * 50);
  console.log(`總測試數: ${totalTests}`);
  console.log(`通過: ${passedTests} ✅`);
  console.log(`失敗: ${failedTests} ❌`);
  console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (failedTests === 0) {
    console.log("\n🎉 所有測試通過！系統運行正常。");
  } else {
    console.log(`\n⚠️ 有 ${failedTests} 個測試失敗，請檢查相關功能。`);
  }

  // 數據統計
  console.log("\n📊 數據統計");
  console.log("=" * 50);
  
  const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  const bills = JSON.parse(fs.readFileSync(BILLS_FILE, "utf-8"));
  const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf-8"));
  
  console.log(`用戶數量: ${users.length}`);
  console.log(`賬單數量: ${bills.length}`);
  console.log(`消息數量: ${messages.length}`);
  
  if (bills.length > 0) {
    const totalAmount = bills.reduce((sum, bill) => {
      if (bill.results) {
        return sum + bill.results.reduce((billSum, result) => billSum + (result.amount || 0), 0);
      }
      return sum;
    }, 0);
    console.log(`總金額: $${totalAmount.toFixed(2)}`);
  }

  console.log("\n✅ 全面測試完成！");
}

// 執行測試
runComprehensiveTest().catch(console.error);
