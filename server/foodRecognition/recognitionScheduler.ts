/**
 * 食物識別調度器
 * 處理異步識別任務（訂單保存 1 分鐘後調用）
 */
import { getFoodImagesByBillId, recognizeFoodImage } from "./foodImageManager.js";

// 任務隊列：billId -> setTimeout ID
const scheduledTasks = new Map<string, NodeJS.Timeout>();

/**
 * 為訂單調度識別任務（1 分鐘後執行）
 * @param billId 訂單 ID
 */
export function scheduleRecognition(billId: string): void {
  // 如果已有任務，先取消
  if (scheduledTasks.has(billId)) {
    clearTimeout(scheduledTasks.get(billId)!);
  }

  // 10 秒後執行識別（暫時改為 10 秒，方便測試）
  const timeoutId = setTimeout(async () => {
    try {
      console.log(`開始識別訂單 ${billId} 的食物圖片...`);
      const images = await getFoodImagesByBillId(billId);

      // 識別所有未識別的圖片
      for (const image of images) {
        if (image.id && image.recognitionStatus === 0) {
          try {
            await recognizeFoodImage(image.id);
            console.log(`圖片 ${image.id} 識別完成`);
          } catch (error) {
            console.error(`圖片 ${image.id} 識別失敗:`, error);
          }
        }
      }

      console.log(`訂單 ${billId} 的食物圖片識別完成`);
    } catch (error) {
      console.error(`訂單 ${billId} 的食物圖片識別失敗:`, error);
    } finally {
      scheduledTasks.delete(billId);
    }
  }, 10 * 1000); // 10 秒（暫時改為 10 秒，方便測試）

  scheduledTasks.set(billId, timeoutId);
  console.log(`已為訂單 ${billId} 調度識別任務（10 秒後執行）`);
}

/**
 * 取消調度任務
 */
export function cancelScheduledRecognition(billId: string): void {
  if (scheduledTasks.has(billId)) {
    clearTimeout(scheduledTasks.get(billId)!);
    scheduledTasks.delete(billId);
    console.log(`已取消訂單 ${billId} 的識別任務`);
  }
}

/**
 * 立即執行識別（用於手動觸發或自檢）
 */
export async function recognizeBillImagesNow(billId: string): Promise<void> {
  const images = await getFoodImagesByBillId(billId);
  const results = [];

  for (const image of images) {
    if (image.id && image.recognitionStatus === 0) {
      try {
        await recognizeFoodImage(image.id);
        results.push({ id: image.id, success: true });
      } catch (error) {
        results.push({
          id: image.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return;
}

