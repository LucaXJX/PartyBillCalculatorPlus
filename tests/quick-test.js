import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, "../data/users.json");

/**
 * 快速測試腳本
 * 驗證密碼加密和基本功能是否正常
 */
function runQuickTest() {
  console.log("⚡ 快速測試開始...\n");

  let passed = 0;
  let total = 0;

  function test(name, condition) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ ${name}`);
    } else {
      console.log(`❌ ${name}`);
    }
  }

  // 1. 密碼加密驗證
  console.log("🔐 密碼加密驗證");
  console.log("-".repeat(30));

  test("用戶數據文件存在", fs.existsSync(USERS_FILE));

  if (fs.existsSync(USERS_FILE)) {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    
    test("有用戶數據", users.length > 0);
    test("密碼已加密", users[0]?.password?.startsWith("$2b$"));
    test("密碼驗證正常", bcrypt.compareSync("Test123!", users[0]?.password));
    test("錯誤密碼被拒絕", !bcrypt.compareSync("WrongPassword", users[0]?.password));
    test("用戶數量正確", users.length === 21);
    test("郵箱格式統一", users.every(u => u.email.endsWith("@test.com")));
  }

  // 2. 文件結構檢查
  console.log("\n📁 文件結構檢查");
  console.log("-".repeat(30));

  const requiredFiles = [
    "../data/users.json",
    "../data/bills.json", 
    "../data/messages.json",
    "../server/passwordUtils.ts",
    "../server/server.ts",
    "../package.json"
  ];

  requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    test(`文件存在: ${file}`, fs.existsSync(filePath));
  });

  // 3. 依賴檢查
  console.log("\n📦 依賴檢查");
  console.log("-".repeat(30));

  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8"));
    test("bcrypt 依賴已安裝", packageJson.dependencies?.bcrypt);
    test("@types/bcrypt 依賴已安裝", packageJson.dependencies?.["@types/bcrypt"] || packageJson.devDependencies?.["@types/bcrypt"]);
  } catch (error) {
    test("package.json 可讀取", false);
  }

  // 4. 編譯檢查
  console.log("\n🔨 編譯檢查");
  console.log("-".repeat(30));

  const distFiles = [
    "../dist/server.js",
    "../dist/passwordUtils.js"
  ];

  distFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    test(`編譯文件存在: ${file}`, fs.existsSync(filePath));
  });

  // 測試結果
  console.log("\n📊 測試結果");
  console.log("=".repeat(40));
  console.log(`通過: ${passed}/${total} (${((passed/total)*100).toFixed(1)}%)`);

  if (passed === total) {
    console.log("\n🎉 所有快速測試通過！系統準備就緒。");
    console.log("\n💡 下一步:");
    console.log("1. 運行 'npm run dev' 啟動服務器");
    console.log("2. 訪問 http://localhost:3000 測試網頁");
    console.log("3. 使用 alice.wong@test.com / Test123! 登入測試");
  } else {
    console.log(`\n⚠️ 有 ${total - passed} 個測試失敗，請檢查相關問題。`);
  }

  console.log("\n✅ 快速測試完成！");
}

// 執行測試
runQuickTest();
