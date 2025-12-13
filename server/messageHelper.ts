// server/messageHelper.ts - 消息內容生成助手

import type { BillRecord, Message, MessageType } from "./types.js";
import { messageManager } from "./messageManager.js";
import { dataStorage } from "./storage.js";

/**
 * 消息助手類 - 用於生成和發送各種類型的消息
 */
export class MessageHelper {
  /**
   * 新建賬單時發送通知給所有參與者（除了創建者）
   */
  static async sendNewBillNotifications(bill: BillRecord): Promise<void> {
    // #region agent log
    try {
      const fs = await import('fs');
      const logPath = 'c:\\Users\\Lucas\\OneDrive\\文档\\Code\\dae-2025-4\\.cursor\\debug.log';
      const logData = {
        location: 'messageHelper.ts:14',
        message: 'Before sendNewBillNotifications - H17',
        data: {
          billId: bill.id,
          billName: bill.name,
          createdBy: bill.createdBy,
          payerId: bill.payerId,
          participantsCount: bill.participants.length,
          participants: bill.participants.map((p: any) => ({ id: p.id, name: p.name })),
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H17'
      };
      fs.appendFileSync(logPath, JSON.stringify(logData) + '\n');
    } catch (e) {}
    // #endregion
    
    // 獲取創建者信息
    const creator = await dataStorage.getUserById(bill.createdBy);
    if (!creator) {
      console.error(`❌ 找不到創建者用戶: ${bill.createdBy}`);
      return;
    }

    // 獲取所有需要付款的參與者（排除付款人/創建者自己）
    const participantUserIds: string[] = [];

    for (const participant of bill.participants) {
      // 跳過付款人（創建者），因為付款人是收款人，不需要收到通知
      if (participant.id === bill.payerId) {
        console.log(`跳過付款人參與者: ${participant.name} (${participant.id})`);
        continue;
      }

      const user = await dataStorage.getUserByUsername(participant.name);
      if (user) {
        // 獲取該參與者的應付金額
        const result = bill.results.find(
          (r) => r.participantId === participant.id
        );
        if (result) {
          participantUserIds.push(user.id);
          console.log(`✅ 將為參與者 ${participant.name} (${user.id}) 創建消息`);
        } else {
          console.warn(`⚠️  參與者 ${participant.name} 沒有對應的計算結果`);
        }
      } else {
        console.warn(`⚠️  找不到參與者用戶: ${participant.name}`);
      }
    }

    if (participantUserIds.length === 0) {
      console.warn(`⚠️  沒有需要通知的參與者`);
      return;
    }

    // 為每個參與者創建個性化消息（包含各自的應付金額）
    for (const userId of participantUserIds) {
      const user = await dataStorage.getUserById(userId);
      if (!user) {
        console.warn(`⚠️  找不到用戶: ${userId}`);
        continue;
      }

      const participant = bill.participants.find(
        (p) => p.name === user.username
      );
      if (!participant) {
        console.warn(`⚠️  找不到參與者: ${user.username}`);
        continue;
      }

      const result = bill.results.find(
        (r) => r.participantId === participant.id
      );
      if (!result) {
        console.warn(`⚠️  找不到計算結果: ${participant.id}`);
        continue;
      }

      try {
        await messageManager.createMessage({
          type: "new_bill",
          senderId: creator.id,
          recipientId: userId,
          billId: bill.id,
          billName: bill.name,
          title: `💰 新待支付賬單：${bill.name}`,
          content: `${creator.username} 創建了一筆賬單「${bill.name}」（${
            bill.location
          }），您需要支付 $${result.amount.toFixed(2)}。請盡快完成付款。`,
          imageUrl: bill.payerReceiptUrl,
          metadata: {
            participantId: participant.id,
            amount: result.amount,
          },
          actionable: false,
        });
        console.log(`✅ 已為 ${user.username} (${userId}) 創建新賬單消息`);
      } catch (error: any) {
        console.error(`❌ 為 ${user.username} 創建消息失敗:`, error?.message || error);
      }
    }
  }

  /**
   * 付款後通知收款人（付款人）
   */
  static async sendPaymentSubmittedNotification(
    bill: BillRecord,
    participantId: string,
    receiptUrl?: string
  ): Promise<void> {
    // 如果付款人就是收款人自己，不發送通知
    if (participantId === bill.payerId) {
      console.log(`跳過通知：付款人 ${participantId} 就是收款人自己`);
      return;
    }

    // 獲取收款人信息（使用 payerId，如果沒有則使用 createdBy）
    const payerId = bill.payerId || bill.createdBy;
    if (!payerId) {
      console.error("無法確定收款人：賬單缺少 payerId 和 createdBy");
      return;
    }

    // 根據 payerId 找到對應的參與者
    const payerParticipant = bill.participants.find((p) => p.id === payerId);
    if (!payerParticipant) {
      console.error(`找不到付款人參與者：${payerId}`);
      return;
    }

    // 獲取收款人的用戶信息
    const payerUser = await dataStorage.getUserByUsername(
      payerParticipant.name
    );
    if (!payerUser) {
      console.error(`找不到收款人用戶：${payerParticipant.name}`);
      return;
    }

    // 獲取付款參與者信息
    const participant = bill.participants.find((p) => p.id === participantId);
    if (!participant) return;

    const participantUser = await dataStorage.getUserByUsername(
      participant.name
    );
    if (!participantUser) return;

    // 獲取付款金額
    const result = bill.results.find((r) => r.participantId === participantId);
    if (!result) return;

    // 創建消息
    await messageManager.createMessage({
      type: "payment_submitted",
      senderId: participantUser.id,
      recipientId: payerUser.id,
      billId: bill.id,
      billName: bill.name,
      title: `💰 收到付款：${bill.name}`,
      content: `${
        participant.name
      } 已提交付款憑證，金額：$${result.amount.toFixed(2)}。請確認收款。`,
      imageUrl: receiptUrl,
      metadata: {
        participantId,
        amount: result.amount,
        paymentStatus: "paid",
      },
      actionable: true,
      actionType: "confirm_payment",
      actionCompleted: false,
    });
  }

  /**
   * 收款確認後通知付款人
   */
  static async sendPaymentConfirmedNotification(
    bill: BillRecord,
    participantId: string
  ): Promise<void> {
    // #region agent log
    try {
      const fs = await import('fs');
      const logPath = 'c:\\Users\\Lucas\\OneDrive\\文档\\Code\\dae-2025-4\\.cursor\\debug.log';
      const logData = {
        location: 'messageHelper.ts:151',
        message: 'Before sendPaymentConfirmedNotification - H18',
        data: {
          billId: bill.id,
          participantId,
          payerId: bill.payerId,
          createdBy: bill.createdBy,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H18'
      };
      fs.appendFileSync(logPath, JSON.stringify(logData) + '\n');
    } catch (e) {}
    // #endregion
    
    // 獲取收款人信息（使用 payerId，如果沒有則使用 createdBy）
    const payerId = bill.payerId || bill.createdBy;
    if (!payerId) {
      console.error(`❌ 無法確定收款人：賬單 ${bill.id} 缺少 payerId 和 createdBy`);
      return;
    }

    const payerParticipant = bill.participants.find((p) => p.id === payerId);
    if (!payerParticipant) {
      console.error(`❌ 找不到收款人參與者: ${payerId}`);
      return;
    }

    const payerUser = await dataStorage.getUserByUsername(
      payerParticipant.name
    );
    if (!payerUser) {
      console.error(`❌ 找不到收款人用戶: ${payerParticipant.name}`);
      return;
    }

    // 獲取參與者信息（付款人）
    const participant = bill.participants.find((p) => p.id === participantId);
    if (!participant) {
      console.error(`❌ 找不到參與者: ${participantId}`);
      return;
    }

    const participantUser = await dataStorage.getUserByUsername(
      participant.name
    );
    if (!participantUser) {
      console.error(`❌ 找不到參與者用戶: ${participant.name}`);
      return;
    }

    // 獲取付款金額
    const result = bill.results.find((r) => r.participantId === participantId);
    if (!result) {
      console.error(`❌ 找不到計算結果: ${participantId}`);
      return;
    }

    // 創建消息
    try {
      await messageManager.createMessage({
        type: "payment_confirmed",
        senderId: payerUser.id,
        recipientId: participantUser.id,
        billId: bill.id,
        billName: bill.name,
        title: `✅ 收款已確認：${bill.name}`,
        content: `${
          payerUser.username
        } 已確認收到您的付款，金額：$${result.amount.toFixed(2)}。感謝您的付款！`,
        metadata: {
          participantId,
          amount: result.amount,
        },
        actionable: false,
      });
      console.log(`✅ 已為 ${participantUser.username} (${participantUser.id}) 創建收款確認消息`);
    } catch (error: any) {
      console.error(`❌ 創建收款確認消息失敗:`, error?.message || error);
    }
  }

  /**
   * 收款拒絕後通知付款人
   */
  static async sendPaymentRejectedNotification(
    bill: BillRecord,
    participantId: string,
    reason: string
  ): Promise<void> {
    // 獲取收款人信息（使用 payerId，如果沒有則使用 createdBy）
    const payerId = bill.payerId || bill.createdBy;
    if (!payerId) return;

    const payerParticipant = bill.participants.find((p) => p.id === payerId);
    if (!payerParticipant) return;

    const payerUser = await dataStorage.getUserByUsername(
      payerParticipant.name
    );
    if (!payerUser) return;

    // 獲取參與者信息
    const participant = bill.participants.find((p) => p.id === participantId);
    if (!participant) return;

    const participantUser = await dataStorage.getUserByUsername(
      participant.name
    );
    if (!participantUser) return;

    // 獲取付款金額
    const result = bill.results.find((r) => r.participantId === participantId);
    if (!result) return;

    // 翻譯拒絕原因
    const reasonText =
      reason === "not_received" ? "未收到款項" : "錯誤的付款憑證";

    // 創建消息
    await messageManager.createMessage({
      type: "payment_rejected",
      senderId: payerUser.id,
      recipientId: participantUser.id,
      billId: bill.id,
      billName: bill.name,
      title: `⚠️ 付款被拒絕：${bill.name}`,
      content: `${
        payerUser.username
      } 拒絕了您的付款，原因：${reasonText}。金額：$${result.amount.toFixed(
        2
      )}，請重新提交付款憑證。`,
      metadata: {
        participantId,
        amount: result.amount,
      },
      actionable: false,
    });
  }

  /**
   * 發送逾期提醒
   */
  static async sendOverdueReminder(
    bill: BillRecord,
    participantId: string,
    daysOverdue: number
  ): Promise<void> {
    // 獲取參與者信息
    const participant = bill.participants.find((p) => p.id === participantId);
    if (!participant) return;

    const participantUser = await dataStorage.getUserByUsername(
      participant.name
    );
    if (!participantUser) return;

    // 獲取付款金額
    const result = bill.results.find((r) => r.participantId === participantId);
    if (!result || result.paymentStatus !== "pending") return;

    // 創建消息
    await messageManager.createMessage({
      type: "overdue_reminder",
      recipientId: participantUser.id,
      billId: bill.id,
      billName: bill.name,
      title: `⏰ 付款提醒：${bill.name}`,
      content: `您有一筆賬單「${
        bill.name
      }」已逾期 ${daysOverdue} 天，金額：$${result.amount.toFixed(
        2
      )}，請盡快完成付款。`,
      imageUrl: bill.payerReceiptUrl,
      metadata: {
        participantId,
        amount: result.amount,
        daysOverdue,
      },
      actionable: false,
    });
  }

  /**
   * 檢查並發送所有逾期提醒（定時任務調用）
   * 注意：此方法需要在定時任務中調用，暫時註釋以避免編譯錯誤
   */
  static async checkAndSendOverdueReminders(): Promise<void> {
    // TODO: 實現定時任務功能
    // 由於 dataStorage.loadBills() 是私有方法，需要添加公共方法或使用其他方式獲取賬單
    console.log("逾期提醒檢查功能尚未實現，需要配置定時任務");
  }
}
