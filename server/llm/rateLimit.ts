/**
 * API 調用速率限制
 * 參考 01-mc-system/rate-limit.ts
 *
 * Mistral AI 免費計劃限制：
 * - 每分鐘：60 次請求（RPM）
 * - 每小時：1,500 次請求
 * - 每月：200 萬個 token
 */

/**
 * API 調用速率限制
 * 參考 01-mc-system/rate-limit.ts
 *
 * Mistral AI 免費計劃限制：
 * - 每分鐘：60 次請求（RPM）
 * - 每小時：1,500 次請求
 * - 每月：200 萬個 token
 */

let lastTime = Date.now();
const interval = 2000; // 2 秒間隔（確保不超過 60 RPM，留出安全邊際）

/**
 * 等待直到可以調用 API（速率限制）
 * @param label 調用標籤（用於日誌，可選）
 */
export async function waitForRateLimit(label?: string) {
  for (;;) {
    const now = Date.now();
    const passedTime = now - lastTime;
    // console.log(timestamp(), label || 'waitForRateLimit', 'passedTime:', passedTime);

    if (passedTime < interval) {
      await new Promise((resolve) =>
        setTimeout(resolve, interval - passedTime)
      );
      continue;
    }

    // console.log(timestamp(), label || 'waitForRateLimit', 'can call API now');
    lastTime = now;
    return;
  }
}

function timestamp() {
  return new Date().toTimeString();
}
