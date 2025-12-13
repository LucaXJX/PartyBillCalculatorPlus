/**
 * 餐廳 LLM 服務整合
 * 整合評分和推薦指數的獲取
 */
import { getRestaurantRatingFromLLM } from "./restaurantRatingService.js";
import { getRestaurantRecommendationScoreFromLLM } from "./restaurantRecommendationService.js";
import { getUserImageStats } from "./userImageStatsService.js";
import {
  getCachedRestaurantRating,
  cacheRestaurantRating,
} from "./restaurantCache.js";

/**
 * 獲取餐廳的 LLM 評分（帶緩存）
 * @param restaurantId 餐廳 ID
 * @param restaurantName 餐廳名稱
 * @param restaurantUrl 餐廳 URL
 * @param userId 用戶 ID（可選）
 * @returns LLM 評分
 */
export async function getRestaurantLLMRating(
  restaurantId: string,
  restaurantName: string,
  restaurantUrl: string,
  userId?: string
): Promise<{ rating: number; confidence: number; reasoning?: string }> {
  try {
    // 先檢查緩存
    const cached = getCachedRestaurantRating(restaurantId);
    if (cached) {
      return {
        rating: cached.llm_rating,
        confidence: cached.llm_rating_confidence,
        reasoning: cached.llm_rating_reasoning,
      };
    }

    // 調用 LLM 獲取評分
    const result = await getRestaurantRatingFromLLM(
      restaurantName,
      restaurantUrl,
      userId
    );

    // 保存到緩存
    cacheRestaurantRating(
      restaurantId,
      result.rating,
      result.confidence,
      result.reasoning
    );

    return result;
  } catch (error: any) {
    console.error(`獲取餐廳 LLM 評分失敗 (${restaurantName}):`, error?.message || String(error));
    // 返回默認值，避免崩潰
    return {
      rating: 3.5,
      confidence: 0.3,
      reasoning: "無法獲取 LLM 評分，使用默認值",
    };
  }
}

/**
 * 獲取餐廳的 LLM 推薦指數
 * @param restaurantId 餐廳 ID
 * @param restaurantInfo 餐廳信息
 * @param userId 用戶 ID
 * @returns LLM 推薦指數
 */
export async function getRestaurantLLMRecommendationScore(
  restaurantId: string,
  restaurantInfo: {
    name: string;
    cuisineType?: string;
    tags?: string[];
    address?: string;
  },
  userId: string
): Promise<{ score: number; confidence: number; reasoning?: string; matchedFactors: string[] }> {
  // 獲取用戶圖片統計
  const userImageStats = await getUserImageStats(userId);

  // 如果用戶沒有上傳圖片，返回默認值
  if (userImageStats.totalImages === 0) {
    return {
      score: 0.5,
      confidence: 0.3,
      reasoning: "用戶尚未上傳圖片，無法計算推薦指數",
      matchedFactors: [],
    };
  }

  // 調用 LLM 獲取推薦指數
  const result = await getRestaurantRecommendationScoreFromLLM(
    userImageStats,
    restaurantInfo,
    userId
  );

  return result;
}

