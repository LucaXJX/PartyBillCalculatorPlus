/**
 * 百度 API 使用量記錄
 * 記錄每次百度 API 調用的詳細信息
 */
import { proxy } from "../proxy.js";

export interface FoodApiUsageRecord {
  foodImageId?: number | null;
  userId?: string | null;
  requestType?: string;
  success: boolean;
  responseData?: string | null;
  errorMessage?: string | null;
}

/**
 * 記錄 API 使用量
 */
export async function recordApiUsage(options: FoodApiUsageRecord) {
  try {
    if ("food_api_usage" in proxy) {
      const now = new Date().toISOString();
      (proxy as any).food_api_usage.push({
        food_image_id: options.foodImageId ?? null,
        user_id: options.userId ?? null,
        request_type: options.requestType || "dish_recognition",
        success: options.success ? 1 : 0,
        response_data: options.responseData ?? null,
        error_message: options.errorMessage ?? null,
        created_at: now,
        updated_at: now,
      });
    } else {
      console.warn("food_api_usage 表尚未創建，跳過記錄");
    }
  } catch (error) {
    console.error("記錄 API 使用量失敗:", error);
    // 不拋出錯誤，避免影響主流程
  }
}

/**
 * 獲取總使用量（用於檢查是否超過 1000 次免費額度）
 */
export async function getTotalUsageCount(): Promise<number> {
  try {
    if (!("food_api_usage" in proxy)) {
      return 0;
    }

    const usageTable = (proxy as any).food_api_usage;
    return usageTable.length;
  } catch (error) {
    console.error("獲取總使用量失敗:", error);
    return 0;
  }
}

/**
 * 檢查是否超過免費額度（1000 次）
 */
export async function checkUsageLimit(limit: number = 1000): Promise<{
  allowed: boolean;
  used: number;
  remaining: number;
}> {
  const used = await getTotalUsageCount();
  return {
    allowed: used < limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}

