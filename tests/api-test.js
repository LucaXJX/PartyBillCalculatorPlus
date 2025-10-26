import fetch from "node-fetch";

const BASE_URL = "http://localhost:3000";

/**
 * API 功能測試腳本
 * 測試服務器端點是否正常工作
 */
async function runApiTest() {
  console.log("🌐 開始 API 功能測試...\n");

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  // 測試函數
  async function test(name, testFn) {
    totalTests++;
    try {
      const result = await testFn();
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

  // 1. 服務器連接測試
  console.log("🔌 服務器連接測試");
  console.log("=" * 50);

  await test("服務器是否運行", async () => {
    try {
      const response = await fetch(`${BASE_URL}/`);
      return response.status === 200;
    } catch (error) {
      console.log("   提示: 請先運行 'npm run dev' 啟動服務器");
      return false;
    }
  });

  // 2. 認證 API 測試
  console.log("\n🔐 認證 API 測試");
  console.log("=" * 50);

  let sessionId = null;

  await test("用戶登入 API", async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "alice.wong@test.com",
          password: "Test123!"
        })
      });

      if (response.ok) {
        const data = await response.json();
        sessionId = data.sessionId;
        return data.user && data.sessionId;
      }
      return false;
    } catch (error) {
      return false;
    }
  });

  await test("錯誤密碼登入失敗", async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "alice.wong@test.com",
          password: "WrongPassword"
        })
      });

      return response.status === 401;
    } catch (error) {
      return false;
    }
  });

  await test("不存在的用戶登入失敗", async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "nonexistent@test.com",
          password: "Test123!"
        })
      });

      return response.status === 401;
    } catch (error) {
      return false;
    }
  });

  // 3. 受保護的 API 測試
  console.log("\n🛡️ 受保護的 API 測試");
  console.log("=" * 50);

  await test("未認證訪問受保護 API 被拒絕", async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/bills`);
      return response.status === 401;
    } catch (error) {
      return false;
    }
  });

  await test("認證後訪問受保護 API 成功", async () => {
    if (!sessionId) {
      console.log("   跳過: 沒有有效的 sessionId");
      return true;
    }

    try {
      const response = await fetch(`${BASE_URL}/api/bills`, {
        headers: {
          "Authorization": `Bearer ${sessionId}`
        }
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  });

  // 4. 賬單 API 測試
  console.log("\n📋 賬單 API 測試");
  console.log("=" * 50);

  await test("獲取用戶賬單列表", async () => {
    if (!sessionId) {
      console.log("   跳過: 沒有有效的 sessionId");
      return true;
    }

    try {
      const response = await fetch(`${BASE_URL}/api/bills`, {
        headers: {
          "Authorization": `Bearer ${sessionId}`
        }
      });

      if (response.ok) {
        const bills = await response.json();
        return Array.isArray(bills);
      }
      return false;
    } catch (error) {
      return false;
    }
  });

  await test("獲取用戶信息", async () => {
    if (!sessionId) {
      console.log("   跳過: 沒有有效的 sessionId");
      return true;
    }

    try {
      const response = await fetch(`${BASE_URL}/api/user`, {
        headers: {
          "Authorization": `Bearer ${sessionId}`
        }
      });

      if (response.ok) {
        const user = await response.json();
        return user.id && user.username && user.email;
      }
      return false;
    } catch (error) {
      return false;
    }
  });

  // 5. 消息 API 測試
  console.log("\n💬 消息 API 測試");
  console.log("=" * 50);

  await test("獲取用戶消息列表", async () => {
    if (!sessionId) {
      console.log("   跳過: 沒有有效的 sessionId");
      return true;
    }

    try {
      const response = await fetch(`${BASE_URL}/api/messages`, {
        headers: {
          "Authorization": `Bearer ${sessionId}`
        }
      });

      if (response.ok) {
        const messages = await response.json();
        return Array.isArray(messages);
      }
      return false;
    } catch (error) {
      return false;
    }
  });

  // 6. 頁面訪問測試
  console.log("\n📄 頁面訪問測試");
  console.log("=" * 50);

  await test("首頁可訪問", async () => {
    try {
      const response = await fetch(`${BASE_URL}/`);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  });

  await test("登入頁面可訪問", async () => {
    try {
      const response = await fetch(`${BASE_URL}/login-page.html`);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  });

  await test("註冊頁面可訪問", async () => {
    try {
      const response = await fetch(`${BASE_URL}/registration-page.html`);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  });

  await test("計算器頁面需要認證", async () => {
    try {
      const response = await fetch(`${BASE_URL}/calculator.html`);
      return response.status === 401 || response.status === 302; // 重定向到登入頁面
    } catch (error) {
      return false;
    }
  });

  // 生成測試報告
  console.log("\n📋 API 測試報告");
  console.log("=" * 50);
  console.log(`總測試數: ${totalTests}`);
  console.log(`通過: ${passedTests} ✅`);
  console.log(`失敗: ${failedTests} ❌`);
  console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (failedTests === 0) {
    console.log("\n🎉 所有 API 測試通過！服務器運行正常。");
  } else {
    console.log(`\n⚠️ 有 ${failedTests} 個 API 測試失敗，請檢查服務器狀態。`);
  }

  console.log("\n💡 提示:");
  console.log("- 如果測試失敗，請確保服務器正在運行 (npm run dev)");
  console.log("- 檢查端口 3000 是否被其他程序佔用");
  console.log("- 確認所有依賴已正確安裝");

  console.log("\n✅ API 測試完成！");
}

// 執行測試
runApiTest().catch(console.error);
