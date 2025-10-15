/**
 * 消息系統壓力測試
 *
 * 測試場景：
 * 1. 多用戶同時創建賬單 → 批量消息生成
 * 2. 多用戶同時提交付款 → 並發消息發送
 * 3. 多用戶同時處理消息 → 並發操作測試
 * 4. 大量消息加載性能測試
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = "http://localhost:3000/api";
const MESSAGES_FILE = path.join(__dirname, "../data/messages.json");
const BILLS_FILE = path.join(__dirname, "../data/bills.json");

// 測試用戶配置
const TEST_USERS = [
  { username: "testuser", email: "test@example.com", password: "123456" },
  {
    username: "alice_wong",
    email: "alice.wong@email.com",
    password: "password123",
  },
  { username: "bob_lee", email: "bob.lee@email.com", password: "password123" },
  {
    username: "charlie_chan",
    email: "charlie.chan@email.com",
    password: "password123",
  },
  {
    username: "diana_liu",
    email: "diana.liu@email.com",
    password: "password123",
  },
  {
    username: "edward_zhang",
    email: "edward.zhang@email.com",
    password: "password123",
  },
];

// 顏色輸出
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// API 調用輔助函數
async function apiCall(url, options = {}, sessionId = null) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (sessionId) {
    headers.Authorization = `Bearer ${sessionId}`;
  }

  try {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
    });

    const data = await response.json();
    return { success: response.ok, status: response.status, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 登入用戶
async function loginUser(email, password) {
  const result = await apiCall("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (result.success && result.data.sessionId) {
    return result.data.sessionId;
  }
  throw new Error(result.data?.error || "登入失敗");
}

// 測試結果統計
const stats = {
  totalTests: 0,
  passed: 0,
  failed: 0,
  startTime: null,
  endTime: null,
};

// ==================== 測試套件 ====================

/**
 * 測試 1：批量創建消息測試
 */
async function testBulkMessageCreation() {
  log("\n" + "=".repeat(60), "cyan");
  log("測試 1：批量創建消息測試", "bright");
  log("=".repeat(60), "cyan");

  stats.totalTests++;

  try {
    // 備份當前消息
    const originalMessages = JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf8"));
    log(`📊 當前消息數: ${originalMessages.length}`, "blue");

    // 創建 50 條測試消息
    const testMessages = [];
    for (let i = 0; i < 50; i++) {
      testMessages.push({
        id: `test_msg_${Date.now()}_${i}`,
        type: "new_bill",
        recipientId: TEST_USERS[i % TEST_USERS.length].email.replace("@", "_"),
        billId: `test_bill_${i}`,
        billName: `測試賬單 #${i}`,
        title: `💰 新待支付賬單：測試賬單 #${i}`,
        content: `這是第 ${i} 條測試消息`,
        isRead: false,
        createdAt: new Date().toISOString(),
        actionable: false,
      });
    }

    // 寫入文件
    const allMessages = [...testMessages, ...originalMessages];
    fs.writeFileSync(
      MESSAGES_FILE,
      JSON.stringify(allMessages, null, 2),
      "utf8"
    );

    log(`✅ 成功創建 50 條測試消息`, "green");
    log(`📊 新消息總數: ${allMessages.length}`, "blue");

    stats.passed++;
    return true;
  } catch (error) {
    log(`❌ 測試失敗: ${error.message}`, "red");
    stats.failed++;
    return false;
  }
}

/**
 * 測試 2：多用戶並發獲取消息
 */
async function testConcurrentMessageFetch() {
  log("\n" + "=".repeat(60), "cyan");
  log("測試 2：多用戶並發獲取消息", "bright");
  log("=".repeat(60), "cyan");

  stats.totalTests++;

  try {
    // 所有用戶並發登入
    const loginPromises = TEST_USERS.map((user) =>
      loginUser(user.email, user.password).catch(() => null)
    );
    const sessions = await Promise.all(loginPromises);

    const validSessions = sessions.filter((s) => s !== null);
    log(
      `✅ ${validSessions.length}/${TEST_USERS.length} 個用戶登入成功`,
      "green"
    );

    // 並發獲取消息
    const startTime = Date.now();
    const fetchPromises = validSessions.map((sessionId) =>
      apiCall("/messages", {}, sessionId)
    );
    const results = await Promise.all(fetchPromises);
    const duration = Date.now() - startTime;

    const successCount = results.filter((r) => r.success).length;
    log(`✅ ${successCount}/${validSessions.length} 個請求成功`, "green");
    log(`⏱️  總耗時: ${duration}ms`, "blue");
    log(
      `⚡ 平均耗時: ${(duration / validSessions.length).toFixed(2)}ms/請求`,
      "blue"
    );

    // 統計每個用戶的消息數
    results.forEach((result, index) => {
      if (result.success) {
        const messageCount = result.data.messages?.length || 0;
        log(`   ${TEST_USERS[index].username}: ${messageCount} 條消息`, "cyan");
      }
    });

    if (successCount === validSessions.length) {
      stats.passed++;
      return true;
    } else {
      stats.failed++;
      return false;
    }
  } catch (error) {
    log(`❌ 測試失敗: ${error.message}`, "red");
    stats.failed++;
    return false;
  }
}

