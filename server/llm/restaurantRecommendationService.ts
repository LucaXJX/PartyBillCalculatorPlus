/**
 * 餐廳推薦指數 LLM 服務
 * 使用 LLM 根據用戶上傳圖片的統計和餐廳標籤計算推薦指數
 */
import { mistral } from "./mistral.js";
import { waitForRateLimit } from "./rateLimit.js";
import { recordApiUsage } from "./usageTracker.js";
import { parse } from "best-effort-json-parser";

export interface UserImageStats {
  /** 用戶上傳的食物圖片統計（按菜系/類型分組） */
  cuisineStats: Array<{
    cuisineType: string; // 菜系類型（如：中餐、日料、韓式）
    count: number; // 該類型的圖片數量
    percentage: number; // 佔比（0-100）
  }>;
  /** 用戶上傳的食物圖片統計（按食物類型分組） */
  foodTypeStats: Array<{
    foodType: string; // 食物類型（如：小籠包、壽司、拉麵）
    count: number;
    percentage: number;
  }>;
  /** 總圖片數量 */
  totalImages: number;
}

export interface RestaurantInfo {
  name: string;
  cuisineType?: string;
  tags?: string[]; // 搜索標籤（如：火鍋、點心、小籠包）
  address?: string;
}

export interface RecommendationScoreResponse {
  score: number; // 0-1 的推薦指數
  confidence: number; // 0-1 的置信度
  reasoning?: string; // 推薦理由（可選）
  matchedFactors: string[]; // 匹配的因素列表
}

/**
 * 從 LLM 獲取餐廳推薦指數
 * @param userImageStats 用戶上傳圖片的統計信息
 * @param restaurantInfo 餐廳信息
 * @param userId 可選的用戶 ID（用於記錄使用量）
 * @returns 推薦指數響應
 */
export async function getRestaurantRecommendationScoreFromLLM(
  userImageStats: UserImageStats,
  restaurantInfo: RestaurantInfo,
  userId?: string
): Promise<RecommendationScoreResponse> {
  // 構建統計信息文本
  const cuisineStatsText = userImageStats.cuisineStats
    .map((s) => `- ${s.cuisineType}: ${s.count} 張 (${s.percentage.toFixed(1)}%)`)
    .join("\n");

  const foodTypeStatsText = userImageStats.foodTypeStats
    .map((s) => `- ${s.foodType}: ${s.count} 張 (${s.percentage.toFixed(1)}%)`)
    .join("\n");

  const restaurantTagsText = restaurantInfo.tags?.join(", ") || "無標籤";

  const prompt = `你是一個餐廳推薦專家。請根據以下信息計算推薦指數：

【用戶上傳圖片統計】
總圖片數：${userImageStats.totalImages} 張

按菜系類型統計：
${cuisineStatsText || "無數據"}

按食物類型統計：
${foodTypeStatsText || "無數據"}

【餐廳信息】
餐廳名稱：${restaurantInfo.name}
菜系類型：${restaurantInfo.cuisineType || "未知"}
搜索標籤：${restaurantTagsText}
地址：${restaurantInfo.address || "未知"}

請根據以下標準計算推薦指數（0-1，1為最推薦）：
1. 餐廳的菜系類型是否與用戶上傳圖片的主要菜系匹配
2. 餐廳的搜索標籤是否與用戶上傳圖片的主要食物類型匹配
3. 匹配的強度（如果用戶經常上傳某類食物，而餐廳正好提供該類食物，推薦指數應該很高）
4. 餐廳的知名度和口碑（如果餐廳是知名品牌，可以適當提高推薦指數）

請以 JSON 格式返回結果：
{
  "score": 0.85,
  "confidence": 0.9,
  "reasoning": "用戶經常上傳中餐和小籠包相關圖片，而這家餐廳正好是中餐餐廳，標籤包含小籠包，匹配度很高",
  "matchedFactors": ["菜系類型匹配（中餐）", "食物類型匹配（小籠包）"]
}

推薦指數範圍：0-1（小數點後2位）
置信度範圍：0-1（小數點後2位）
matchedFactors 應該列出所有匹配的因素。`;

  const model = "mistral-tiny"; // 使用免費模型

  try {
    await waitForRateLimit("getRestaurantRecommendationScoreFromLLM");

    const response = await mistral.chat.complete({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    let content = response.choices[0].message.content;
    if (typeof content !== "string") {
      throw new Error("預期 content 為字符串");
    }

    // 提取 JSON 部分
    let startIndex = content.indexOf("{");
    if (startIndex === -1) {
      throw new Error("預期 content 包含 JSON 對象");
    }

    let text = content.slice(startIndex);
    let json = parse(text);

    // 驗證和標準化響應
    const score = Math.max(0, Math.min(1, parseFloat(json.score) || 0));
    const confidence = Math.max(0, Math.min(1, parseFloat(json.confidence) || 0.5));

    const result: RecommendationScoreResponse = {
      score: Math.round(score * 100) / 100, // 保留2位小數
      confidence: Math.round(confidence * 100) / 100, // 保留2位小數
      reasoning: json.reasoning || undefined,
      matchedFactors: Array.isArray(json.matchedFactors)
        ? json.matchedFactors
        : json.matchedFactors
        ? [String(json.matchedFactors)]
        : [],
    };

    // 記錄成功的使用量
    await recordApiUsage({
      userId: userId ? parseInt(userId) : undefined,
      requestType: "restaurant_recommendation",
      tokensUsed: response.usage?.totalTokens ?? undefined,
      success: true,
    });

    return result;
  } catch (error) {
    // 記錄失敗的使用量
    await recordApiUsage({
      userId: userId ? parseInt(userId) : undefined,
      requestType: "restaurant_recommendation",
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    // 如果 LLM 調用失敗，返回默認值
    console.warn(`LLM 推薦指數獲取失敗 (${restaurantInfo.name}):`, error);
    return {
      score: 0.5, // 默認中等推薦指數
      confidence: 0.3, // 低置信度
      reasoning: "無法從 LLM 獲取推薦指數，使用默認值",
      matchedFactors: [],
    };
  }
}

