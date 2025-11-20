// 生成測試數據腳本
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 讀取現有用戶數據
const usersPath = path.join(__dirname, '../data/users.json');
const billsPath = path.join(__dirname, '../data/bills.json');

const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
const existingBills = JSON.parse(fs.readFileSync(billsPath, 'utf8'));

// 餐廳和活動類型
const restaurants = [
  '海底撈火鍋', '錢櫃KTV', '燒烤一條街', '星巴克', '萬達影城',
  '購物中心美食廣場', '網吧', '健康餐廳', '私人會所', '咖啡書店',
  '麥當勞', '肯德基', '必勝客', '真功夫', '吉野家',
  '大龍燚火鍋', '小龍坎', '呷哺呷哺', '西貝莜面村', '外婆家'
];

const activities = [
  '聚餐', 'KTV聚會', '燒烤派對', '下午茶', '電影之夜',
  '購物聚餐', '遊戲聚會', '瑜伽課後聚餐', '生日派對', '讀書會聚餐',
  '火鍋聚餐', '燒烤夜', '咖啡聚會', '電影觀影', '購物午餐',
  '網吧聚會', '健身後聚餐', '慶生會', '學習小組聚餐', '朋友聚會'
];

// 生成隨機賬單數據
function generateRandomBill(billId, creatorId, date) {
  const creator = users.find(u => u.id === creatorId);
  if (!creator) return null;

  // 隨機選擇3-5個參與者
  const participantCount = Math.floor(Math.random() * 3) + 3;
  const shuffledUsers = [...users].sort(() => 0.5 - Math.random());
  const participants = shuffledUsers.slice(0, participantCount);
  
  // 確保創建者在參與者中
  if (!participants.find(p => p.id === creatorId)) {
    participants[0] = creator;
  }

  // 生成消費項目
  const itemCount = Math.floor(Math.random() * 4) + 3;
  const items = [];
  const itemPrices = [15, 20, 25, 30, 35, 40, 45, 50, 60, 80, 100, 120];
  
  for (let i = 0; i < itemCount; i++) {
    const isShared = Math.random() > 0.3; // 70% 機率是共享項目
    const price = itemPrices[Math.floor(Math.random() * itemPrices.length)];
    
    items.push({
      id: `item${billId}${i.toString().padStart(3, '0')}`,
      name: `項目${i + 1}`,
      amount: price,
      isShared: isShared,
      participantIds: isShared ? participants.map(p => p.id) : [participants[Math.floor(Math.random() * participants.length)].id]
    });
  }

  // 計算結果
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const tipPercentage = Math.floor(Math.random() * 15) + 5; // 5-20%
  const totalWithTip = totalAmount * (1 + tipPercentage / 100);
  
  const results = participants.map(participant => {
    let participantTotal = 0;
    
    // 計算該參與者的消費
    items.forEach(item => {
      if (item.participantIds.includes(participant.id)) {
        if (item.isShared) {
          participantTotal += item.amount / item.participantIds.length;
        } else {
          participantTotal += item.amount;
        }
      }
    });
    
    // 加上小費
    participantTotal *= (1 + tipPercentage / 100);
    
    // 隨機設置支付狀態
    const isPaid = Math.random() > 0.4; // 60% 機率已支付
    
    return {
      participantId: participant.id,
      amount: Math.round(participantTotal * 100) / 100,
      paymentStatus: isPaid ? 'paid' : 'pending',
      ...(isPaid && { paidAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() })
    };
  });

  return {
    id: `bill${billId.toString().padStart(3, '0')}`,
    name: `${creator.username}的${activities[Math.floor(Math.random() * activities.length)]}`,
    date: date,
    location: restaurants[Math.floor(Math.random() * restaurants.length)],
    tipPercentage: tipPercentage,
    payerId: creatorId,
    participants: participants.map(p => ({ id: p.id, name: p.username })),
    items: items,
    results: results,
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: creatorId
  };
}

// 為每個用戶生成10個賬單
const newBills = [];
let billCounter = existingBills.length + 1;

users.forEach((user, userIndex) => {
  for (let i = 0; i < 10; i++) {
    const daysAgo = Math.floor(Math.random() * 90); // 過去90天內
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dateString = date.toISOString().split('T')[0];
    
    const bill = generateRandomBill(billCounter, user.id, dateString);
    if (bill) {
      newBills.push(bill);
      billCounter++;
    }
  }
});

// 合併現有和新的賬單
const allBills = [...existingBills, ...newBills];

// 保存到文件
fs.writeFileSync(billsPath, JSON.stringify(allBills, null, 2));

console.log(`✅ 已生成 ${newBills.length} 個新的測試賬單`);
console.log(`📊 總計 ${allBills.length} 個賬單`);
console.log(`👥 涉及 ${users.length} 個用戶`);

// 統計信息
const userBillCounts = {};
allBills.forEach(bill => {
  userBillCounts[bill.createdBy] = (userBillCounts[bill.createdBy] || 0) + 1;
});

console.log('\n📈 每個用戶的賬單數量:');
Object.entries(userBillCounts).forEach(([userId, count]) => {
  const user = users.find(u => u.id === userId);
  console.log(`  ${user?.username || userId}: ${count} 個賬單`);
});