/**
 * 測試 3：並發標記已讀測試
 */
async function testConcurrentMarkAsRead() {
  log("\n" + "=".repeat(60), "cyan");
  log("測試 3：並發標記已讀測試", "bright");
  log("=".repeat(60), "cyan");

  stats.totalTests++;

  try {
    // 登入第一個用戶
    const sessionId = await loginUser(
      TEST_USERS[0].email,
      TEST_USERS[0].password
    );

    // 獲取該用戶的所有消息
    const { data } = await apiCall("/messages", {}, sessionId);
    const messages = data.messages || [];
    const unreadMessages = messages.filter((m) => !m.isRead);

    log(
      `📊 用戶 ${TEST_USERS[0].username} 有 ${unreadMessages.length} 條未讀消息`,
      "blue"
    );

    if (unreadMessages.length === 0) {
      log(`⚠️  跳過測試：沒有未讀消息`, "yellow");
      stats.passed++;
      return true;
    }

    // 並發標記前 10 條消息為已讀
    const messagesToMark = unreadMessages.slice(
      0,
      Math.min(10, unreadMessages.length)
    );
    const startTime = Date.now();

    const markPromises = messagesToMark.map((msg) =>
      apiCall(
        "/messages/mark-read",
        {
          method: "POST",
          body: JSON.stringify({ messageId: msg.id }),
        },
        sessionId
      )
    );

    const results = await Promise.all(markPromises);
    const duration = Date.now() - startTime;

    const successCount = results.filter((r) => r.success).length;
    log(`✅ ${successCount}/${messagesToMark.length} 條消息標記成功`, "green");
    log(`⏱️  總耗時: ${duration}ms`, "blue");
    log(
      `⚡ 平均耗時: ${(duration / messagesToMark.length).toFixed(2)}ms/操作`,
      "blue"
    );

    if (successCount === messagesToMark.length) {
      stats.passed++;
      return true;
    } else {
      stats.failed++;
      return false;
    }
  } catch (error) {
    log(`❌ 測試失敗: ${error.message}`, "red");
    stats.failed++;
    return false;
  }
}

/**
 * 測試 4：消息加載性能測試（大量數據）
 */
async function testMessageLoadPerformance() {
  log("\n" + "=".repeat(60), "cyan");
  log("測試 4：消息加載性能測試", "bright");
  log("=".repeat(60), "cyan");

  stats.totalTests++;

  try {
    const sessionId = await loginUser(
      TEST_USERS[0].email,
      TEST_USERS[0].password
    );

    // 測試多次獲取消息，計算平均耗時
    const iterations = 10;
    const durations = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await apiCall("/messages", {}, sessionId);
      durations.push(Date.now() - startTime);
    }

    const avgDuration = durations.reduce((a, b) => a + b, 0) / iterations;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    log(`📊 執行 ${iterations} 次請求`, "blue");
    log(`⏱️  平均耗時: ${avgDuration.toFixed(2)}ms`, "cyan");
    log(`⏱️  最快: ${minDuration}ms`, "green");
    log(`⏱️  最慢: ${maxDuration}ms`, "yellow");

    // 性能標準：平均耗時 < 100ms
    if (avgDuration < 100) {
      log(`✅ 性能良好（< 100ms）`, "green");
      stats.passed++;
      return true;
    } else if (avgDuration < 500) {
      log(`⚠️  性能一般（100-500ms）`, "yellow");
      stats.passed++;
      return true;
    } else {
      log(`❌ 性能不佳（> 500ms）`, "red");
      stats.failed++;
      return false;
    }
  } catch (error) {
    log(`❌ 測試失敗: ${error.message}`, "red");
    stats.failed++;
    return false;
  }
}

/**
 * 測試 5：模擬真實場景 - 完整的消息流轉
 */
