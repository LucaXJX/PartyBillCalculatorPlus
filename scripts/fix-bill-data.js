// 修復賬單數據中的字段名
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const billsPath = path.join(__dirname, '../data/bills.json');

// 讀取現有賬單數據
const bills = JSON.parse(fs.readFileSync(billsPath, 'utf8'));

// 修復每個賬單的 results 字段
let fixedCount = 0;
bills.forEach(bill => {
  if (bill.results && Array.isArray(bill.results)) {
    bill.results.forEach(result => {
      if (result.totalAmount !== undefined && result.amount === undefined) {
        result.amount = result.totalAmount;
        delete result.totalAmount;
        fixedCount++;
      }
    });
  }
});

// 保存修復後的數據
fs.writeFileSync(billsPath, JSON.stringify(bills, null, 2));

console.log(`✅ 已修復 ${fixedCount} 個結果記錄`);
console.log(`📊 總計 ${bills.length} 個賬單`);
