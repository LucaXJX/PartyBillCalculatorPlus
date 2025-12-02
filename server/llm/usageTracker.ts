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
  // TODO: 實現使用量統計查詢
  // 需要等待 migration 創建表後實現
  return {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalTokens: 0,
  };
}
