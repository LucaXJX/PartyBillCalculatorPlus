/**
 * 食物推薦服務
 * 利用 API 和模型識別結果提供多樣性推薦
 */
import { FoodImageRecord } from "./foodImageManager.js";
import { DishRecognitionResult } from "./baiduClient.js";
import type { RecognitionResult } from "../food-recognition/models/RecognitionPipeline.js";

/**
 * 推薦的食物選項
 */
export interface RecommendedFood {
  name: string;
  source: "api" | "model" | "combined"; // 來源：API、模型或組合
  confidence: number;
  calories?: number;
  country?: string;
  description?: string;
}

/**
 * 從識別結果中提取推薦食物
 * @param imageRecord 食物圖片記錄
 * @returns 推薦的食物列表
 */
export function getRecommendedFoods(
  imageRecord: FoodImageRecord
): RecommendedFood[] {
  const recommendations: RecommendedFood[] = [];

  // 解析 API 識別結果
  let apiResults: DishRecognitionResult[] = [];
  if (imageRecord.recognitionResult) {
    try {
      apiResults = JSON.parse(imageRecord.recognitionResult);
    } catch (error) {
      console.warn("解析 API 識別結果失敗:", error);
    }
  }

  // 解析模型識別結果
  let modelResult: RecognitionResult | null = null;
  if (imageRecord.modelRecognitionResult) {
    try {
      modelResult = JSON.parse(imageRecord.modelRecognitionResult);
    } catch (error) {
      console.warn("解析模型識別結果失敗:", error);
    }
  }

  // 添加 API 識別結果（取前 3 個）
  apiResults.slice(0, 3).forEach((result) => {
    if (result.name && result.confidence > 0.3) {
      recommendations.push({
        name: result.name,
        source: "api",
        confidence: result.confidence,
        calories: result.calories || result.calorie,
        description: `API 識別（置信度: ${(result.confidence * 100).toFixed(1)}%）`,
      });
    }
  });

  // 添加模型識別結果
  if (modelResult && modelResult.is_food) {
    if (modelResult.food_name && (modelResult.food_confidence ?? 0) > 0.3) {
      recommendations.push({
        name: modelResult.food_name,
        source: "model",
        confidence: modelResult.food_confidence ?? modelResult.overall_confidence ?? 0,
        calories: modelResult.calories,
        country: modelResult.country,
        description: `模型識別（${modelResult.country || "未知國家"}，置信度: ${((modelResult.food_confidence ?? 0) * 100).toFixed(1)}%）`,
      });
    }
  }

  // 去重：如果 API 和模型識別出相同的食物，合併為 combined
  const nameMap = new Map<string, RecommendedFood>();
  
  recommendations.forEach((rec) => {
    const normalizedName = normalizeFoodName(rec.name);
    const existing = nameMap.get(normalizedName);
    
    if (existing) {
      // 合併：使用更高的置信度，保留所有信息
      if (rec.confidence > existing.confidence) {
        existing.confidence = rec.confidence;
      }
      existing.source = "combined";
      if (rec.calories && !existing.calories) {
        existing.calories = rec.calories;
      }
      if (rec.country && !existing.country) {
        existing.country = rec.country;
      }
      existing.description = `API + 模型識別（置信度: ${(existing.confidence * 100).toFixed(1)}%）`;
    } else {
      nameMap.set(normalizedName, { ...rec });
    }
  });

  // 按置信度排序
  const finalRecommendations = Array.from(nameMap.values()).sort(
    (a, b) => b.confidence - a.confidence
  );

  return finalRecommendations;
}

/**
 * 標準化食物名稱（用於去重）
 */
function normalizeFoodName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]/g, "") // 移除標點符號
    .trim();
}

/**
 * 獲取多樣性推薦（從多張圖片中提取）
 * @param imageRecords 多張食物圖片記錄
 * @returns 推薦的食物列表（已去重並排序）
 */
export function getDiverseRecommendations(
  imageRecords: FoodImageRecord[]
): RecommendedFood[] {
  const allRecommendations: RecommendedFood[] = [];

  // 從每張圖片中提取推薦
  imageRecords.forEach((image) => {
    const recommendations = getRecommendedFoods(image);
    allRecommendations.push(...recommendations);
  });

  // 全局去重
  const nameMap = new Map<string, RecommendedFood>();
  
  allRecommendations.forEach((rec) => {
    const normalizedName = normalizeFoodName(rec.name);
    const existing = nameMap.get(normalizedName);
    
    if (existing) {
      // 合併：使用更高的置信度
      if (rec.confidence > existing.confidence) {
        existing.confidence = rec.confidence;
        existing.source = rec.source;
        existing.description = rec.description;
      }
      if (rec.calories && !existing.calories) {
        existing.calories = rec.calories;
      }
      if (rec.country && !existing.country) {
        existing.country = rec.country;
      }
    } else {
      nameMap.set(normalizedName, { ...rec });
    }
  });

  // 按置信度排序，但確保多樣性（優先選擇不同來源的結果）
  const finalRecommendations = Array.from(nameMap.values());
  
  // 先按來源多樣性排序（combined > api > model），再按置信度排序
  finalRecommendations.sort((a, b) => {
    const sourceOrder = { combined: 3, api: 2, model: 1 };
    const aOrder = sourceOrder[a.source] || 0;
    const bOrder = sourceOrder[b.source] || 0;
    
    if (aOrder !== bOrder) {
      return bOrder - aOrder;
    }
    
    return b.confidence - a.confidence;
  });

  return finalRecommendations;
}

/**
 * 格式化推薦結果為用戶友好的格式
 */
export function formatRecommendations(
  recommendations: RecommendedFood[]
): string {
  if (recommendations.length === 0) {
    return "暫無推薦";
  }

  return recommendations
    .map((rec, index) => {
      const calories = rec.calories ? `（約 ${rec.calories} 卡路里）` : "";
      const country = rec.country ? `[${rec.country}] ` : "";
      return `${index + 1}. ${country}${rec.name}${calories} - ${rec.description || `置信度: ${(rec.confidence * 100).toFixed(1)}%`}`;
    })
    .join("\n");
}


