/**
 * 生成模擬收據圖片並綁定到賬單數據
 * 使用 SVG 生成簡單的收據圖片
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 確保 receipts 目錄存在
const receiptsDir = path.join(__dirname, "../data/receipts");
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

/**
 * 生成 SVG 收據圖片
 */
function generateReceiptSVG(filename, data) {
  const width = 400;
  const height = 600;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- 背景 -->
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  
  <!-- 邊框 -->
  <rect x="10" y="10" width="${width - 20}" height="${height - 20}" 
        fill="none" stroke="#e5e7eb" stroke-width="2"/>
  
  <!-- 標題 -->
  <text x="${width / 2}" y="50" font-family="Arial, sans-serif" 
        font-size="24" font-weight="bold" fill="#1f2937" text-anchor="middle">
    付款收據
  </text>
  
  <!-- 分隔線 -->
  <line x1="30" y1="70" x2="${
    width - 30
  }" y2="70" stroke="#d1d5db" stroke-width="1"/>
  
  <!-- 收據信息 -->
  <text x="40" y="100" font-family="Arial, sans-serif" font-size="16" fill="#374151">
    賬單: ${escapeXml(data.billName)}
  </text>
  <text x="40" y="130" font-family="Arial, sans-serif" font-size="16" fill="#374151">
    日期: ${data.date}
  </text>
  ${
    data.location
      ? `<text x="40" y="160" font-family="Arial, sans-serif" font-size="16" fill="#374151">
    地點: ${escapeXml(data.location)}
  </text>`
      : ""
  }
  
  <!-- 分隔線 -->
  <line x1="30" y1="${data.location ? 180 : 150}" x2="${width - 30}" y2="${
    data.location ? 180 : 150
  }" 
        stroke="#d1d5db" stroke-width="1"/>
  
  <!-- 付款信息 -->
  <text x="40" y="${data.location ? 210 : 180}" font-family="Arial, sans-serif" 
        font-size="16" fill="#374151">
    付款人: ${escapeXml(data.payerName)}
  </text>
  ${
    data.recipientName
      ? `<text x="40" y="${
          data.location ? 240 : 210
        }" font-family="Arial, sans-serif" 
        font-size="16" fill="#374151">
    收款人: ${escapeXml(data.recipientName)}
  </text>`
      : ""
  }
  
  <!-- 金額 -->
  <text x="40" y="${data.location ? 290 : 260}" font-family="Arial, sans-serif" 
        font-size="32" font-weight="bold" fill="#4f46e5">
    HKD $${data.amount.toFixed(2)}
  </text>
  
  <!-- 分隔線 -->
  <line x1="30" y1="${data.location ? 310 : 280}" x2="${width - 30}" y2="${
    data.location ? 310 : 280
  }" 
        stroke="#d1d5db" stroke-width="1"/>
  
  <!-- 交易信息 -->
  <text x="40" y="${data.location ? 340 : 310}" font-family="Arial, sans-serif" 
        font-size="12" fill="#6b7280">
    交易編號: ${data.transactionId}
  </text>
  <text x="40" y="${data.location ? 365 : 335}" font-family="Arial, sans-serif" 
        font-size="12" fill="#6b7280">
    時間: ${data.timestamp}
  </text>
  
  <!-- QR Code 區域 -->
  <rect x="${width / 2 - 60}" y="${
    data.location ? 395 : 365
  }" width="120" height="120" 
        fill="#f3f4f6" stroke="#9ca3af" stroke-width="1"/>
  <text x="${width / 2}" y="${
    data.location ? 460 : 430
  }" font-family="Arial, sans-serif" 
        font-size="12" fill="#6b7280" text-anchor="middle">
    QR Code
  </text>
  
  <!-- 底部文字 -->
  <text x="${width / 2}" y="${
    data.location ? 540 : 510
  }" font-family="Arial, sans-serif" 
        font-size="10" fill="#9ca3af" text-anchor="middle">
    此收據由 PBC聚賬通 生成
  </text>
  <text x="${width / 2}" y="${
    data.location ? 555 : 525
  }" font-family="Arial, sans-serif" 
        font-size="10" fill="#9ca3af" text-anchor="middle">
    僅供參考，不作為法律憑證
  </text>
