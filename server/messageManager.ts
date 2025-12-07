// server/messageManager.ts - 消息管理模組（已遷移到數據庫）

import { proxy } from "./proxy.js";
import type { Message, MessageType } from "./types.js";

/**
 * 消息管理類（使用數據庫）
 */
export class MessageManager {
  private static instance: MessageManager;

  private constructor() {}

  static getInstance(): MessageManager {
    if (!MessageManager.instance) {
      MessageManager.instance = new MessageManager();
    }
    return MessageManager.instance;
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  }

  /**
   * 將數據庫 Message 類型轉換為應用 Message 類型
   */
  private dbToAppMessage(dbMsg: any): Message {
    return {
      id: dbMsg.id || "",
      type: dbMsg.type as MessageType,
      recipientId: dbMsg.recipient_id,
      senderId: dbMsg.sender_id || undefined,
      billId: dbMsg.bill_id || "",
      billName: dbMsg.bill_name || "",
      title: dbMsg.title || "",
      content: dbMsg.content || "",
      imageUrl: dbMsg.image_url || undefined,
      metadata: dbMsg.metadata ? JSON.parse(dbMsg.metadata) : undefined,
      isRead: dbMsg.is_read === 1,
      createdAt: dbMsg.created_at || new Date().toISOString(),
      readAt: dbMsg.read_at || undefined,
      actionable: dbMsg.actionable === 1,
      actionType: dbMsg.action_type || undefined,
      actionCompleted: dbMsg.action_completed === 1,
    };
  }

  /**
   * 將應用 Message 類型轉換為數據庫格式
   */
  private appToDbMessage(msg: Partial<Message>): any {
    const recipientId = msg.recipientId || "";
    const billId = msg.billId || "";

    // 驗證 recipient_id 是否存在於 user 表
    if (recipientId && !proxy.user.find((u) => u.id === recipientId)) {
      throw new Error(`Recipient user ${recipientId} does not exist`);
    }

    // 驗證 sender_id 是否存在（如果不為 null）
    if (msg.senderId && !proxy.user.find((u) => u.id === msg.senderId)) {
      throw new Error(`Sender user ${msg.senderId} does not exist`);
    }

    // 驗證 bill_id 是否存在（bill_id 是必填的外鍵）
    if (!billId || !proxy.bill.find((b) => b.id === billId)) {
      throw new Error(`Bill ${billId} does not exist or is empty`);
    }

    return {
      id: msg.id || this.generateId(),
      type: msg.type || "",
      recipient_id: recipientId,
      sender_id: msg.senderId || null,
      bill_id: billId,
      bill_name: msg.billName || "",
      title: msg.title || "",
      content: msg.content || "",
      image_url: msg.imageUrl || null,
      metadata: msg.metadata ? JSON.stringify(msg.metadata) : null,
      is_read: msg.isRead ? 1 : 0,
      created_at: msg.createdAt || new Date().toISOString(),
      read_at: msg.readAt || null,
      actionable: msg.actionable ? 1 : 0,
      action_type: msg.actionType || null,
      action_completed: msg.actionCompleted ? 1 : 0,
    };
  }

  /**
   * 創建新消息
   */
  async createMessage(
    messageData: Omit<Message, "id" | "createdAt" | "isRead">
  ): Promise<Message> {
    const dbMessage = this.appToDbMessage({
      ...messageData,
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    proxy.message.push(dbMessage);

    return this.dbToAppMessage(dbMessage);
  }

  /**
   * 批量創建消息（用於通知多個參與者）
   */
  async createBulkMessages(
    recipientIds: string[],
    messageData: Omit<Message, "id" | "createdAt" | "isRead" | "recipientId">
  ): Promise<Message[]> {
    const createdMessages: Message[] = [];

    for (const recipientId of recipientIds) {
      const message = await this.createMessage({
        ...messageData,
        recipientId,
      });
      createdMessages.push(message);
    }

    return createdMessages;
  }

  /**
   * 獲取用戶的所有消息
   */
  async getUserMessages(userId: string): Promise<Message[]> {
    const dbMessages = proxy.message.filter(
      (msg) => msg.recipient_id === userId
    );
    return dbMessages.map((msg) => this.dbToAppMessage(msg));
  }

  /**
   * 獲取用戶的未讀消息
   */
  async getUnreadMessages(userId: string): Promise<Message[]> {
    const dbMessages = proxy.message.filter(
      (msg) => msg.recipient_id === userId && msg.is_read === 0
    );
    return dbMessages.map((msg) => this.dbToAppMessage(msg));
  }

  /**
   * 獲取未讀消息數量
   */
  async getUnreadCount(userId: string): Promise<number> {
    const unreadMessages = await this.getUnreadMessages(userId);
    return unreadMessages.length;
  }

  /**
   * 標記消息為已讀
   */
  async markAsRead(messageId: string): Promise<boolean> {
    const message = proxy.message.find((msg) => msg.id === messageId);

    if (!message) {
      return false;
    }

    message.is_read = 1;
    message.read_at = new Date().toISOString();

    return true;
  }

  /**
   * 批量標記消息為已讀
   */
  async markMultipleAsRead(messageIds: string[]): Promise<number> {
    let updatedCount = 0;

    messageIds.forEach((id) => {
      const message = proxy.message.find((msg) => msg.id === id);
      if (message && message.is_read === 0) {
        message.is_read = 1;
        message.read_at = new Date().toISOString();
        updatedCount++;
      }
    });

    return updatedCount;
  }

  /**
   * 標記所有消息為已讀
   */
  async markAllAsRead(userId: string): Promise<number> {
    let updatedCount = 0;

    proxy.message.forEach((msg) => {
      if (msg.recipient_id === userId && msg.is_read === 0) {
        msg.is_read = 1;
        msg.read_at = new Date().toISOString();
        updatedCount++;
      }
    });

    return updatedCount;
  }

  /**
   * 刪除消息
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    const messageIndex = proxy.message.findIndex((msg) => msg.id === messageId);

    if (messageIndex === -1) {
      return false;
    }

    proxy.message.splice(messageIndex, 1);
    return true;
  }

  /**
   * 標記操作已完成
   */
  async markActionCompleted(messageId: string): Promise<boolean> {
    const message = proxy.message.find((msg) => msg.id === messageId);

    if (!message) {
      return false;
    }

    message.action_completed = 1;
    return true;
  }

  /**
   * 獲取特定賬單的消息
   */
  async getBillMessages(billId: string, userId?: string): Promise<Message[]> {
    let dbMessages = proxy.message.filter((msg) => msg.bill_id === billId);

    if (userId) {
      dbMessages = dbMessages.filter((msg) => msg.recipient_id === userId);
    }

    return dbMessages.map((msg) => this.dbToAppMessage(msg));
  }
}

// 導出單例
export const messageManager = MessageManager.getInstance();
