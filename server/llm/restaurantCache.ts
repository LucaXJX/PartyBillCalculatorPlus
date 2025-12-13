/**
 * 餐廳 LLM 結果緩存
 * 避免重複調用 LLM API
 */
import { proxy } from "../proxy.js";
import { db } from "../db.js";

export interface CachedRestaurantRating {
  restaurant_id: string;
  llm_rating: number;
  llm_rating_confidence: number;
  llm_rating_reasoning?: string;
  cached_at: string;
}

export interface CachedRecommendationScore {
  restaurant_id: string;
  user_id: string;
  llm_recommendation_score: number;
  llm_recommendation_confidence: number;
  llm_recommendation_reasoning?: string;
  cached_at: string;
}

/**
 * 獲取緩存的餐廳評分
 * @param restaurantId 餐廳 ID
 * @returns 緩存的評分，如果不存在則返回 null
 */
export function getCachedRestaurantRating(
  restaurantId: string
): CachedRestaurantRating | null {
  try {
    // 檢查 proxy.restaurant 是否存在且是數組
    if (!proxy.restaurant || !Array.isArray(proxy.restaurant)) {
      return null;
    }
    
    const restaurant = proxy.restaurant.find((r: any) => r && r.id === restaurantId);
    if (!restaurant) return null;

    // 檢查是否有緩存的 LLM 評分（在 restaurant 表中）
    // 如果 llm_rating 存在且不為 null，且緩存時間在 7 天內，則使用緩存
    if (restaurant.llm_rating != null && restaurant.llm_rating_updated_at) {
      const cachedAt = new Date(restaurant.llm_rating_updated_at);
      const now = new Date();
      const daysSinceCache = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceCache < 7) {
        // 緩存有效（7 天內）
        return {
          restaurant_id: restaurantId,
          llm_rating: restaurant.llm_rating,
          llm_rating_confidence: restaurant.llm_rating_confidence || 0.5,
          llm_rating_reasoning: restaurant.llm_rating_reasoning || undefined,
          cached_at: restaurant.llm_rating_updated_at,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("獲取緩存評分失敗:", error);
    return null;
  }
}

/**
 * 保存餐廳評分到緩存
 * @param restaurantId 餐廳 ID
 * @param rating 評分
 * @param confidence 置信度
 * @param reasoning 理由（可選）
 */
export function cacheRestaurantRating(
  restaurantId: string,
  rating: number,
  confidence: number,
  reasoning?: string
): void {
  try {
    // 檢查 db 是否已初始化
    if (!db) {
      console.warn("數據庫未初始化，無法保存緩存評分");
      return;
    }
    
    const stmt = db.prepare(`
      UPDATE restaurant 
      SET llm_rating = ?, 
          llm_rating_confidence = ?, 
          llm_rating_reasoning = ?, 
          llm_rating_updated_at = ?
      WHERE id = ?
    `);
    stmt.run(
      rating,
      confidence,
      reasoning || null,
      new Date().toISOString(),
      restaurantId
    );
  } catch (error: any) {
    console.error("保存緩存評分失敗:", error?.message || String(error));
    // 不拋出錯誤，避免影響主流程
  }
}

/**
 * 獲取緩存的推薦指數
 * @param restaurantId 餐廳 ID
 * @param userId 用戶 ID
 * @returns 緩存的推薦指數，如果不存在則返回 null
 */
export function getCachedRecommendationScore(
  restaurantId: string,
  userId: string
): CachedRecommendationScore | null {
  try {
    // 檢查是否有緩存的推薦指數（在 user_restaurant_preference 表中或單獨的緩存表）
    // 這裡我們可以創建一個新的緩存表，或者使用現有的 user_restaurant_preference 表
    // 為了簡化，我們先使用內存緩存（可以後續改為數據庫緩存）
    
    // 暫時返回 null，表示沒有緩存（可以後續實現數據庫緩存）
    return null;
  } catch (error) {
    console.error("獲取緩存推薦指數失敗:", error);
    return null;
  }
}

/**
 * 保存推薦指數到緩存
 * @param restaurantId 餐廳 ID
 * @param userId 用戶 ID
 * @param score 推薦指數
 * @param confidence 置信度
 * @param reasoning 理由（可選）
 */
export function cacheRecommendationScore(
  restaurantId: string,
  userId: string,
  score: number,
  confidence: number,
  reasoning?: string
): void {
  try {
    // 暫時不實現持久化緩存（可以後續添加）
    // 可以創建一個新的表來存儲推薦指數緩存
  } catch (error) {
    console.error("保存緩存推薦指數失敗:", error);
  }
}

