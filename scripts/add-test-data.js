import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 讀取現有賬單
const billsPath = path.join(__dirname, '../data/bills.json');
const testDataPath = path.join(__dirname, '../data/test-bills-data.json');

const existingBills = JSON.parse(fs.readFileSync(billsPath, 'utf8'));
const testBills = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));

// 檢查是否已經添加過測試數據
const hasTestData = existingBills.some(bill => bill.id.startsWith('test_bill_'));

if (hasTestData) {
  console.log('✅ 測試數據已經存在，跳過添加');
  process.exit(0);
}

// 合併數據（測試數據放在前面，方便查看）
const mergedBills = [...testBills, ...existingBills];

// 寫回文件
fs.writeFileSync(billsPath, JSON.stringify(mergedBills, null, 2));

console.log('✅ 成功添加測試數據！');
console.log(`   - 原有賬單: ${existingBills.length} 個`);
console.log(`   - 測試賬單: ${testBills.length} 個`);
console.log(`   - 總計: ${mergedBills.length} 個`);
console.log('\n📋 測試賬單列表:');
testBills.forEach((bill, index) => {
  console.log(`   ${index + 1}. ${bill.name || '(無名稱)'} - ${bill.date} - ${bill.location}`);
  console.log(`      付款人: ${bill.participants.find(p => p.id === bill.payerId)?.name || '無'}`);
  console.log(`      參與者: ${bill.participants.map(p => p.name).join(', ')}`);
});