</svg>`;

  const filepath = path.join(receiptsDir, filename);
  fs.writeFileSync(filepath, svg, "utf-8");
  console.log(`✅ 生成收據圖片: ${filename}`);
  return filename;
}

/**
 * 轉義 XML 特殊字符
 */
function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 生成隨機交易ID
 */
function generateTransactionId() {
  return (
    "TXN" +
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).substr(2, 5).toUpperCase()
  );
}

/**
 * 格式化日期時間
 */
function formatDateTime(date) {
  return new Date(date).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * 主函數
 */
async function main() {
  console.log("🚀 開始生成收據圖片...\n");

  // 讀取賬單數據
  const billsPath = path.join(__dirname, "../data/bills.json");
  const billsData = JSON.parse(fs.readFileSync(billsPath, "utf-8"));

  let updatedCount = 0;
  let generatedCount = 0;

  // 為每個賬單生成收據
  for (const bill of billsData) {
    console.log(`\n處理賬單: ${bill.name} (${bill.id})`);

    const payer = bill.participants.find((p) => p.id === bill.payerId);
    if (!payer) {
      console.log(`  ⚠️  找不到付款人，跳過`);
      continue;
    }

    // 計算總金額
    const totalAmount = bill.results
      ? bill.results.reduce((sum, r) => sum + (r.amount || 0), 0)
      : 0;

    // 1. 為付款人生成收據（強制重新生成 SVG）
    const payerFilename = `payer_${bill.id}.svg`;
    console.log(`  📝 生成付款人收據...`);
    generateReceiptSVG(payerFilename, {
      billName: bill.name,
      date: bill.date,
      location: bill.location,
      payerName: payer.name,
      recipientName: "商家",
      amount: totalAmount,
      transactionId: generateTransactionId(),
      timestamp: formatDateTime(bill.createdAt),
    });

    // 更新 URL（如果不同）
    const newPayerUrl = `/receipts/${payerFilename}`;
    if (bill.payerReceiptUrl !== newPayerUrl) {
      bill.payerReceiptUrl = newPayerUrl;
      updatedCount++;
    }
    generatedCount++;

    // 2. 為已支付的參與者生成收據
    if (bill.results) {
      for (const result of bill.results) {
        if (
          result.paymentStatus === "paid" &&
          result.participantId !== bill.payerId
        ) {
          const participant = bill.participants.find(
            (p) => p.id === result.participantId
          );
          if (!participant) continue;

          const receiptFilename = `receipt_${bill.id}_${result.participantId}.svg`;
          console.log(`  📝 生成 ${participant.name} 的收據...`);
          generateReceiptSVG(receiptFilename, {
            billName: bill.name,
            date: bill.date,
            location: bill.location,
            payerName: participant.name,
            recipientName: payer.name,
            amount: result.amount,
            transactionId: generateTransactionId(),
            timestamp: formatDateTime(result.paidAt || bill.createdAt),
          });

          // 更新 URL（如果不同）
          const newReceiptUrl = `/receipts/${receiptFilename}`;
          if (result.receiptImageUrl !== newReceiptUrl) {
            result.receiptImageUrl = newReceiptUrl;
            updatedCount++;
          }
          generatedCount++;
        }
      }
    }
  }

  // 保存更新後的賬單數據
  if (updatedCount > 0) {
    fs.writeFileSync(billsPath, JSON.stringify(billsData, null, 2), "utf-8");
    console.log(`\n✅ 已更新 ${updatedCount} 個賬單記錄`);
  }

  console.log(`\n🎉 完成！共生成 ${generatedCount} 張收據圖片`);
  console.log(`📁 圖片保存位置: ${receiptsDir}`);
}

// 執行
main().catch(console.error);
