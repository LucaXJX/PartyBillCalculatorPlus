/**
 * API 使用量記錄
 * 記錄每次 LLM API 調用的詳細信息
 */
import { proxy } from "../proxy.js";

export interface ApiUsageRecord {
  userId?: number | null;
  requestType: string;
  tokensUsed?: number | null;
  cost?: number | null;
  success: boolean;
  errorMessage?: string | null;
}

/**
 * 記錄 API 使用量
 */
export async function recordApiUsage(options: ApiUsageRecord) {
  try {
    // 注意：需要確保 proxy 中有 llm_api_usage 表
    // 這將在 migration 中創建
    if ("llm_api_usage" in proxy) {
      (proxy as any).llm_api_usage.push({
        user_id: options.userId ?? null,
        request_type: options.requestType,
        tokens_used: options.tokensUsed ?? null,
        cost: options.cost ?? null,
        success: options.success,
        error_message: options.errorMessage ?? null,
        created_at: new Date().toISOString(),
      });
    } else {
      console.warn("llm_api_usage 表尚未創建，跳過記錄");
    }
  } catch (error) {
    console.error("記錄 API 使用量失敗:", error);
    // 不拋出錯誤，避免影響主流程
  }
}

/**
 * 獲取使用量統計
 * @param userId 可選的用戶 ID
 * @param startDate 開始日期
 * @param endDate 結束日期
 */
export async function getUsageStats(options?: {
  userId?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  try {
    if (!("llm_api_usage" in proxy)) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
      };
    }

    const usageTable = (proxy as any).llm_api_usage;
    const start = options?.startDate || new Date();
    start.setHours(0, 0, 0, 0);
    const end = options?.endDate || new Date();
    end.setHours(23, 59, 59, 999);

    const records = usageTable.filter((record: any) => {
      if (options?.userId && record.user_id !== options.userId) {
        return false;
      }
      const recordDate = new Date(record.created_at);
      return recordDate >= start && recordDate <= end;
    });

    return {
      totalRequests: records.length,
      successfulRequests: records.filter((r: any) => r.success).length,
      failedRequests: records.filter((r: any) => !r.success).length,
      totalTokens: records.reduce((sum: number, r: any) => sum + (r.tokens_used || 0), 0),
    };
  } catch (error) {
    console.error("獲取使用量統計失敗:", error);
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
    };
  }
}

/**
 * 獲取用戶今日成功識別次數（用於限制檢查）
 * @param userId 用戶 ID
 */
export async function getTodaySuccessfulCount(userId: number): Promise<number> {
  try {
    if (!("llm_api_usage" in proxy)) {
      return 0;
    }

    const usageTable = (proxy as any).llm_api_usage;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayRecords = usageTable.filter((record: any) => {
      if (record.user_id !== userId) return false;
      if (!record.success) return false;
      if (record.request_type !== "bill_parse") return false;
      const recordDate = new Date(record.created_at);
      return recordDate >= today && recordDate < tomorrow;
    });

    return todayRecords.length;
  } catch (error) {
    console.error("獲取今日成功次數失敗:", error);
    return 0;
  }
}

/**
 * 檢查用戶是否超過每日使用限制
 * @param userId 用戶 ID
 * @param dailyLimit 每日限制次數（默認 10）
 */
export async function checkDailyLimit(
  userId: number,
  dailyLimit: number = 10
): Promise<{ allowed: boolean; used: number; remaining: number }> {
  const used = await getTodaySuccessfulCount(userId);
  return {
    allowed: used < dailyLimit,
    used,
    remaining: Math.max(0, dailyLimit - used),
  };
}
