/**
 * 用戶圖片統計服務
 * 統計用戶上傳的食物圖片，用於 LLM 推薦計算
 */
import { proxy } from "../proxy.js";
import type {
  UserImageStats,
} from "./restaurantRecommendationService.js";

/**
 * 從國家代碼映射到菜系類型
 */
const COUNTRY_TO_CUISINE: { [key: string]: string } = {
  chinese: "中餐",
  japanese: "日料",
  korean: "韓式",
  thai: "泰式",
  indian: "印度菜",
  italian: "義式",
  french: "法式",
  mexican: "墨西哥",
  american: "美式",
  others: "其他",
};

/**
 * 獲取用戶上傳圖片的統計信息
 * @param userId 用戶 ID
 * @returns 圖片統計信息
 */
export async function getUserImageStats(
  userId: string
): Promise<UserImageStats> {
  try {
    if (!("food_images" in proxy)) {
      return {
        cuisineStats: [],
        foodTypeStats: [],
        totalImages: 0,
      };
    }

    const images = (proxy as any).food_images.filter(
      (img: any) =>
        img != null &&
        img.user_id === userId &&
        img.recognition_status === 2 && // 已識別
        img.recognition_result != null
    );

    const cuisineCounts: { [key: string]: number } = {};
    const foodTypeCounts: { [key: string]: number } = {};
    let totalImages = 0;

    for (const image of images) {
      try {
        const recognitionResult = JSON.parse(image.recognition_result || "{}");
        
        // 處理 API 識別結果
        if (recognitionResult.results && Array.isArray(recognitionResult.results)) {
          for (const result of recognitionResult.results) {
            if (result.name) {
              // 統計食物類型
              const foodType = result.name;
              foodTypeCounts[foodType] = (foodTypeCounts[foodType] || 0) + 1;
            }
            
            // 統計菜系類型（從 country 映射）
            if (result.country) {
              const cuisineType = COUNTRY_TO_CUISINE[result.country.toLowerCase()] || result.country;
              cuisineCounts[cuisineType] = (cuisineCounts[cuisineType] || 0) + 1;
            }
          }
        }

        // 處理模型識別結果
        if (image.model_recognition_result) {
          try {
            const modelResult = JSON.parse(image.model_recognition_result);
            if (modelResult.country) {
              const cuisineType = COUNTRY_TO_CUISINE[modelResult.country.toLowerCase()] || modelResult.country;
              cuisineCounts[cuisineType] = (cuisineCounts[cuisineType] || 0) + 1;
            }
            if (modelResult.name) {
              const foodType = modelResult.name;
              foodTypeCounts[foodType] = (foodTypeCounts[foodType] || 0) + 1;
            }
          } catch (e) {
            // 忽略解析錯誤
          }
        }

        totalImages++;
      } catch (e) {
        // 忽略解析錯誤，繼續處理下一張圖片
        console.warn("解析識別結果失敗:", e);
      }
    }

    // 轉換為統計數組
    const cuisineStats = Object.entries(cuisineCounts)
      .map(([cuisineType, count]) => ({
        cuisineType,
        count: count as number,
        percentage: totalImages > 0 ? ((count as number) / totalImages) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count); // 按數量降序排序

    const foodTypeStats = Object.entries(foodTypeCounts)
      .map(([foodType, count]) => ({
        foodType,
        count: count as number,
        percentage: totalImages > 0 ? ((count as number) / totalImages) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count); // 按數量降序排序

    return {
      cuisineStats,
      foodTypeStats,
      totalImages,
    };
  } catch (error) {
    console.error("獲取用戶圖片統計失敗:", error);
    return {
      cuisineStats: [],
      foodTypeStats: [],
      totalImages: 0,
    };
  }
}

