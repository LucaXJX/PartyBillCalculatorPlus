// 使用純 JavaScript 版本的 TensorFlow.js（不需要構建 native 模塊）
import * as tf from "@tensorflow/tfjs";
import { ModelLoader } from "./ModelLoader.js";
import { ImagePreprocessor } from "./ImagePreprocessor.js";

/**
 * 識別結果接口
 */
export interface RecognitionResult {
  is_food: boolean;
  confidence?: number;
  country?: string;
  country_confidence?: number;
  food_name?: string;
  food_confidence?: number;
  calories?: number;
  ingredients?: string[];
  overall_confidence?: number;
  message?: string;
  error?: string;
}

/**
 * 國家代碼映射
 */
const COUNTRIES = [
  "chinese",
  "japanese",
  "korean",
  "thai",
  "indian",
  "italian",
  "french",
  "mexican",
  "american",
  "others",
] as const;

/**
 * 兩層級聯識別管道（第三層暫時隱藏）
 * - 第一層：食物檢測（是食物/不是食物）
 * - 第二層：國家分類（識別食物來源國家）
 * 
 * 注意：第三層細粒度識別已暫時隱藏，代碼保留在註釋中以便將來恢復
 */
export class RecognitionPipeline {
  private modelLoader: ModelLoader;
  private preprocessor: ImagePreprocessor;
  private foodInfoCache: Map<string, any> = new Map(); // 食物信息緩存

  constructor(modelLoader: ModelLoader, preprocessor: ImagePreprocessor) {
    this.modelLoader = modelLoader;
    this.preprocessor = preprocessor;
  }

  /**
   * 兩層級聯識別流程（第三層暫時隱藏）
   * @param imageBuffer 圖像緩衝區
   * @returns 識別結果
   */
  async recognizeFoodImage(
    imageBuffer: Buffer
  ): Promise<RecognitionResult> {
    let imageTensor: tf.Tensor4D | null = null;

    try {
      // 驗證圖像
      const isValid = await this.preprocessor.validateImage(imageBuffer);
      if (!isValid) {
        return {
          is_food: false,
          message: "無效的圖像格式",
          error: "INVALID_IMAGE",
        };
      }

      // 預處理圖像
      imageTensor = await this.preprocessor.preprocessImage(imageBuffer, [224, 224]);

      // 第一層：食物檢測
      const level1Result = await this.level1Inference(imageTensor);
      if (!level1Result.is_food || (level1Result.confidence ?? 0) < 0.5) {
        imageTensor.dispose();
        return {
          is_food: false,
          confidence: level1Result.confidence ?? 0,
          message: "圖像中未檢測到食物",
        };
      }

      // 第二層：國家識別
      const level2Result = await this.level2Inference(imageTensor);
      if ((level2Result.country_confidence ?? 0) < 0.3) {
        imageTensor.dispose();
        return {
          is_food: true,
          country: "unknown",
          confidence: level2Result.country_confidence,
          message: "無法識別食物來源國家",
        };
      }

      // ========== 第三層細粒度識別暫時隱藏 ==========
      // 以下代碼已註釋，保留以便將來恢復
      /*
      // 第三層：細粒度識別（根據國家選擇對應模型）
      const level3Result = await this.level3Inference(
        imageTensor,
        level2Result.country!
      );

      // 獲取食物詳細信息（只有在第三層識別成功時才獲取）
      let foodInfo = null;
      if (level3Result.food_confidence > 0) {
        foodInfo = await this.getFoodInfo(
          level2Result.country!,
          level3Result.food_index ?? 0
        );
      }

      // 計算總體置信度（包含第三層）
      const overallConfidence = level3Result.food_confidence > 0
        ? (level1Result.confidence ?? 0) *
          (level2Result.country_confidence ?? 0) *
          (level3Result.food_confidence ?? 0)
        : (level1Result.confidence ?? 0) *
          (level2Result.country_confidence ?? 0) * 0.5;

      return {
        is_food: true,
        country: level2Result.country,
        country_confidence: level2Result.country_confidence,
        food_name: foodInfo?.name || level3Result.food_name || (level3Result.food_confidence === 0 ? "unknown" : undefined),
        food_confidence: level3Result.food_confidence,
        calories: foodInfo?.calories,
        ingredients: foodInfo?.ingredients,
        overall_confidence: overallConfidence,
        message: level3Result.food_confidence === 0 
          ? `${level2Result.country} 國家的細粒度識別模型未加載，無法識別具體食物名稱`
          : undefined,
      };
      */
      // ========== 第三層代碼結束 ==========

      // 只使用前兩層的結果
      // 計算總體置信度（僅使用前兩層）
      const overallConfidence = (level1Result.confidence ?? 0) * (level2Result.country_confidence ?? 0);

      imageTensor.dispose();

      return {
        is_food: true,
        country: level2Result.country,
        country_confidence: level2Result.country_confidence,
        confidence: level1Result.confidence,
        overall_confidence: overallConfidence,
        // 第三層相關字段設為 undefined 或默認值
        food_name: undefined,
        food_confidence: 0,
        calories: undefined,
        ingredients: undefined,
      };
    } catch (error) {
      console.error("識別過程出錯:", error);
      return {
        is_food: false,
        error: error instanceof Error ? error.message : String(error),
        message: "識別過程發生錯誤",
      };
    } finally {
      // 確保清理張量
      if (imageTensor) {
        imageTensor.dispose();
      }
    }
  }

