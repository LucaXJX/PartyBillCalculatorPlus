/**
 * API 健康檢查腳本
 * 測試所有 API 端點是否正常工作
 */

const BASE_URL = "http://localhost:3000";
let sessionId = null;
let testResults = [];

// 測試結果輸出
function logTest(category, name, status, message = "") {
  const icon = status === "✅" ? "✅" : status === "⚠️" ? "⚠️" : "❌";
  const result = {
    category,
    name,
    status: icon,
    message,
  };
  testResults.push(result);
  console.log(`${icon} [${category}] ${name}${message ? ": " + message : ""}`);
}

// 測試 API 端點
async function testAPI(method, path, body = null, requireAuth = false) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (requireAuth && sessionId) {
    headers["Authorization"] = `Bearer ${sessionId}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, options);
    return {
      ok: response.ok,
      status: response.status,
      data: await response.json().catch(() => null),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message,
    };
  }
}

// 1. 測試認證相關 API
async function testAuthAPIs() {
  console.log("\n=== 🔐 測試認證 API ===");

  // 註冊測試用戶
  const registerRes = await testAPI("POST", "/api/auth/register", {
    username: `test_health_${Date.now()}`,
    email: `test_health_${Date.now()}@example.com`,
    password: "testpass123",
  });

  if (registerRes.ok) {
    sessionId = registerRes.data.sessionId;
    logTest("認證", "POST /api/auth/register", "✅", "註冊成功");
  } else {
    logTest(
      "認證",
      "POST /api/auth/register",
      "❌",
      `狀態碼: ${registerRes.status}`
    );
    // 嘗試使用現有用戶登入
    const loginRes = await testAPI("POST", "/api/auth/login", {
      email: "test@example.com",
      password: "123456",
    });
    if (loginRes.ok) {
      sessionId = loginRes.data.sessionId;
      logTest("認證", "POST /api/auth/login (備用)", "✅");
    }
  }

  // 登入測試（使用 email 而非 username）
  const loginRes = await testAPI("POST", "/api/auth/login", {
    email: "test@example.com",
    password: "123456",
  });
  logTest(
    "認證",
    "POST /api/auth/login",
    loginRes.ok ? "✅" : "❌",
    loginRes.ok ? "" : `狀態碼: ${loginRes.status}`
  );

  // 獲取當前用戶
  const meRes = await testAPI("GET", "/api/me", null, true);
  logTest(
    "認證",
    "GET /api/me",
    meRes.ok ? "✅" : "❌",
    meRes.ok ? "" : `狀態碼: ${meRes.status}`
  );

  const authMeRes = await testAPI("GET", "/api/auth/me", null, true);
  logTest(
    "認證",
    "GET /api/auth/me",
    authMeRes.ok ? "✅" : "❌",
    authMeRes.ok ? "" : `狀態碼: ${authMeRes.status}`
  );
}

// 2. 測試用戶相關 API
async function testUserAPIs() {
  console.log("\n=== 👤 測試用戶 API ===");

  const searchRes = await testAPI(
    "GET",
    "/api/users/search?query=test",
    null,
    true
  );
  logTest(
    "用戶",
    "GET /api/users/search",
    searchRes.ok ? "✅" : "❌",
    searchRes.ok
      ? `找到 ${searchRes.data?.users?.length || 0} 個用戶`
      : `狀態碼: ${searchRes.status}`
  );
}

// 3. 測試賬單計算相關 API
async function testBillCalculatorAPIs() {
  console.log("\n=== 🧮 測試賬單計算 API ===");

  // 重置賬單
  const resetRes = await testAPI("POST", "/api/bill/reset", {}, true);
  logTest(
    "計算器",
    "POST /api/bill/reset",
    resetRes.ok ? "✅" : "❌",
    resetRes.ok ? "" : `狀態碼: ${resetRes.status}`
  );

  // 設置賬單信息
  const billInfoRes = await testAPI(
    "POST",
    "/api/bill/info",
    {
      name: "健康檢查測試賬單",
      location: "測試地點",
      date: new Date().toISOString().split("T")[0],
      tipPercentage: 10,
    },
    true
  );
  logTest("計算器", "POST /api/bill/info", billInfoRes.ok ? "✅" : "❌");

  // 添加參與者
  const participantRes = await testAPI(
    "POST",
    "/api/participant",
    {
      name: "測試參與者",
    },
    true
  );
  logTest("計算器", "POST /api/participant", participantRes.ok ? "✅" : "❌");

  // 獲取參與者列表
  const getParticipantsRes = await testAPI(
    "GET",
    "/api/participants",
    null,
    true
  );
  logTest(
    "計算器",
    "GET /api/participants",
    getParticipantsRes.ok ? "✅" : "❌",
    getParticipantsRes.ok
      ? `參與者數: ${getParticipantsRes.data?.participants?.length || 0}`
      : ""
  );

  // 獲取計算結果
  const calculateRes = await testAPI("GET", "/api/calculate", null, true);
  logTest("計算器", "GET /api/calculate", calculateRes.ok ? "✅" : "❌");
}

// 4. 測試賬單管理 API
async function testBillManagementAPIs() {
  console.log("\n=== 📊 測試賬單管理 API ===");

  // 獲取賬單列表
  const billsRes = await testAPI("GET", "/api/bills", null, true);
  logTest(
    "賬單",
    "GET /api/bills",
    billsRes.ok ? "✅" : "❌",
    billsRes.ok
      ? `賬單數: ${billsRes.data?.bills?.length || billsRes.data?.length || 0}`
      : `狀態碼: ${billsRes.status}`
  );

  // 如果有賬單，測試獲取單個賬單
  if (billsRes.ok && billsRes.data) {
    const bills = billsRes.data.bills || billsRes.data;
    if (bills.length > 0) {
      const billId = bills[0].id;
      const billRes = await testAPI("GET", `/api/bill/${billId}`, null, true);
      logTest("賬單", "GET /api/bill/:id", billRes.ok ? "✅" : "❌");
    } else {
      logTest("賬單", "GET /api/bill/:id", "⚠️", "沒有賬單可測試");
    }
  }
}

// 5. 測試消息相關 API
async function testMessageAPIs() {
  console.log("\n=== 💬 測試消息 API ===");

  // 獲取消息列表
  const messagesRes = await testAPI("GET", "/api/messages", null, true);
  logTest(
    "消息",
    "GET /api/messages",
    messagesRes.ok ? "✅" : "❌",
    messagesRes.ok
      ? `消息數: ${messagesRes.data?.messages?.length || 0}`
      : `狀態碼: ${messagesRes.status}`
  );

  // 獲取未讀消息數
  const unreadRes = await testAPI(
    "GET",
    "/api/messages/unread-count",
    null,
    true
  );
  logTest(
    "消息",
    "GET /api/messages/unread-count",
    unreadRes.ok ? "✅" : "❌",
    unreadRes.ok
      ? `未讀數: ${unreadRes.data?.count || 0}`
      : `狀態碼: ${unreadRes.status}`
  );
}

// 6. 測試逾期提醒 API
async function testOverdueReminderAPI() {
  console.log("\n=== ⏰ 測試逾期提醒 API ===");

  const overdueRes = await testAPI(
    "POST",
    "/api/admin/trigger-overdue-check",
    {},
    true
  );
  logTest(
    "逾期提醒",
    "POST /api/admin/trigger-overdue-check",
    overdueRes.ok ? "✅" : "❌",
    overdueRes.ok
      ? `發送了 ${overdueRes.data?.count || 0} 條提醒`
      : `狀態碼: ${overdueRes.status}`
  );
}

// 7. 生成測試報告
function generateReport() {
  console.log("\n" + "=".repeat(50));
  console.log("📊 測試報告總結");
  console.log("=".repeat(50));

  const categories = {};
  testResults.forEach((result) => {
    if (!categories[result.category]) {
      categories[result.category] = { pass: 0, fail: 0, warn: 0, total: 0 };
    }
    categories[result.category].total++;
    if (result.status === "✅") categories[result.category].pass++;
    else if (result.status === "❌") categories[result.category].fail++;
    else categories[result.category].warn++;
  });

  Object.keys(categories).forEach((cat) => {
    const { pass, fail, warn, total } = categories[cat];
    const passRate = ((pass / total) * 100).toFixed(1);
    console.log(
      `\n${cat}: ${pass}/${total} 通過 (${passRate}%) | 失敗: ${fail} | 警告: ${warn}`
    );
  });

  const totalPass = testResults.filter((r) => r.status === "✅").length;
  const totalFail = testResults.filter((r) => r.status === "❌").length;
  const totalWarn = testResults.filter((r) => r.status === "⚠️").length;
  const totalTests = testResults.length;
  const overallPassRate = ((totalPass / totalTests) * 100).toFixed(1);

  console.log("\n" + "=".repeat(50));
  console.log(`總計: ${totalPass}/${totalTests} 通過 (${overallPassRate}%)`);
  console.log(`失敗: ${totalFail} | 警告: ${totalWarn}`);
  console.log("=".repeat(50));

  if (totalFail > 0) {
    console.log("\n❌ 失敗的測試:");
    testResults
      .filter((r) => r.status === "❌")
      .forEach((r) => {
        console.log(`  - [${r.category}] ${r.name}: ${r.message}`);
      });
  }

  if (totalWarn > 0) {
    console.log("\n⚠️ 警告的測試:");
    testResults
      .filter((r) => r.status === "⚠️")
      .forEach((r) => {
        console.log(`  - [${r.category}] ${r.name}: ${r.message}`);
      });
  }
}

// 主測試流程
async function runHealthCheck() {
  console.log("🚀 開始 API 健康檢查...");
  console.log(`📍 測試服務器: ${BASE_URL}\n`);

  try {
    await testAuthAPIs();
    await testUserAPIs();
    await testBillCalculatorAPIs();
    await testBillManagementAPIs();
    await testMessageAPIs();
    await testOverdueReminderAPI();

    generateReport();
  } catch (error) {
    console.error("\n❌ 測試過程中發生錯誤:", error);
  }
}

// 執行測試
runHealthCheck();