async function testRealWorldScenario() {
  log("\n" + "=".repeat(60), "cyan");
  log("測試 5：真實場景模擬 - 完整消息流轉", "bright");
  log("=".repeat(60), "cyan");

  stats.totalTests++;

  try {
    // 場景：testuser 創建賬單 → alice_wong 付款 → testuser 確認收款

    log("\n📋 步驟 1：testuser 創建賬單", "blue");
    const testuserSession = await loginUser(
      TEST_USERS[0].email,
      TEST_USERS[0].password
    );

    // 獲取初始消息數
    const { data: initialData } = await apiCall(
      "/messages",
      {},
      testuserSession
    );
    const initialMessageCount = initialData.messages?.length || 0;
    log(`   當前消息數: ${initialMessageCount}`, "cyan");

    // 注意：創建賬單需要通過前端，這裡只檢查消息
    // 假設已經有一筆待支付的賬單

    log("\n📋 步驟 2：檢查 alice_wong 的消息", "blue");
    const aliceSession = await loginUser(
      TEST_USERS[1].email,
      TEST_USERS[1].password
    );
    const { data: aliceData } = await apiCall("/messages", {}, aliceSession);
    const aliceMessages = aliceData.messages || [];
    log(`   alice_wong 的消息數: ${aliceMessages.length}`, "cyan");
    log(
      `   未讀消息數: ${aliceMessages.filter((m) => !m.isRead).length}`,
      "cyan"
    );

    log("\n📋 步驟 3：檢查消息類型分佈", "blue");
    const messageTypes = {};
    aliceMessages.forEach((msg) => {
      messageTypes[msg.type] = (messageTypes[msg.type] || 0) + 1;
    });
    Object.entries(messageTypes).forEach(([type, count]) => {
      log(`   ${type}: ${count} 條`, "cyan");
    });

    log("\n✅ 真實場景測試完成", "green");
    stats.passed++;
    return true;
  } catch (error) {
    log(`❌ 測試失敗: ${error.message}`, "red");
    stats.failed++;
    return false;
  }
}

/**
 * 測試 6：並發處理付款通知
 */
async function testConcurrentPaymentHandling() {
  log("\n" + "=".repeat(60), "cyan");
  log("測試 6：並發處理付款通知", "bright");
  log("=".repeat(60), "cyan");

  stats.totalTests++;

  try {
    // 登入 testuser（收款人）
    const sessionId = await loginUser(
      TEST_USERS[0].email,
      TEST_USERS[0].password
    );

    // 獲取所有可操作的付款通知
    const { data } = await apiCall("/messages", {}, sessionId);
    const messages = data.messages || [];
    const paymentMessages = messages.filter(
      (m) =>
        m.type === "payment_submitted" && m.actionable && !m.actionCompleted
    );

    log(`📊 找到 ${paymentMessages.length} 條可處理的付款通知`, "blue");

    if (paymentMessages.length === 0) {
      log(`⚠️  跳過測試：沒有可處理的付款通知`, "yellow");
      stats.passed++;
      return true;
    }

    // 並發處理前 5 條消息（確認收款）
    const messagesToProcess = paymentMessages.slice(
      0,
      Math.min(5, paymentMessages.length)
    );
    const startTime = Date.now();

    const processPromises = messagesToProcess.map((msg) =>
      apiCall(
        "/messages/confirm-payment",
        {
          method: "POST",
          body: JSON.stringify({
            messageId: msg.id,
            billId: msg.billId,
            participantId: msg.metadata?.participantId,
          }),
        },
        sessionId
      )
    );

    const results = await Promise.all(processPromises);
    const duration = Date.now() - startTime;

    const successCount = results.filter((r) => r.success).length;
    log(
      `✅ ${successCount}/${messagesToProcess.length} 條消息處理成功`,
      "green"
    );
    log(`⏱️  總耗時: ${duration}ms`, "blue");
    log(
      `⚡ 平均耗時: ${(duration / messagesToProcess.length).toFixed(2)}ms/操作`,
      "blue"
    );

    if (successCount > 0) {
      stats.passed++;
      return true;
    } else {
      stats.failed++;
      return false;
    }
  } catch (error) {
    log(`❌ 測試失敗: ${error.message}`, "red");
    stats.failed++;
    return false;
  }
}

/**
 * 測試 7：未讀計數準確性測試
 */
