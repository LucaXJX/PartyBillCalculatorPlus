import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 讀取 JSON 數據
const usersData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/users.json'), 'utf8')
)
const billsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/bills.json'), 'utf8')
)
const messagesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/messages.json'), 'utf8')
)

// 生成唯一 ID（用於新增的關聯表記錄）
function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
}

// 轉換用戶數據
const users = usersData.map((user: any) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  password: user.password,
  created_at: user.createdAt || user.created_at,
}))

// 轉換賬單數據
const bills = billsData.map((bill: any) => ({
  id: bill.id,
  name: bill.name,
  date: bill.date,
  location: bill.location || null,
  tip_percentage: bill.tipPercentage || bill.tip_percentage || 0,
  payer_id: bill.payerId || bill.payer_id,
  created_by: bill.createdBy || bill.created_by,
  payer_receipt_url: bill.payerReceiptUrl || bill.payer_receipt_url || null,
  created_at: bill.createdAt || bill.created_at,
  updated_at: bill.updatedAt || bill.updated_at || bill.createdAt || bill.created_at,
}))

// 轉換賬單參與者
const billParticipants: any[] = []
billsData.forEach((bill: any) => {
  if (bill.participants && Array.isArray(bill.participants)) {
    bill.participants.forEach((participant: any, idx: number) => {
      billParticipants.push({
        id: `${bill.id}_bp${idx}`,
        bill_id: bill.id,
        participant_id: participant.id,
        participant_name: participant.name || participant.username,
        created_at: bill.createdAt || bill.created_at,
      })
    })
  }
})

// 轉換項目
const items: any[] = []
billsData.forEach((bill: any) => {
  if (bill.items && Array.isArray(bill.items)) {
    bill.items.forEach((item: any) => {
      items.push({
        id: item.id,
        bill_id: bill.id,
        name: item.name,
        amount: item.amount,
        is_shared: item.isShared === true || item.isShared === 1 ? 1 : 0,
        created_at: bill.createdAt || bill.created_at,
      })
    })
  }
})

// 轉換項目參與者
const itemParticipants: any[] = []
billsData.forEach((bill: any) => {
  if (bill.items && Array.isArray(bill.items)) {
    bill.items.forEach((item: any) => {
      if (item.participantIds && Array.isArray(item.participantIds)) {
        item.participantIds.forEach((participantId: string, idx: number) => {
          itemParticipants.push({
            id: `${item.id}_ip${idx}`,
            item_id: item.id,
            participant_id: participantId,
            created_at: bill.createdAt || bill.created_at,
          })
        })
      }
    })
  }
})

// 轉換計算結果
const calculationResults: any[] = []
billsData.forEach((bill: any) => {
  if (bill.results && Array.isArray(bill.results)) {
    bill.results.forEach((result: any, idx: number) => {
      calculationResults.push({
        id: `${bill.id}_cr${idx}`,
        bill_id: bill.id,
        participant_id: result.participantId || result.participant_id,
        amount: result.amount || 0,
        breakdown: result.breakdown || null,
        payment_status: result.paymentStatus || result.payment_status || 'pending',
        paid_at: result.paidAt || result.paid_at || null,
        confirmed_by_payer: result.confirmedByPayer === true || result.confirmedByPayer === 1 ? 1 : 0,
        receipt_image_url: result.receiptImageUrl || result.receipt_image_url || null,
        rejected_reason: result.rejectedReason || result.rejected_reason || null,
        rejected_at: result.rejectedAt || result.rejected_at || null,
        created_at: bill.createdAt || bill.created_at,
        updated_at: bill.updatedAt || bill.updated_at || bill.createdAt || bill.created_at,
      })
    })
  }
})

// 轉換消息
const messages = messagesData.map((msg: any) => ({
  id: msg.id,
  type: msg.type,
  recipient_id: msg.recipientId || msg.recipient_id,
  sender_id: msg.senderId || msg.sender_id || null,
  bill_id: msg.billId || msg.bill_id,
  bill_name: msg.billName || msg.bill_name,
  title: msg.title,
  content: msg.content,
  image_url: msg.imageUrl || msg.image_url || null,
  metadata: msg.metadata ? JSON.stringify(msg.metadata) : null,
  is_read: msg.isRead === true || msg.isRead === 1 ? 1 : 0,
  created_at: msg.createdAt || msg.created_at,
  read_at: msg.readAt || msg.read_at || null,
  actionable: msg.actionable === true || msg.actionable === 1 ? 1 : 0,
  action_type: msg.actionType || msg.action_type || null,
  action_completed: msg.actionCompleted === true || msg.actionCompleted === 1 ? 1 : 0,
}))

// 生成 seed.ts 文件內容（使用 proxy 對象格式，符合老師示例）
const seedContent = `import { proxy } from './server/proxy.js'

// 1. 插入用戶數據
${users.map((user: any, idx: number) => 
  `proxy.user[${idx}] = ${JSON.stringify(user, null, 2)}`
).join('\n')}
console.log(\`✅ 插入 ${users.length} 個用戶\`)

// 2. 插入賬單數據
${bills.map((bill: any, idx: number) => 
  `proxy.bill[${idx}] = ${JSON.stringify(bill, null, 2)}`
).join('\n')}
console.log(\`✅ 插入 ${bills.length} 個賬單\`)

// 3. 插入賬單參與者
${billParticipants.map((bp: any, idx: number) => 
  `proxy.bill_participant[${idx}] = ${JSON.stringify(bp, null, 2)}`
).join('\n')}
${billParticipants.length > 0 ? `console.log(\`✅ 插入 ${billParticipants.length} 個賬單參與者\`)` : ''}

// 4. 插入項目
${items.map((item: any, idx: number) => 
  `proxy.item[${idx}] = ${JSON.stringify(item, null, 2)}`
).join('\n')}
${items.length > 0 ? `console.log(\`✅ 插入 ${items.length} 個項目\`)` : ''}

// 5. 插入項目參與者
${itemParticipants.map((ip: any, idx: number) => 
  `proxy.item_participant[${idx}] = ${JSON.stringify(ip, null, 2)}`
).join('\n')}
${itemParticipants.length > 0 ? `console.log(\`✅ 插入 ${itemParticipants.length} 個項目參與者\`)` : ''}

// 6. 插入計算結果
${calculationResults.map((cr: any, idx: number) => 
  `proxy.calculation_result[${idx}] = ${JSON.stringify(cr, null, 2)}`
).join('\n')}
${calculationResults.length > 0 ? `console.log(\`✅ 插入 ${calculationResults.length} 個計算結果\`)` : ''}

// 7. 插入消息
${messages.map((msg: any, idx: number) => 
  `proxy.message[${idx}] = ${JSON.stringify(msg, null, 2)}`
).join('\n')}
${messages.length > 0 ? `console.log(\`✅ 插入 ${messages.length} 個消息\`)` : ''}

console.log('\\n🎉 數據遷移完成！')
`

// 寫入 seed.ts 文件
fs.writeFileSync(
  path.join(__dirname, '../seed.ts'),
  seedContent,
  'utf8'
)

console.log('✅ 已生成 seed.ts 文件')
console.log(`   - 用戶: ${users.length}`)
console.log(`   - 賬單: ${bills.length}`)
console.log(`   - 賬單參與者: ${billParticipants.length}`)
console.log(`   - 項目: ${items.length}`)
console.log(`   - 項目參與者: ${itemParticipants.length}`)
console.log(`   - 計算結果: ${calculationResults.length}`)
console.log(`   - 消息: ${messages.length}`)