  /**
   * 第一層推理：食物檢測
   * 
   * 注意：模型使用 binary 分類模式，輸出是 sigmoid 值（0-1）
   * - 類別順序：[food (0), non-food (1)]
   * - 輸出接近 0 = food（第一個類別）
   * - 輸出接近 1 = non-food（第二個類別）
   * 所以：isFood = output < 0.5（輸出小於 0.5 表示是食物）
   */
  private async level1Inference(
    imageTensor: tf.Tensor4D
  ): Promise<{ is_food: boolean; confidence: number }> {
    const model = this.modelLoader.getLevel1Model();
    const prediction = model.predict(imageTensor) as tf.Tensor;

    try {
      const probabilities = await prediction.data();
      const output = probabilities[0]; // sigmoid 輸出值
      
      // 在 binary 模式下，輸出 < 0.5 表示第一個類別（food）
      // 輸出 > 0.5 表示第二個類別（non-food）
      const isFood = output < 0.5;
      
      // 置信度：如果是食物，使用 (1 - output)；如果不是食物，使用 output
      const confidence = isFood ? 1 - output : output;

      return {
        is_food: isFood,
        confidence: confidence,
      };
    } finally {
      prediction.dispose();
    }
  }

  /**
   * 第二層推理：國家分類
   */
  private async level2Inference(imageTensor: tf.Tensor4D): Promise<{
    country: string;
    country_confidence: number;
  }> {
    const model = this.modelLoader.getLevel2Model();
    const prediction = model.predict(imageTensor) as tf.Tensor;

    try {
      const probabilities = await prediction.data();
      const probabilitiesArray = Array.from(probabilities);
      const maxIndex = probabilitiesArray.indexOf(Math.max(...probabilitiesArray));
      const confidence = probabilitiesArray[maxIndex];
      const country = COUNTRIES[maxIndex] || "unknown";

      return {
        country,
        country_confidence: confidence,
      };
    } finally {
      prediction.dispose();
    }
  }

  // ========== 第三層細粒度識別相關方法暫時隱藏 ==========
  // 以下代碼已註釋，保留以便將來恢復
  /*
  // 第三層推理：細粒度食物識別
  private async level3Inference(
    imageTensor: tf.Tensor4D,
    country: string
  ): Promise<{
    food_name?: string;
    food_confidence: number;
    food_index: number;
  }> {
    try {
      // 嘗試獲取模型，如果不存在則按需加載
      let model: tf.LayersModel | tf.GraphModel;
      try {
        model = this.modelLoader.getCountryModel(country);
      } catch (error) {
        // 模型未加載，嘗試按需加載
        console.log(`📦 按需加載 ${country} 國家模型...`);
        try {
          await this.modelLoader.loadCountryModel(country);
          model = this.modelLoader.getCountryModel(country);
          console.log(`✅ ${country} 國家模型按需加載成功`);
        } catch (loadError) {
          console.warn(`⚠️  無法加載 ${country} 國家模型:`, loadError instanceof Error ? loadError.message : String(loadError));
          return {
            food_confidence: 0,
            food_index: 0,
          };
        }
      }

      const prediction = model.predict(imageTensor) as tf.Tensor;

      try {
        const probabilities = await prediction.data();
        const probabilitiesArray = Array.from(probabilities);
        const maxIndex = probabilitiesArray.indexOf(
          Math.max(...probabilitiesArray)
        );
        const confidence = probabilitiesArray[maxIndex];

        return {
          food_confidence: confidence,
          food_index: maxIndex,
        };
      } finally {
        prediction.dispose();
      }
    } catch (error) {
      // 如果該國家的模型未加載或識別失敗，返回默認結果
      console.warn(`國家模型 ${country} 識別失敗:`, error instanceof Error ? error.message : String(error));
      return {
        food_confidence: 0,
        food_index: 0,
      };
    }
  }

  // 從數據庫獲取食物信息（需要根據實際數據庫結構實現）
  // @param country 國家
  // @param foodIndex 食物索引
  private async getFoodInfo(
    country: string,
    foodIndex: number
  ): Promise<any | null> {
    // TODO: 從數據庫查詢食物信息
    // 這裡先返回 null，後續需要集成數據庫查詢
    const cacheKey = `${country}_${foodIndex}`;
    if (this.foodInfoCache.has(cacheKey)) {
      return this.foodInfoCache.get(cacheKey);
    }

    // 暫時返回 null，等待數據庫集成
    return null;
  }
  */
  // ========== 第三層代碼結束 ==========

  /**
   * 批量識別
   * @param imageBuffers 圖像緩衝區數組
   * @returns 識別結果數組
   */
  async recognizeBatch(
    imageBuffers: Buffer[]
  ): Promise<RecognitionResult[]> {
    const results: RecognitionResult[] = [];

    for (const buffer of imageBuffers) {
      const result = await this.recognizeFoodImage(buffer);
      results.push(result);
    }

    return results;
  }
}




