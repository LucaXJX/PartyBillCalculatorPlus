import * as tf from "@tensorflow/tfjs-node";
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
 * 三層級聯識別管道
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
   * 三層級聯識別流程
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
          confidence: 1 - (level1Result.confidence ?? 0),
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

      // 第三層：細粒度識別（根據國家選擇對應模型）
      const level3Result = await this.level3Inference(
        imageTensor,
        level2Result.country!
      );

      // 獲取食物詳細信息
      const foodInfo = await this.getFoodInfo(
        level2Result.country!,
        level3Result.food_index ?? 0
      );

      // 計算總體置信度
      const overallConfidence =
        (level1Result.confidence ?? 0) *
        (level2Result.country_confidence ?? 0) *
        (level3Result.food_confidence ?? 0);

      return {
        is_food: true,
        country: level2Result.country,
        country_confidence: level2Result.country_confidence,
        food_name: foodInfo?.name || level3Result.food_name,
        food_confidence: level3Result.food_confidence,
        calories: foodInfo?.calories,
        ingredients: foodInfo?.ingredients,
        overall_confidence: overallConfidence,
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
   */
  private async level1Inference(
    imageTensor: tf.Tensor4D
  ): Promise<{ is_food: boolean; confidence: number }> {
    const model = this.modelLoader.getLevel1Model();
    const prediction = model.predict(imageTensor) as tf.Tensor;

    try {
      const probabilities = await prediction.data();
      const foodProbability = probabilities[0];
      const isFood = foodProbability > 0.5;

      return {
        is_food: isFood,
        confidence: foodProbability,
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

  /**
   * 第三層推理：細粒度食物識別
   */
  private async level3Inference(
    imageTensor: tf.Tensor4D,
    country: string
  ): Promise<{
    food_name?: string;
    food_confidence: number;
    food_index: number;
  }> {
    try {
      const model = this.modelLoader.getCountryModel(country);
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
      // 如果該國家的模型未加載，返回默認結果
      console.warn(`國家模型 ${country} 未加載，跳過第三層識別`);
      return {
        food_confidence: 0,
        food_index: 0,
      };
    }
  }

  /**
   * 從數據庫獲取食物信息（需要根據實際數據庫結構實現）
   * @param country 國家
   * @param foodIndex 食物索引
   */
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




