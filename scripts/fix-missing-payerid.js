/**
 * 修復缺少 payerId 的賬單
 *
 * 規則：
 * - 如果賬單有 createdBy，則第一個參與者設為 payerId
 * - 如果沒有 createdBy，則無法修復（需要手動處理）
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BILLS_FILE = path.join(__dirname, "../data/bills.json");
const BACKUP_FILE = path.join(__dirname, "../data/bills.backup.json");

console.log("🔍 開始檢查賬單數據...\n");

// 備份原始文件
const bills = JSON.parse(fs.readFileSync(BILLS_FILE, "utf8"));
fs.writeFileSync(BACKUP_FILE, JSON.stringify(bills, null, 2), "utf8");
console.log(`✅ 已備份原始數據到: ${BACKUP_FILE}\n`);

let fixedCount = 0;
let issueCount = 0;

bills.forEach((bill, index) => {
  if (!bill.payerId) {
    console.log(`⚠️ 發現問題 #${index + 1}:`);
    console.log(`   賬單: ${bill.name || "(無名稱)"}`);
    console.log(`   ID: ${bill.id}`);
    console.log(`   創建者: ${bill.createdBy || "(無)"}`);
    console.log(
      `   參與者: ${bill.participants?.map((p) => p.name).join(", ") || "(無)"}`
    );

    if (bill.participants && bill.participants.length > 0) {
      // 假設第一個參與者是付款人
      bill.payerId = bill.participants[0].id;
      console.log(
        `   ✅ 已修復: payerId = ${bill.payerId} (${bill.participants[0].name})`
      );
      fixedCount++;
    } else {
      console.log(`   ❌ 無法修復: 沒有參與者`);
      issueCount++;
    }
    console.log("");
  }
});

// 保存修復後的數據
fs.writeFileSync(BILLS_FILE, JSON.stringify(bills, null, 2), "utf8");

console.log("=".repeat(60));
console.log(`📊 修復完成！`);
console.log(`   - 總賬單數: ${bills.length}`);
console.log(`   - 已修復: ${fixedCount} 筆`);
console.log(`   - 無法修復: ${issueCount} 筆`);
console.log(`   - 備份文件: ${BACKUP_FILE}`);
console.log("=".repeat(60));

if (fixedCount > 0) {
  console.log("\n✅ 建議重啟服務器以載入新數據");
}