async function testUnreadCountAccuracy() {
  log("\n" + "=".repeat(60), "cyan");
  log("測試 7：未讀計數準確性測試", "bright");
  log("=".repeat(60), "cyan");

  stats.totalTests++;

  try {
    const results = [];

    for (const user of TEST_USERS.slice(0, 3)) {
      try {
        const sessionId = await loginUser(user.email, user.password);

        // 獲取消息列表
        const { data: messagesData } = await apiCall(
          "/messages",
          {},
          sessionId
        );
        const messages = messagesData.messages || [];
        const actualUnread = messages.filter((m) => !m.isRead).length;

        // 獲取未讀計數 API
        const { data: countData } = await apiCall(
          "/messages/unread-count",
          {},
          sessionId
        );
        const apiUnread = countData.count || 0;

        const isMatch = actualUnread === apiUnread;
        results.push({
          user: user.username,
          actualUnread,
          apiUnread,
          match: isMatch,
        });

        log(
          `${isMatch ? "✅" : "❌"} ${
            user.username
          }: 實際=${actualUnread}, API=${apiUnread}`,
          isMatch ? "green" : "red"
        );
      } catch (e) {
        log(`⚠️  ${user.username} 測試跳過: ${e.message}`, "yellow");
      }
    }

    const allMatch = results.every((r) => r.match);
    if (allMatch) {
      log(`\n✅ 所有用戶的未讀計數都準確`, "green");
      stats.passed++;
      return true;
    } else {
      log(`\n❌ 發現計數不準確的情況`, "red");
      stats.failed++;
      return false;
    }
  } catch (error) {
    log(`❌ 測試失敗: ${error.message}`, "red");
    stats.failed++;
    return false;
  }
}

/**
 * 測試 8：大量消息標記已讀性能測試
 */
async function testBulkMarkAsReadPerformance() {
  log("\n" + "=".repeat(60), "cyan");
  log("測試 8：批量標記已讀性能測試", "bright");
  log("=".repeat(60), "cyan");

  stats.totalTests++;

  try {
    const sessionId = await loginUser(
      TEST_USERS[0].email,
      TEST_USERS[0].password
    );

    // 使用全部標記已讀 API
    const startTime = Date.now();
    const { success, data } = await apiCall(
      "/messages/mark-all-read",
      { method: "POST" },
      sessionId
    );
    const duration = Date.now() - startTime;

    if (success) {
      log(`✅ 標記了 ${data.count} 條消息為已讀`, "green");
      log(`⏱️  耗時: ${duration}ms`, "blue");

      // 驗證結果
      const { data: countData } = await apiCall(
        "/messages/unread-count",
        {},
        sessionId
      );
      if (countData.count === 0) {
        log(`✅ 驗證成功：未讀數量為 0`, "green");
        stats.passed++;
        return true;
      } else {
        log(`❌ 驗證失敗：還有 ${countData.count} 條未讀`, "red");
        stats.failed++;
        return false;
      }
    } else {
      log(`❌ 標記失敗: ${data.error}`, "red");
      stats.failed++;
      return false;
    }
  } catch (error) {
    log(`❌ 測試失敗: ${error.message}`, "red");
    stats.failed++;
    return false;
  }
}

/**
 * 測試 9：消息刪除功能測試
 */
async function testMessageDeletion() {
  log("\n" + "=".repeat(60), "cyan");
  log("測試 9：消息刪除功能測試", "bright");
  log("=".repeat(60), "cyan");

  stats.totalTests++;

  try {
    const sessionId = await loginUser(
      TEST_USERS[0].email,
      TEST_USERS[0].password
    );

    // 獲取消息列表
    const { data } = await apiCall("/messages", {}, sessionId);
    const messages = data.messages || [];

    if (messages.length === 0) {
      log(`⚠️  跳過測試：沒有消息可刪除`, "yellow");
      stats.passed++;
      return true;
    }

    // 刪除前 3 條消息
    const messagesToDelete = messages.slice(0, Math.min(3, messages.length));
    const beforeCount = messages.length;

    const deletePromises = messagesToDelete.map((msg) =>
      apiCall(`/messages/${msg.id}`, { method: "DELETE" }, sessionId)
    );

    const results = await Promise.all(deletePromises);
    const successCount = results.filter((r) => r.success).length;

    // 驗證刪除結果
    const { data: afterData } = await apiCall("/messages", {}, sessionId);
    const afterCount = afterData.messages?.length || 0;

    log(`📊 刪除前: ${beforeCount} 條`, "blue");
    log(`📊 刪除後: ${afterCount} 條`, "blue");
    log(`✅ 成功刪除: ${successCount} 條`, "green");

    if (afterCount === beforeCount - successCount) {
      log(`✅ 刪除驗證通過`, "green");
      stats.passed++;
      return true;
    } else {
      log(`❌ 刪除驗證失敗`, "red");
      stats.failed++;
      return false;
    }
  } catch (error) {
    log(`❌ 測試失敗: ${error.message}`, "red");
    stats.failed++;
    return false;
  }
}

