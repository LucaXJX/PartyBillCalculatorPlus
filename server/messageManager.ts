// server/messageManager.ts - 消息管理模組

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Message, MessageType } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "../data");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

/**
 * 確保數據目錄和文件存在
 */
const ensureMessagesFile = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, "[]", "utf8");
  }
};

/**
 * 消息管理類
 */
export class MessageManager {
  private static instance: MessageManager;

  private constructor() {
    ensureMessagesFile();
  }

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
   * 加載所有消息
   */
  async loadMessages(): Promise<Message[]> {
    ensureMessagesFile();
    try {
      const data = fs.readFileSync(MESSAGES_FILE, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Error loading messages:", error);
      return [];
    }
  }

  /**
   * 保存消息
   */
  private async saveMessages(messages: Message[]): Promise<void> {
    ensureMessagesFile();
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), "utf8");
  }

  /**
   * 創建新消息
   */
  async createMessage(
    messageData: Omit<Message, "id" | "createdAt" | "isRead">
  ): Promise<Message> {
    const messages = await this.loadMessages();

    const newMessage: Message = {
      id: this.generateId(),
      isRead: false,
      createdAt: new Date().toISOString(),
      ...messageData,
    };

    messages.unshift(newMessage); // 新消息放在最前面
    await this.saveMessages(messages);

    return newMessage;
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
    const messages = await this.loadMessages();
    return messages.filter((msg) => msg.recipientId === userId);
  }

  /**
   * 獲取用戶的未讀消息
   */
  async getUnreadMessages(userId: string): Promise<Message[]> {
    const messages = await this.getUserMessages(userId);
    return messages.filter((msg) => !msg.isRead);
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
    const messages = await this.loadMessages();
    const messageIndex = messages.findIndex((msg) => msg.id === messageId);

    if (messageIndex === -1) {
      return false;
    }

    messages[messageIndex].isRead = true;
    messages[messageIndex].readAt = new Date().toISOString();

    await this.saveMessages(messages);
    return true;
  }

  /**
   * 批量標記消息為已讀
   */
  async markMultipleAsRead(messageIds: string[]): Promise<number> {
    const messages = await this.loadMessages();
    let updatedCount = 0;

    messageIds.forEach((id) => {
      const messageIndex = messages.findIndex((msg) => msg.id === id);
      if (messageIndex !== -1 && !messages[messageIndex].isRead) {
        messages[messageIndex].isRead = true;
        messages[messageIndex].readAt = new Date().toISOString();
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      await this.saveMessages(messages);
    }

    return updatedCount;
  }

  /**
   * 標記所有消息為已讀
   */
  async markAllAsRead(userId: string): Promise<number> {
    const messages = await this.loadMessages();
    let updatedCount = 0;

    messages.forEach((msg) => {
      if (msg.recipientId === userId && !msg.isRead) {
        msg.isRead = true;
        msg.readAt = new Date().toISOString();
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      await this.saveMessages(messages);
    }

    return updatedCount;
  }

  /**
   * 刪除消息
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    const messages = await this.loadMessages();
    const initialLength = messages.length;
    const filteredMessages = messages.filter((msg) => msg.id !== messageId);

    if (filteredMessages.length < initialLength) {
      await this.saveMessages(filteredMessages);
      return true;
    }

    return false;
  }

  /**
   * 標記操作已完成
   */
  async markActionCompleted(messageId: string): Promise<boolean> {
    const messages = await this.loadMessages();
    const messageIndex = messages.findIndex((msg) => msg.id === messageId);

    if (messageIndex === -1) {
      return false;
    }

    messages[messageIndex].actionCompleted = true;
    await this.saveMessages(messages);
    return true;
  }

  /**
   * 獲取特定賬單的消息
   */
  async getBillMessages(billId: string, userId?: string): Promise<Message[]> {
    const messages = await this.loadMessages();
    return messages.filter(
      (msg) => msg.billId === billId && (!userId || msg.recipientId === userId)
    );
  }
}

// 導出單例
export const messageManager = MessageManager.getInstance();
