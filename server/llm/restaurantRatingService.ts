/**
 * 餐廳評分 LLM 服務
 * 使用 LLM 根據餐廳名稱和鏈接獲取評分
 */
import { mistral } from "./mistral.js";
import { waitForRateLimit } from "./rateLimit.js";
import { recordApiUsage } from "./usageTracker.js";
import { parse } from "best-effort-json-parser";

export interface RestaurantRatingResponse {
  rating: number; // 0-5 的評分
  confidence: number; // 0-1 的置信度
  reasoning?: string; // 評分理由（可選）
}

/**
 * 從 LLM 獲取餐廳評分
 * @param restaurantName 餐廳名稱
 * @param restaurantUrl 餐廳 OpenRice 鏈接
 * @param userId 可選的用戶 ID（用於記錄使用量）
 * @returns 評分響應
 */
export async function getRestaurantRatingFromLLM(
  restaurantName: string,
  restaurantUrl: string,
  userId?: string
): Promise<RestaurantRatingResponse> {
  const prompt = `你是一個餐廳評分專家。請根據以下信息評估餐廳的評分：

餐廳名稱：${restaurantName}
餐廳鏈接：${restaurantUrl}

請根據以下標準給出評分（0-5分，5分為滿分）：
1. 餐廳的知名度和口碑（知名品牌如必勝客、麥當勞等通常 4.0-4.5，本地小店通常 3.0-4.0）
2. 餐廳的類型（連鎖餐廳通常 3.5-4.5，高檔餐廳通常 4.0-5.0，普通餐廳通常 3.0-4.0）
3. 餐廳的位置和環境（知名商圈如銅鑼灣、尖沙咀通常 +0.3-0.5，其他地區通常 3.0-4.0）
4. 餐廳的菜系類型（中餐、日料等常見菜系通常 3.5-4.5）

重要：請根據實際情況給出不同的評分，不要總是返回相同的值。如果餐廳名稱包含知名品牌（如必勝客、麥當勞、星巴克等），評分應該較高（4.0-4.5）。如果是本地小店，評分應該較低（3.0-4.0）。

請以 JSON 格式返回結果：
{
  "rating": <根據實際情況給出 0-5 之間的評分，小數點後1位>,
  "confidence": <0-1 之間的置信度，小數點後2位>,
  "reasoning": "<評分理由>"
}

評分範圍：0-5（小數點後1位）
置信度範圍：0-1（小數點後2位）
如果無法確定評分，請給出一個合理的估算值，並降低置信度。`;

  const model = "mistral-tiny"; // 使用免費模型

  try {
    await waitForRateLimit("getRestaurantRatingFromLLM");

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
    const rating = Math.max(0, Math.min(5, parseFloat(json.rating) || 0));
    const confidence = Math.max(0, Math.min(1, parseFloat(json.confidence) || 0.5));

    // #region agent log
    try {
      const fs = await import('fs');
      const logPath = 'c:\\Users\\Lucas\\OneDrive\\文档\\Code\\dae-2025-4\\.cursor\\debug.log';
      const logData = {
        location: 'restaurantRatingService.ts:83',
        message: 'LLM rating response - H11',
        data: {
          restaurantName,
          restaurantUrl,
          rawJson: json,
          parsedRating: rating,
          parsedConfidence: confidence,
          hasReasoning: !!json.reasoning,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H11'
      };
      fs.appendFileSync(logPath, JSON.stringify(logData) + '\n');
    } catch (e) {}
    // #endregion

    const result: RestaurantRatingResponse = {
      rating: Math.round(rating * 10) / 10, // 保留1位小數
      confidence: Math.round(confidence * 100) / 100, // 保留2位小數
      reasoning: json.reasoning || undefined,
    };

    // 記錄成功的使用量
    await recordApiUsage({
      userId: userId ? parseInt(userId) : undefined,
      requestType: "restaurant_rating",
      tokensUsed: response.usage?.totalTokens ?? undefined,
      success: true,
    });

    return result;
  } catch (error) {
    // 記錄失敗的使用量
    await recordApiUsage({
      userId: userId ? parseInt(userId) : undefined,
      requestType: "restaurant_rating",
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    // 如果 LLM 調用失敗，返回默認值
    console.warn(`LLM 評分獲取失敗 (${restaurantName}):`, error);
    return {
      rating: 3.5, // 默認中等評分
      confidence: 0.3, // 低置信度
      reasoning: "無法從 LLM 獲取評分，使用默認值",
    };
  }
}

