// src/types.ts

/**
 * 参与者类型定义
 */
export interface Participant {
  id: string; // 唯一标识符，方便查找和操作
  name: string;
}

/**
 * 消费项目类型定义
 */
export interface Item {
  id: string;
  name: string;
  amount: number;
  isShared: boolean;
  participantsIds: string[]; // 参与此项目的人的ID列表
  receiptImageUrl?: string; // 收据图片URL，可选
}

/**
 * 账单的计算结果类型定义
 */
export interface CalculationResult {
  participantId: string;
  amount: number;
  breakdown: string; // 费用明细的文本描述，如 "汉堡套餐 (60.00) + 小费 (6.90)"
  paymentStatus: "pending" | "paid"; // 支付状态
  receiptImageUrl?: string; // 支付凭证图片URL
}

/**
 * 完整账单对象的类型定义
 */
export interface Bill {
  id: string;
  name: string;
  date: string;
  location: string;
  tipPercentage: number;
  participants: Participant[];
  items: Item[];
  payerId?: string; // 付款人ID，可选
  // 计算结果可以是动态计算的，不一定需要存储
}
