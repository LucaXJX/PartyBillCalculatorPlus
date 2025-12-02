// src/billCalculator.ts
import { Bill, CalculationResult, Participant, Item } from "./types.js";

/**
 * 账单计算器核心类
 */
export class BillCalculator {
  /**
   * 计算账单分摊结果
   * @param bill 完整的账单对象
   * @returns 每个人需要支付的金额明细数组
   */
  calculate(bill: Bill): CalculationResult[] {
    // 1. 初始化每个人的消费金额为0
    const resultMap: {
      [key: string]: { amount: number; breakdown: string[] };
    } = {};
    bill.participants.forEach((p: Participant) => {
      resultMap[p.id] = { amount: 0, breakdown: [] };
    });

    // 2. 计算每个项目的金额，并分摊给相应的参与者
    bill.items.forEach((item: Item) => {
      const participantsInItem = bill.participants.filter((p: Participant) =>
        item.participantIds.includes(p.id)
      );
      const splitAmount = item.amount / participantsInItem.length;

      participantsInItem.forEach((participant: Participant) => {
        const roundedAmount = Math.round(splitAmount * 100) / 100;
        resultMap[participant.id].amount += roundedAmount;
        resultMap[participant.id].breakdown.push(
          `${item.name} (${roundedAmount.toFixed(2)})`
        );
      });
    });

    // 3. 计算小费并按比例分摊
    const subtotal = bill.items.reduce(
      (sum: number, item: Item) => sum + item.amount,
      0
    );
    
    // 計算小費總額（支持負數代表折扣）
    const totalTip = subtotal * (bill.tipPercentage / 100);

    // 只有當 subtotal 不為 0 時才計算小費分攤
    if (Math.abs(subtotal) > 0.01) {
      bill.participants.forEach((participant: Participant) => {
        const participantSubtotal = resultMap[participant.id].amount;
        const participantTip = (participantSubtotal / subtotal) * totalTip;
        const roundedTip = Math.round(participantTip * 100) / 100;

        resultMap[participant.id].amount += roundedTip;
        // 根據正負數顯示不同的標籤
        const tipLabel = roundedTip >= 0 ? "小费" : "折扣";
        resultMap[participant.id].breakdown.push(
          `${tipLabel} (${roundedTip.toFixed(2)})`
        );
      });
    } else if (Math.abs(totalTip) > 0.01) {
      // 如果 subtotal 為 0 但有小費，平均分攤給所有人
      const tipPerPerson = totalTip / bill.participants.length;
      const roundedTipPerPerson = Math.round(tipPerPerson * 100) / 100;
      bill.participants.forEach((participant: Participant) => {
        resultMap[participant.id].amount += roundedTipPerPerson;
        const tipLabel = roundedTipPerPerson >= 0 ? "小费" : "折扣";
        resultMap[participant.id].breakdown.push(
          `${tipLabel} (${roundedTipPerPerson.toFixed(2)})`
        );
      });
    }

    // 4. 处理四舍五入导致的总金额微小误差 (最多0.1元)
    const calculatedTotal = Object.values(resultMap).reduce(
      (sum, r) => sum + r.amount,
      0
    );
    const actualTotal = subtotal + totalTip;
    const difference = Math.round((actualTotal - calculatedTotal) * 100) / 100;

    if (difference !== 0 && bill.participants.length > 0) {
      const firstParticipantId = bill.participants[0].id;
      resultMap[firstParticipantId].amount += difference;
      // 调整明细，确保显示准确
      const lastBreakdown = resultMap[firstParticipantId].breakdown.pop();
      if (lastBreakdown) {
        const [label, amountStr] = lastBreakdown.split("(");
        const amount = parseFloat(amountStr.replace(")", ""));
        const newAmount = Math.round((amount + difference) * 100) / 100;
        resultMap[firstParticipantId].breakdown.push(
          `${label}(${newAmount.toFixed(2)})`
        );
      }
    }

    // 5. 格式化最终结果并返回
    return bill.participants.map((participant: Participant) => ({
      participantId: participant.id,
      amount: Math.round(resultMap[participant.id].amount * 100) / 100, // 再次确保精度
      breakdown: resultMap[participant.id].breakdown.join(" + "),
      paymentStatus: 'pending' as const,
      receiptImageUrl: undefined
    }));
  }
}
