/**
 * 逾期賬單提醒服務
 * 每天晚上 8 點檢查並發送逾期未支付賬單的提醒
 */

import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { Message, Bill, User } from "./types.js";

// 解決 ES6 模塊中的 __dirname 問題
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface OverdueReminder {
  userId: string;
  billId: string;
  billName: string;
  amount: number;
  daysSinceCreation: number;
  participantName: string;
}

class OverdueReminderService {
  private dataPath: string;
  private isRunning: boolean = false;
  private scheduledTask: NodeJS.Timeout | null = null;

  constructor() {
    this.dataPath = path.join(__dirname, "../data");
  }

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
      // 讀取數據
      const bills = await this.loadBills();
      const messages = await this.loadMessages();

      const now = new Date();
      const overdueReminders: OverdueReminder[] = [];

      // 檢查每個賬單
      for (const bill of bills) {
        // 跳過已完成或已取消的賬單
        if (bill.status === "completed" || bill.status === "cancelled") {
          continue;
        }

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
                (p: any) => p.id === result.participantId
              );

              if (participant && participant.userId) {
                // 檢查今天是否已經發送過提醒（避免重複發送）
                const todayReminder = messages.find(
                  (msg: any) =>
                    msg.billId === bill.id &&
                    msg.recipientId === participant.userId &&
                    msg.type === "overdue_reminder" &&
                    this.isToday(new Date(msg.createdAt))
                );

                // 如果今天還沒發送，則添加到提醒列表
                if (!todayReminder) {
                  overdueReminders.push({
                    userId: participant.userId,
                    billId: bill.id,
                    billName: bill.name || "未命名聚會",
                    amount: result.amount,
                    daysSinceCreation,
                    participantName: participant.name,
                  });
                }
              }
            }
          }
        }
      }

      // 發送提醒
      if (overdueReminders.length > 0) {
        await this.sendReminders(overdueReminders, messages);
        console.log(`📨 已發送 ${overdueReminders.length} 條逾期提醒`);
        return overdueReminders.length;
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
   * 發送提醒消息
   */
  private async sendReminders(
    reminders: OverdueReminder[],
    existingMessages: any[]
  ): Promise<any[]> {
    const newMessages = [];

    for (const reminder of reminders) {
      const message = {
        id: this.generateMessageId(),
        recipientId: reminder.userId, // 使用 recipientId 而不是 userId
        billId: reminder.billId,
        type: "overdue_reminder",
        title: "⏰ 逾期未支付提醒",
        content: `您在賬單「${
          reminder.billName
        }」中的分攤金額 $${reminder.amount.toFixed(2)} 已逾期 ${
          reminder.daysSinceCreation
        } 天未支付。請盡快完成支付，避免影響其他參與者。`,
        actionText: "前往支付",
        actionUrl: `/my-bills.html?billId=${reminder.billId}&highlight=true`,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      newMessages.push(message);
    }

    // 合併到現有消息
    const allMessages = [...existingMessages, ...newMessages];

    // 保存到文件
    await this.saveMessages(allMessages);

    return newMessages;
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
   * 生成消息 ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 讀取賬單數據
   */
  private async loadBills(): Promise<any[]> {
    try {
      const data = await fs.readFile(
        path.join(this.dataPath, "bills.json"),
        "utf-8"
      );
      return JSON.parse(data);
    } catch (error) {
      console.error("讀取賬單數據失敗:", error);
      return [];
    }
  }

  /**
   * 讀取消息數據
   */
  private async loadMessages(): Promise<any[]> {
    try {
      const data = await fs.readFile(
        path.join(this.dataPath, "messages.json"),
        "utf-8"
      );
      return JSON.parse(data);
    } catch (error) {
      console.error("讀取消息數據失敗:", error);
      return [];
    }
  }

  /**
   * 保存消息數據
   */
  private async saveMessages(messages: any[]): Promise<void> {
    try {
      await fs.writeFile(
        path.join(this.dataPath, "messages.json"),
        JSON.stringify(messages, null, 2),
        "utf-8"
      );
      console.log("✅ 消息數據已保存");
    } catch (error) {
      console.error("保存消息數據失敗:", error);
      throw error;
    }
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
