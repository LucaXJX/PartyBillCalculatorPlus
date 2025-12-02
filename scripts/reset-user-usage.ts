/**
 * 重置用戶今日 OCR 使用次數的腳本
 * 使用方法: npm run reset-usage <username>
 * 或: node --loader ts-node/esm scripts/reset-usage.ts <username>
 */

import { proxy } from "../server/proxy.js";

async function resetUserUsage(username: string) {
  try {
    // 查找用戶
    const users = (proxy as any).user.filter((u: any) => u.username === username);
    
    if (users.length === 0) {
      console.error(`用戶 "${username}" 不存在`);
      process.exit(1);
    }
    
    const user = users[0];
    const userId = user.id;
    
    console.log(`找到用戶: ${username} (ID: ${userId})`);
    
    // 檢查 llm_api_usage 表是否存在
    if (!("llm_api_usage" in proxy)) {
      console.error("llm_api_usage 表不存在，請先運行 migration");
      process.exit(1);
    }
    
    const usageTable = (proxy as any).llm_api_usage;
    
    // 獲取今天的日期範圍
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 查找該用戶今天的所有記錄
    const todayRecords = usageTable.filter((record: any) => {
      if (String(record.user_id) !== String(userId)) return false;
      const recordDate = new Date(record.created_at);
      return recordDate >= today && recordDate < tomorrow;
    });
    
    console.log(`找到 ${todayRecords.length} 條今日記錄`);
    
    if (todayRecords.length === 0) {
      console.log("該用戶今日沒有使用記錄，無需重置");
      return;
    }
    
    // 刪除今日記錄
    for (const record of todayRecords) {
      const index = usageTable.indexOf(record);
      if (index !== -1) {
        usageTable.splice(index, 1);
      }
    }
    
    console.log(`已刪除 ${todayRecords.length} 條記錄，用戶 "${username}" 今日使用次數已重置`);
    
  } catch (error) {
    console.error("重置失敗:", error);
    process.exit(1);
  }
}

// 從命令行參數獲取用戶名
const username = process.argv[2];

if (!username) {
  console.error("請提供用戶名");
  console.error("使用方法: node --loader ts-node/esm scripts/reset-usage.ts <username>");
  process.exit(1);
}

resetUserUsage(username);

