// server/types.ts - 類型定義

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  createdAt: string;
}

export interface Participant {
  id: string;
  name: string;
}

export interface Item {
  id: string;
  name: string;
  amount: number;
  isShared: boolean;
  participantsIds: string[];
}

// 基礎賬單結構（計算前）
export interface Bill {
  id: string;
  name: string;
  date: string;
  location: string;
  tipPercentage: number;
  participants: Participant[];
  items: Item[];
  payerId: string;
}

// 計算結果
export interface CalculationResult {
  participantId: string;
  amount: number;
  breakdown: string;
  paymentStatus?: "pending" | "paid" | "confirmed";
  paidAt?: string;
  confirmedByPayer?: boolean;
  receiptImageUrl?: string;
  rejectedReason?: string;
  rejectedAt?: string;
}

// 支付結果（擴展版）
export interface PaymentResult extends CalculationResult {
  paymentStatus: "pending" | "paid" | "confirmed";
}

// 完整的賬單記錄（包含計算結果）
export interface BillRecord extends Bill {
  results: PaymentResult[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  payerReceiptUrl?: string;
}

// 消息類型定義
export type MessageType =
  | "new_bill" // 新建賬單通知
  | "payment_submitted" // 付款提交通知
  | "payment_confirmed" // 收款確認通知
  | "payment_rejected" // 收款拒絕通知
  | "overdue_reminder"; // 逾期提醒

export interface Message {
  id: string;
  type: MessageType;
  recipientId: string; // 接收者用戶 ID
  senderId?: string; // 發送者用戶 ID（系統消息為空）
  billId: string;
  billName: string;
  title: string; // 消息標題
  content: string; // 消息內容
  imageUrl?: string; // 相關圖片（收據等）
  metadata?: {
    // 額外元數據
    participantId?: string;
    amount?: number;
    daysOverdue?: number;
    paymentStatus?: string;
  };
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  // 可操作消息的額外字段
  actionable?: boolean; // 是否可以執行操作
  actionType?: "confirm_payment" | "reject_payment"; // 操作類型
  actionCompleted?: boolean; // 操作是否已完成
}

export interface Session {
  userId: string;
  sessionId: string;
  expiresAt: string;
}