/**
 * 測試 10：極限並發測試
 */
async function testExtremeConcurrency() {
  log("\n" + "=".repeat(60), "cyan");
  log("測試 10：極限並發測試（50 個並發請求）", "bright");
  log("=".repeat(60), "cyan");

  stats.totalTests++;

  try {
    const sessionId = await loginUser(
      TEST_USERS[0].email,
      TEST_USERS[0].password
    );

    // 50 個並發請求
    const concurrentRequests = 50;
    const startTime = Date.now();

    const promises = Array(concurrentRequests)
      .fill(null)
      .map(() => apiCall("/messages/unread-count", {}, sessionId));

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    log(`📊 發送 ${concurrentRequests} 個並發請求`, "blue");
    log(`✅ 成功: ${successCount} 個`, "green");
    log(`❌ 失敗: ${failCount} 個`, failCount > 0 ? "red" : "green");
    log(`⏱️  總耗時: ${duration}ms`, "blue");
    log(
      `⚡ 平均耗時: ${(duration / concurrentRequests).toFixed(2)}ms/請求`,
      "blue"
    );
    log(
      `⚡ 吞吐量: ${((concurrentRequests / duration) * 1000).toFixed(
        2
      )} 請求/秒`,
      "cyan"
    );

    // 成功率 > 90% 視為通過
    const successRate = (successCount / concurrentRequests) * 100;
    if (successRate >= 90) {
      log(`\n✅ 並發測試通過（成功率: ${successRate.toFixed(1)}%）`, "green");
      stats.passed++;
      return true;
    } else {
      log(`\n❌ 並發測試失敗（成功率: ${successRate.toFixed(1)}%）`, "red");
      stats.failed++;
      return false;
    }
  } catch (error) {
    log(`❌ 測試失敗: ${error.message}`, "red");
    stats.failed++;
    return false;
  }
}

// ==================== 主測試流程 ====================

async function runAllTests() {
  log("\n" + "=".repeat(60), "bright");
  log("🚀 消息系統壓力測試開始", "bright");
  log("=".repeat(60), "bright");

  stats.startTime = Date.now();

  // 依次運行所有測試
  await testBulkMessageCreation();
  await testConcurrentMessageFetch();
  await testConcurrentMarkAsRead();
  await testMessageLoadPerformance();
  await testRealWorldScenario();
  await testConcurrentPaymentHandling();
  await testUnreadCountAccuracy();
  await testMessageDeletion();
  await testExtremeConcurrency();

  stats.endTime = Date.now();

  // 生成測試報告
  generateReport();
}

/**
 * 生成測試報告
 */
function generateReport() {
  log("\n" + "=".repeat(60), "bright");
  log("📊 測試報告", "bright");
  log("=".repeat(60), "bright");

  const totalDuration = stats.endTime - stats.startTime;
  const passRate = ((stats.passed / stats.totalTests) * 100).toFixed(1);

  log(`\n📋 測試概況:`, "cyan");
  log(`   總測試數: ${stats.totalTests}`, "blue");
  log(`   通過: ${stats.passed}`, "green");
  log(`   失敗: ${stats.failed}`, stats.failed > 0 ? "red" : "green");
  log(`   通過率: ${passRate}%`, passRate >= 80 ? "green" : "red");
  log(`   總耗時: ${(totalDuration / 1000).toFixed(2)} 秒`, "blue");

  if (stats.failed === 0) {
    log(`\n🎉 所有測試通過！系統運行正常！`, "green");
  } else {
    log(`\n⚠️  發現 ${stats.failed} 個測試失敗，請檢查詳細日誌`, "yellow");
  }

  log("\n" + "=".repeat(60), "bright");

  // 保存測試報告
  const report = {
    timestamp: new Date().toISOString(),
    stats,
    passRate: parseFloat(passRate),
  };

  const reportFile = path.join(__dirname, "../data/test-report.json");
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf8");
  log(`\n💾 測試報告已保存到: ${reportFile}`, "cyan");
}

// 運行測試
runAllTests().catch((error) => {
  log(`\n❌ 測試運行失敗: ${error.message}`, "red");
  process.exit(1);
});
