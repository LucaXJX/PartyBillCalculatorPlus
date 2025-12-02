/**
 * 賬單解析的類型定義和驗證器
 * 參考 01-mc-system/types.ts
 */
import { object, string, number, array, optional } from "cast.ts";

export const BillResponseFormat = `
{
  restaurant: string
  date: string  // ISO 8601 格式或 YYYY-MM-DD
  items: Array<{
    name: string
    price: number
    quantity?: number
  }>
  subtotal: number
  tip: number
  total: number
  currency: string  // 例如: "HKD", "USD", "CNY"
}
`.trim();

export const BillItemParser = object({
  name: string(),
  price: number(),
  quantity: optional(number()),
});

export const BillParser = object({
  restaurant: string(),
  date: string(),
  items: array(BillItemParser),
  subtotal: number(),
  tip: number(),
  total: number(),
  currency: string(),
});

export type ParsedBill = {
  restaurant: string;
  date: string;
  items: Array<{
    name: string;
    price: number;
    quantity?: number;
  }>;
  subtotal: number;
  tip: number;
  total: number;
  currency: string;
};
