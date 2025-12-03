/**
 * 百度菜品識別 API 客戶端
 */
import axios from "axios";
import fs from "fs";
import { env } from "./env.js";
import { recordApiUsage } from "./usageTracker.js";

export interface DishRecognitionResult {
  name: string; // 菜品名稱
  confidence: number; // 置信度 (0-1)
  calories?: number; // 卡路里
  has_calorie?: boolean; // 是否有卡路里信息
  calorie?: number; // 卡路里（另一個字段）
}

export interface BaiduApiResponse {
  log_id: number;
  result_num: number;
  result: Array<{
    name: string;
    calorie: string; // 百度返回的是字符串
    probability: string; // 置信度（字符串格式，如 "0.9876"）
    has_calorie: boolean;
  }>;
}

/**
 * 獲取百度 Access Token
 * 百度 API 需要先獲取 access_token 才能調用
 */
async function getAccessToken(): Promise<string> {
  const url = "https://aip.baidubce.com/oauth/2.0/token";
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.BAIDU_API_KEY,
    client_secret: env.BAIDU_SECRET_KEY,
  });

  try {
    const response = await axios.post(url, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (response.data.error) {
      throw new Error(`獲取 Access Token 失敗: ${response.data.error_description || response.data.error}`);
    }

    return response.data.access_token;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`獲取 Access Token 失敗: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 識別食物圖片
 * @param imagePath 圖片文件路徑
 * @param userId 可選的用戶 ID（用於記錄）
 * @param foodImageId 可選的食物圖片 ID（用於記錄）
 */
export async function recognizeFood(
  imagePath: string,
  userId?: string,
  foodImageId?: number
): Promise<DishRecognitionResult[]> {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`圖片文件不存在: ${imagePath}`);
  }

  try {
    // 1. 獲取 Access Token
    const accessToken = await getAccessToken();

    // 2. 讀取圖片並轉換為 base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    // 3. 調用菜品識別 API
    const apiUrl = `${env.BAIDU_DISH_RECOGNITION_URL}?access_token=${accessToken}`;
    const response = await axios.post(
      apiUrl,
      {
        image: base64Image,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        params: {
          access_token: accessToken,
        },
      }
    );

    const data: BaiduApiResponse = response.data;

    // 4. 處理響應數據
    if (!data.result || data.result.length === 0) {
      await recordApiUsage({
        foodImageId,
        userId,
        success: false,
        errorMessage: "未識別到菜品",
        responseData: JSON.stringify(data),
      });
      return [];
    }

    // 5. 轉換為標準格式
    const results: DishRecognitionResult[] = data.result.map((item) => ({
      name: item.name,
      confidence: parseFloat(item.probability) || 0,
      calories: item.calorie ? parseFloat(item.calorie) : undefined,
      has_calorie: item.has_calorie || false,
      calorie: item.calorie ? parseFloat(item.calorie) : undefined,
    }));

    // 6. 記錄 API 使用量
    await recordApiUsage({
      foodImageId,
      userId,
      success: true,
      responseData: JSON.stringify(data),
    });

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 記錄失敗的 API 調用
    await recordApiUsage({
      foodImageId,
      userId,
      success: false,
      errorMessage,
    });

    throw new Error(`菜品識別失敗: ${errorMessage}`);
  }
}

/**
 * 檢查百度 API 服務是否可用
 */
export async function checkBaiduService(): Promise<boolean> {
  try {
    if (!env.BAIDU_API_KEY || !env.BAIDU_SECRET_KEY) {
      return false;
    }
    // 嘗試獲取 access token 來驗證配置
    await getAccessToken();
    return true;
  } catch (error) {
    return false;
  }
}

