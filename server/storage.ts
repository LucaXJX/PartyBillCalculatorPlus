// server/storage.ts

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Bill, Participant, Item, CalculationResult } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 數據存儲路徑
const DATA_DIR = path.join(__dirname, "../data");
const BILLS_FILE = path.join(DATA_DIR, "bills.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// 確保數據目錄存在
const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

// 用戶相關接口
export interface User {
  id: string;
  username: string;
  email: string;
  password: string; // 實際應用中應該加密
  createdAt: string;
  lastLogin?: string;
}

export interface UserSession {
  userId: string;
  sessionId: string;
  expiresAt: string;
}

// 完整的賬單記錄（包含計算結果）
export interface BillRecord extends Bill {
  results: CalculationResult[];
  createdAt: string;
  updatedAt: string;
  createdBy: string; // 用戶ID
}

// 數據存儲類
export class DataStorage {
  private static instance: DataStorage;
  private sessions: Map<string, UserSession> = new Map();

  private constructor() {
    ensureDataDir();
  }

  public static getInstance(): DataStorage {
    if (!DataStorage.instance) {
      DataStorage.instance = new DataStorage();
    }
    return DataStorage.instance;
  }

  // === 用戶管理 ===

  async saveUser(user: User): Promise<void> {
    const users = await this.loadUsers();
    const existingIndex = users.findIndex(
      (u) => u.id === user.id || u.email === user.email
    );

    if (existingIndex !== -1) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }

    await this.saveUsers(users);
  }

  async getUserById(id: string): Promise<User | null> {
    const users = await this.loadUsers();
    return users.find((u) => u.id === id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const users = await this.loadUsers();
    return users.find((u) => u.email === email) || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const users = await this.loadUsers();
    return users.find((u) => u.username === username) || null;
  }

  private async loadUsers(): Promise<User[]> {
    ensureDataDir();
    if (!fs.existsSync(USERS_FILE)) {
      return [];
    }

    try {
      const data = fs.readFileSync(USERS_FILE, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Error loading users:", error);
      return [];
    }
  }

  private async saveUsers(users: User[]): Promise<void> {
    ensureDataDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  }

  // === 賬單管理 ===

  async saveBill(billRecord: BillRecord): Promise<void> {
    const bills = await this.loadBills();
    const existingIndex = bills.findIndex((b) => b.id === billRecord.id);

    if (existingIndex !== -1) {
      bills[existingIndex] = {
        ...billRecord,
        updatedAt: new Date().toISOString(),
      };
    } else {
      bills.push(billRecord);
    }

    await this.saveBills(bills);
  }

  async getBillById(id: string): Promise<BillRecord | null> {
    const bills = await this.loadBills();
    return bills.find((b) => b.id === id) || null;
  }

  async getBillsByUser(userId: string): Promise<BillRecord[]> {
    const bills = await this.loadBills();
    return bills.filter((b) => b.createdBy === userId);
  }

  async deleteBill(id: string): Promise<boolean> {
    const bills = await this.loadBills();
    const initialLength = bills.length;
    const filteredBills = bills.filter((b) => b.id !== id);

    if (filteredBills.length < initialLength) {
      await this.saveBills(filteredBills);
      return true;
    }
    return false;
  }

  private async loadBills(): Promise<BillRecord[]> {
    ensureDataDir();
    if (!fs.existsSync(BILLS_FILE)) {
      return [];
    }

    try {
      const data = fs.readFileSync(BILLS_FILE, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Error loading bills:", error);
      return [];
    }
  }

  private async saveBills(bills: BillRecord[]): Promise<void> {
    ensureDataDir();
    fs.writeFileSync(BILLS_FILE, JSON.stringify(bills, null, 2), "utf8");
  }

  // === 會話管理 ===

  async createSession(userId: string): Promise<string> {
    const sessionId = this.generateId();
    const session: UserSession = {
      userId,
      sessionId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24小時後過期
    };

    // 這裡可以存儲到文件或內存中
    // 為了簡單起見，我們使用內存存儲
    this.sessions.set(sessionId, session);

    return sessionId;
  }

  async validateSession(sessionId: string): Promise<User | null> {
    const session = this.sessions.get(sessionId);
    if (!session || new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return await this.getUserById(session.userId);
  }

  async destroySession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  // 獲取所有用戶
  async getAllUsers(): Promise<User[]> {
    ensureDataDir();
    if (!fs.existsSync(USERS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(USERS_FILE, "utf8");
    return JSON.parse(data);
  }

  // 搜尋用戶
  async searchUsers(query: string): Promise<User[]> {
    const users = await this.getAllUsers();
    const lowercaseQuery = query.toLowerCase();

    return users.filter(
      (user: User) =>
        user.username.toLowerCase().includes(lowercaseQuery) ||
        user.email.toLowerCase().includes(lowercaseQuery) ||
        user.email.split("@")[0].toLowerCase().includes(lowercaseQuery)
    );
  }

  // 獲取用戶的賬單列表
  async getUserBills(userId: string): Promise<BillRecord[]> {
    ensureDataDir();
    if (!fs.existsSync(BILLS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(BILLS_FILE, "utf8");
    const allBills: BillRecord[] = JSON.parse(data);

    // 返回該用戶創建或參與的賬單
    return allBills.filter(
      (bill) =>
        bill.createdBy === userId ||
        bill.participants.some((p) => p.id === userId)
    );
  }

  // 更新支付狀態
  async updatePaymentStatus(
    billId: string,
    participantId: string,
    paymentStatus: "pending" | "paid",
    receiptImageUrl?: string
  ): Promise<void> {
    ensureDataDir();
    if (!fs.existsSync(BILLS_FILE)) {
      throw new Error("賬單文件不存在");
    }

    const data = fs.readFileSync(BILLS_FILE, "utf8");
    const bills: BillRecord[] = JSON.parse(data);

    const billIndex = bills.findIndex((bill) => bill.id === billId);
    if (billIndex === -1) {
      throw new Error("找不到指定的賬單");
    }

    const bill = bills[billIndex];

    // 更新結果中的支付狀態
    if (bill.results) {
      const resultIndex = bill.results.findIndex(
        (r) => r.participantId === participantId
      );
      if (resultIndex !== -1) {
        bill.results[resultIndex].paymentStatus = paymentStatus;
        if (receiptImageUrl) {
          bill.results[resultIndex].receiptImageUrl = receiptImageUrl;
        }
      }
    }

    bill.updatedAt = new Date().toISOString();

    // 保存更新後的數據
    fs.writeFileSync(BILLS_FILE, JSON.stringify(bills, null, 2));
  }

  // 更新賬單收據（付款人上傳付款憑證）
  async updateBillReceipt(
    billId: string,
    receiptImageUrl: string
  ): Promise<void> {
    ensureDataDir();
    if (!fs.existsSync(BILLS_FILE)) {
      throw new Error("賬單文件不存在");
    }

    const data = fs.readFileSync(BILLS_FILE, "utf8");
    const bills: BillRecord[] = JSON.parse(data);

    const billIndex = bills.findIndex((bill) => bill.id === billId);
    if (billIndex === -1) {
      throw new Error("找不到指定的賬單");
    }

    const bill = bills[billIndex];

    // 保存付款人的收據
    (bill as any).payerReceiptUrl = receiptImageUrl;
    bill.updatedAt = new Date().toISOString();

    // 保存更新後的數據
    fs.writeFileSync(BILLS_FILE, JSON.stringify(bills, null, 2));
  }

  // 確認收款（付款人確認收到其他人的付款）
  async confirmPayment(
    billId: string,
    participantId: string,
    confirmed: boolean
  ): Promise<void> {
    ensureDataDir();
    if (!fs.existsSync(BILLS_FILE)) {
      throw new Error("賬單文件不存在");
    }

    const data = fs.readFileSync(BILLS_FILE, "utf8");
    const bills: BillRecord[] = JSON.parse(data);

    const billIndex = bills.findIndex((bill) => bill.id === billId);
    if (billIndex === -1) {
      throw new Error("找不到指定的賬單");
    }

    const bill = bills[billIndex];

    // 更新結果中的確認狀態
    if (bill.results) {
      const resultIndex = bill.results.findIndex(
        (r) => r.participantId === participantId
      );
      if (resultIndex !== -1) {
        bill.results[resultIndex].confirmedByPayer = confirmed;
      }
    }

    bill.updatedAt = new Date().toISOString();

    // 保存更新後的數據
    fs.writeFileSync(BILLS_FILE, JSON.stringify(bills, null, 2));
  }

  // === 工具函數 ===

  private generateId(): string {
    return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  }
}

// 導出單例實例
export const dataStorage = DataStorage.getInstance();
