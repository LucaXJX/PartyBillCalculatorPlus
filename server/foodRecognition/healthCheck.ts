/**
 * 自檢機制
 * 檢查哪些圖片已識別，哪些未識別，並提供修復建議
 */
import { getUnrecognizedImages, recognizeFoodImage } from "./foodImageManager.js";
import { checkUsageLimit } from "./usageTracker.js";

export interface HealthCheckResult {
  totalImages: number;
  recognized: number;
  unrecognized: number;
  recognizing: number;
  failed: number;
  unrecognizedImages: Array<{
    id: number;
    billId: string;
    filename: string;
    status: number;
    error?: string;
  }>;
  apiUsage: {
    used: number;
    remaining: number;
    limit: number;
  };
  recommendations: string[];
}

/**
 * 執行健康檢查
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const unrecognized = await getUnrecognizedImages();
  const apiUsage = await checkUsageLimit(1000);

  // 統計各狀態的圖片數量
  const stats = {
    total: 0,
    recognized: 0,
    unrecognized: 0,
    recognizing: 0,
    failed: 0,
  };

  // 需要從所有圖片中統計（這裡簡化，只統計未識別的）
  // 實際應該查詢所有圖片
  unrecognized.forEach((img) => {
    stats.total++;
    if (img.recognitionStatus === 0) stats.unrecognized++;
    else if (img.recognitionStatus === 1) stats.recognizing++;
    else if (img.recognitionStatus === 3) stats.failed++;
  });

  const recommendations: string[] = [];

  // 生成建議
  if (unrecognized.length > 0) {
    recommendations.push(`發現 ${unrecognized.length} 張未識別的圖片，建議手動觸發識別`);
  }

  if (!apiUsage.allowed) {
    recommendations.push(`API 使用量已達上限（${apiUsage.used}/1000），無法繼續識別`);
  } else if (apiUsage.remaining < 10) {
    recommendations.push(`API 使用量即將耗盡（剩餘 ${apiUsage.remaining} 次），請注意`);
  }

  return {
    totalImages: stats.total,
    recognized: stats.recognized,
    unrecognized: stats.unrecognized,
    recognizing: stats.recognizing,
    failed: stats.failed,
    unrecognizedImages: unrecognized.map((img) => ({
      id: img.id!,
      billId: img.billId,
      filename: img.originalFilename,
      status: img.recognitionStatus,
      error: img.recognitionError,
    })),
    apiUsage: {
      used: apiUsage.used,
      remaining: apiUsage.remaining,
      limit: 1000,
    },
    recommendations,
  };
}

/**
 * 修復未識別的圖片（批量識別）
 */
export async function fixUnrecognizedImages(): Promise<{
  success: number;
  failed: number;
  errors: Array<{ id: number; error: string }>;
}> {
  const unrecognized = await getUnrecognizedImages();
  const results = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ id: number; error: string }>,
  };

  for (const image of unrecognized) {
    if (image.id && image.recognitionStatus === 0) {
      try {
        await recognizeFoodImage(image.id);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          id: image.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return results;
}

