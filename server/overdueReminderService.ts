/**
 * 逾期賬單提醒服務
 * 每天晚上 8 點檢查並發送逾期未支付賬單的提醒
 */

import { proxy } from "./proxy.js";
import { dataStorage } from "./storage.js";
import { messageManager } from "./messageManager.js";
import { MessageHelper } from "./messageHelper.js";
import type { BillRecord } from "./types.js";

interface OverdueReminder {
  userId: string;
  billId: string;
  billName: string;
  amount: number;
  daysSinceCreation: number;
  participantName: string;
}

class OverdueReminderService {
  private isRunning: boolean = false;
  private scheduledTask: NodeJS.Timeout | null = null;

  /**
   * 啟動定時提醒服務
   */
  start(): void {
    if (this.isRunning) {
      console.log("⚠️ 逾期提醒服務已在運行中");
      return;
    }

    this.isRunning = true;
    console.log("✅ 逾期提醒服務已啟動");

    // 立即執行一次（用於測試，生產環境可註釋）
    // this.checkAndSendReminders();

    // 設置定時任務：每天晚上 8 點執行
    this.scheduleDaily();
  }

  /**
   * 停止定時提醒服務
   */
  stop(): void {
    if (this.scheduledTask) {
      clearTimeout(this.scheduledTask);
      this.scheduledTask = null;
    }
    this.isRunning = false;
    console.log("⏸️ 逾期提醒服務已停止");
  }

  /**
   * 安排每天晚上 8 點執行
   */
  private scheduleDaily(): void {
    const now = new Date();
    const target = new Date();

    // 設置目標時間為今天晚上 8 點（香港時間）
    target.setHours(20, 0, 0, 0);

    // 如果今天 8 點已經過了，設置為明天 8 點
    if (now > target) {
      target.setDate(target.getDate() + 1);
    }

    const timeUntilTarget = target.getTime() - now.getTime();

    console.log(
      `📅 下次逾期檢查時間: ${target.toLocaleString("zh-TW", {
        timeZone: "Asia/Hong_Kong",
      })}`
    );

    // 設置定時器
    this.scheduledTask = setTimeout(() => {
      this.checkAndSendReminders();
      // 執行完後重新安排下一次
      this.scheduleDaily();
    }, timeUntilTarget);
  }

  /**
   * 檢查並發送逾期提醒
   */
  async checkAndSendReminders(): Promise<number> {
    console.log(
      `🔍 開始檢查逾期賬單... (${new Date().toLocaleString("zh-TW", {
        timeZone: "Asia/Hong_Kong",
      })})`
    );

    try {
      // 從數據庫讀取所有賬單（通過 proxy.bill）
      const allBills = proxy.bill;
      const now = new Date();
      let reminderCount = 0;

      // 檢查每個賬單
      for (const dbBill of allBills) {
        // 將數據庫格式轉換為 BillRecord 格式
        const bill = await this.dbBillToBillRecord(dbBill);
        if (!bill) continue;

        // 計算賬單建立日期距今天數
        const billDate = new Date(bill.createdAt);
        const daysSinceCreation = Math.floor(
          (now.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // 如果超過 7 天
        if (daysSinceCreation >= 7) {
          // 檢查每個參與者的支付狀態
          for (const result of bill.results || []) {
            // 如果是待支付狀態且不是付款人
            if (
              result.paymentStatus === "pending" &&
              result.participantId !== bill.payerId
            ) {
              // 查找參與者信息
              const participant = bill.participants.find(
                (p) => p.id === result.participantId
              );

              if (participant) {
                // 通過用戶名查找用戶 ID
                const user = await dataStorage.getUserByUsername(participant.name);
                if (!user) continue;

                // 檢查今天是否已經發送過提醒（避免重複發送）
                const todayMessages = proxy.message.filter(
                  (msg) =>
                    msg.bill_id === bill.id &&
                    msg.recipient_id === user.id &&
                    msg.type === "overdue_reminder" &&
                    this.isToday(new Date(msg.created_at))
                );

                // 如果今天還沒發送，則發送提醒
                if (todayMessages.length === 0) {
                  await MessageHelper.sendOverdueReminder(
                    bill,
                    result.participantId,
                    daysSinceCreation
                  );
                  reminderCount++;
                }
              }
            }
          }
        }
      }

      if (reminderCount > 0) {
        console.log(`📨 已發送 ${reminderCount} 條逾期提醒`);
        return reminderCount;
      } else {
        console.log("✅ 沒有需要提醒的逾期賬單");
        return 0;
      }
    } catch (error) {
      console.error("❌ 檢查逾期賬單失敗:", error);
      return 0;
    }
  }

  /**
   * 將數據庫 Bill 格式轉換為 BillRecord 格式
   */
  private async dbBillToBillRecord(dbBill: any): Promise<BillRecord | null> {
    try {
      // 獲取參與者
      const participants = proxy.bill_participant
        .filter((bp) => bp.bill_id === dbBill.id)
        .map((bp) => ({
          id: bp.participant_id,
          name: bp.participant_name,
        }));

      // 獲取項目
      const items = proxy.item
        .filter((item) => item.bill_id === dbBill.id)
        .map((item) => {
          const itemParticipants = proxy.item_participant
            .filter((ip) => ip.item_id === item.id)
            .map((ip) => ip.participant_id);

          return {
            id: item.id || "",
            name: item.name,
            amount: item.amount,
            isShared: item.is_shared === 1,
            participantIds: itemParticipants,
          };
        });

      // 獲取計算結果
      const results = proxy.calculation_result
        .filter((cr) => cr.bill_id === dbBill.id)
        .map((cr) => ({
          participantId: cr.participant_id,
          amount: cr.amount,
          breakdown: cr.breakdown || "",
          paymentStatus: cr.payment_status as "pending" | "paid" | "confirmed",
          paidAt: cr.paid_at || undefined,
          confirmedByPayer: cr.confirmed_by_payer === 1,
          receiptImageUrl: cr.receipt_image_url || undefined,
          rejectedReason: cr.rejected_reason || undefined,
          rejectedAt: cr.rejected_at || undefined,
        }));

      return {
        id: dbBill.id || "",
        name: dbBill.name,
        date: dbBill.date,
        location: dbBill.location || "",
        tipPercentage: dbBill.tip_percentage,
        participants,
        items,
        payerId: dbBill.payer_id,
        results,
        createdAt: dbBill.created_at,
        updatedAt: dbBill.updated_at,
        createdBy: dbBill.created_by,
        payerReceiptUrl: dbBill.payer_receipt_url || undefined,
      };
    } catch (error) {
      console.error("轉換賬單格式失敗:", error);
      return null;
    }
  }


  /**
   * 檢查日期是否是今天
   */
  private isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }


  /**
   * 手動觸發檢查（用於測試）
   */
  async triggerCheck(): Promise<number> {
    console.log("🧪 手動觸發逾期檢查...");
    return await this.checkAndSendReminders();
  }
}

// 創建並導出實例
export const overdueReminderService = new OverdueReminderService();
