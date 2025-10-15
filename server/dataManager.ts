// src/dataManager.ts
import { Bill, Participant, Item } from "./types.js";
// 持久化功能已整合到 storage.ts 中

// 生成唯一ID的简单工具函数
const generateId = () => Math.random().toString(36).substring(2, 9);

export class DataManager {
  private currentBill: Bill;
  private userId: string | null = null;

  constructor(userId?: string) {
    this.userId = userId || null;
    // 初始化一个新账单
    this.currentBill = {
      id: generateId(),
      name: "",
      date: new Date().toISOString().split("T")[0], // 默认今天
      location: "",
      tipPercentage: 0,
      participants: [],
      items: [],
      payerId: "", // 初始化為空字串
    };
  }

  // 設置用戶ID
  setUserId(userId: string) {
    this.userId = userId;
  }

  // 獲取用戶ID
  getUserId(): string | null {
    return this.userId;
  }

  reset() {
    this.currentBill = {
      id: generateId(),
      name: "",
      date: new Date().toISOString().split("T")[0],
      location: "",
      tipPercentage: 0,
      participants: [],
      items: [],
      payerId: "", // 初始化為空字串
    };
  }

  // --- 账单信息操作 ---
  updateBillInfo(
    name: string,
    date: string,
    location: string,
    tipPercentage: number,
    payerId?: string
  ): void {
    this.currentBill.name = name;
    this.currentBill.date = date;
    this.currentBill.location = location;
    this.currentBill.tipPercentage = tipPercentage;
    if (payerId) {
      this.currentBill.payerId = payerId;
    }
  }

  // --- 参与者操作 ---
  addParticipant(name: string): Participant {
    // 檢查是否已存在相同名稱的參與者
    const existingParticipant = this.currentBill.participants.find(
      (p) => p.name === name
    );

    if (existingParticipant) {
      return existingParticipant;
    }

    const newParticipant: Participant = { id: generateId(), name };
    this.currentBill.participants.push(newParticipant);
    return newParticipant;
  }

  removeParticipant(id: string): void {
    this.currentBill.participants = this.currentBill.participants.filter(
      (p: Participant) => p.id !== id
    );
    // 同时从项目中移除该参与者
    this.currentBill.items.forEach((item: Item) => {
      item.participantsIds = item.participantsIds.filter(
        (pId: string) => pId !== id
      );
    });
  }

  // --- 项目操作 ---
  addItem(
    name: string,
    amount: number,
    isShared: boolean,
    participantIds: string[]
  ): Item {
    const newItem: Item = {
      id: generateId(),
      name: name,
      amount: amount,
      isShared: isShared,
      participantsIds: participantIds,
    };
    this.currentBill.items.push(newItem);
    return newItem;
  }

  removeItem(id: string): void {
    this.currentBill.items = this.currentBill.items.filter(
      (i: Item) => i.id !== id
    );
  }

  updateItemParticipants(itemId: string, participantIds: string[]): void {
    const item = this.currentBill.items.find((i: Item) => i.id === itemId);
    if (item) {
      item.participantsIds = participantIds;
    }
  }

  // --- 数据持久化 ---
  saveAsDraft(): void {
    // 持久化功能已移至 storage.ts，此方法保留用於未來擴展
    console.log("保存草稿功能已移至 storage.ts");
  }

  // --- 获取当前账单 ---
  getCurrentBill(): Bill {
    return { ...this.currentBill }; // 返回一个副本，防止外部直接修改
  }
}
