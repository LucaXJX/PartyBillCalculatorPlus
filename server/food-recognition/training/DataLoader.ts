import * as tf from "@tensorflow/tfjs-node";
import fs from "fs-extra";
import path from "path";
import sharp from "sharp";

/**
 * 數據集配置
 */
export interface DatasetConfig {
  dataPath: string;
  batchSize: number;
  imageSize: [number, number];
  validationSplit?: number; // 驗證集比例，默認 0.15
  testSplit?: number; // 測試集比例，默認 0.15
  shuffle?: boolean; // 是否打亂數據
}

/**
 * 圖像標籤對
 */
export interface ImageLabelPair {
  image: tf.Tensor4D;
  label: tf.Tensor;
  filePath: string;
}

/**
 * 數據加載器
 * 負責從文件系統加載圖像數據集並轉換為 TensorFlow.js 格式
 */
export class DataLoader {
  /**
   * 從目錄結構加載分類數據集
   * 目錄結構：dataPath/class1/, dataPath/class2/, ...
   * @param config 數據集配置
   * @returns 訓練集、驗證集、測試集和類別映射
   */
  async loadClassificationDataset(config: DatasetConfig): Promise<{
    trainDataset: tf.data.Dataset<{ xs: tf.Tensor4D; ys: tf.Tensor }>;
    valDataset: tf.data.Dataset<{ xs: tf.Tensor4D; ys: tf.Tensor }>;
    testDataset: tf.data.Dataset<{ xs: tf.Tensor4D; ys: tf.Tensor }>;
    classNames: string[];
    numClasses: number;
  }> {
    const {
      dataPath,
      batchSize,
      imageSize,
      validationSplit = 0.15,
      testSplit = 0.15,
      shuffle = true,
    } = config;

    // 讀取所有類別目錄
    const entries = await fs.readdir(dataPath, { withFileTypes: true });
    const classDirs = entries
      .filter((entry: fs.Dirent) => entry.isDirectory())
      .map((entry: fs.Dirent) => entry.name)
      .sort();

    if (classDirs.length === 0) {
      throw new Error(`數據目錄中沒有找到類別文件夾: ${dataPath}`);
    }

    console.log(`📁 找到 ${classDirs.length} 個類別: ${classDirs.join(", ")}`);

    // 收集所有圖像文件
    const allImages: Array<{ path: string; classIndex: number }> = [];

    for (let i = 0; i < classDirs.length; i++) {
      const classDir = path.join(dataPath, classDirs[i]);
      const files = await fs.readdir(classDir);
      const imageFiles = files.filter((file: string) =>
        /\.(jpg|jpeg|png|bmp|webp)$/i.test(file)
      );

      for (const file of imageFiles) {
        allImages.push({
          path: path.join(classDir, file),
          classIndex: i,
        });
      }

      console.log(`  ${classDirs[i]}: ${imageFiles.length} 張圖片`);
    }

    if (allImages.length === 0) {
      throw new Error("沒有找到任何圖像文件");
    }

    // 打亂數據
    if (shuffle) {
      this.shuffleArray(allImages);
    }

    // 劃分數據集
    const total = allImages.length;
    const testCount = Math.floor(total * testSplit);
    const valCount = Math.floor(total * validationSplit);
    const trainCount = total - testCount - valCount;

    const testImages = allImages.slice(0, testCount);
    const valImages = allImages.slice(testCount, testCount + valCount);
    const trainImages = allImages.slice(testCount + valCount);

    console.log(
      `📊 數據劃分: 訓練集 ${trainImages.length}, 驗證集 ${valImages.length}, 測試集 ${testImages.length}`
    );

    // 創建數據集
    const trainDataset = this.createDataset(trainImages, imageSize, classDirs.length).batch(batchSize) as tf.data.Dataset<{ xs: tf.Tensor4D; ys: tf.Tensor }>;
    const valDataset = this.createDataset(valImages, imageSize, classDirs.length).batch(batchSize) as tf.data.Dataset<{ xs: tf.Tensor4D; ys: tf.Tensor }>;
    const testDataset = this.createDataset(testImages, imageSize, classDirs.length).batch(batchSize) as tf.data.Dataset<{ xs: tf.Tensor4D; ys: tf.Tensor }>;

    return {
      trainDataset,
      valDataset,
      testDataset,
      classNames: classDirs,
      numClasses: classDirs.length,
    };
  }

  /**
   * 從目錄結構加載二分類數據集（用於第一層：食物/非食物）
   * 目錄結構：dataPath/food/, dataPath/non-food/
   */
  async loadBinaryDataset(config: DatasetConfig): Promise<{
    trainDataset: tf.data.Dataset<{ xs: tf.Tensor4D; ys: tf.Tensor }>;
    valDataset: tf.data.Dataset<{ xs: tf.Tensor4D; ys: tf.Tensor }>;
    testDataset: tf.data.Dataset<{ xs: tf.Tensor4D; ys: tf.Tensor }>;
  }> {
    const result = await this.loadClassificationDataset(config);
    return {
      trainDataset: result.trainDataset,
      valDataset: result.valDataset,
      testDataset: result.testDataset,
    };
  }

  /**
   * 創建 TensorFlow.js 數據集
   */
  private createDataset(
    images: Array<{ path: string; classIndex: number }>,
    imageSize: [number, number],
    numClasses: number
  ): tf.data.Dataset<{ xs: tf.Tensor4D; ys: tf.Tensor }> {
    // 使用 generator 來支持異步圖像加載
    const generator = async function* () {
      for (const item of images) {
        try {
          // 讀取圖像文件
          const buffer = await fs.readFile(item.path);

          // 解碼圖像
          const imageTensor = tf.node.decodeImage(buffer, 3);

          // 調整大小
          const resized = tf.image.resizeBilinear(imageTensor, imageSize);

          // 歸一化到 [0, 1]
          const normalized = resized.div(255.0);

          // 添加批次維度
          const batched = normalized.expandDims(0) as tf.Tensor4D;

          // 創建標籤（one-hot 編碼）
          const label = tf.oneHot(tf.scalar(item.classIndex, "int32"), numClasses);

          // 清理中間張量
          imageTensor.dispose();
          resized.dispose();
          normalized.dispose();

          yield {
            xs: batched,
            ys: label,
          };
        } catch (error) {
          console.error(`加載圖像失敗 ${item.path}:`, error);
          // 跳過錯誤的圖像
          continue;
        }
      }
    };

    return tf.data.generator(generator) as tf.data.Dataset<{ xs: tf.Tensor4D; ys: tf.Tensor }>;
  }

  /**
   * 獲取類別數量
   */
  async getNumClasses(dataPath: string): Promise<number> {
    const entries = await fs.readdir(dataPath, { withFileTypes: true });
    const classDirs = entries.filter((entry: fs.Dirent) => entry.isDirectory());
    return classDirs.length;
  }

  /**
   * 獲取類別名稱列表
   */
  async getClassNames(dataPath: string): Promise<string[]> {
    const entries = await fs.readdir(dataPath, { withFileTypes: true });
    return entries
      .filter((entry: fs.Dirent) => entry.isDirectory())
      .map((entry: fs.Dirent) => entry.name)
      .sort();
  }

  /**
   * 獲取數據集統計信息
   */
  async getDatasetStats(dataPath: string): Promise<{
    totalClasses: number;
    totalImages: number;
    classStats: Array<{ className: string; count: number }>;
  }> {
    const entries = await fs.readdir(dataPath, { withFileTypes: true });
    const classDirs = entries
      .filter((entry: fs.Dirent) => entry.isDirectory())
      .map((entry: fs.Dirent) => entry.name)
      .sort();

    const classStats: Array<{ className: string; count: number }> = [];
    let totalImages = 0;

    for (const className of classDirs) {
      const classPath = path.join(dataPath, className);
      const files = await fs.readdir(classPath);
      const imageFiles = files.filter((file: string) =>
        /\.(jpg|jpeg|png|bmp|webp)$/i.test(file)
      );
      const count = imageFiles.length;
      classStats.push({ className, count });
      totalImages += count;
    }

    return {
      totalClasses: classDirs.length,
      totalImages,
      classStats,
    };
  }

  /**
   * 打亂數組（Fisher-Yates 洗牌算法）
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * 驗證圖像文件
   */
  async validateImageFile(filePath: string): Promise<boolean> {
    try {
      const metadata = await sharp(filePath).metadata();
      return (
        metadata.width !== undefined &&
        metadata.height !== undefined &&
        metadata.width > 0 &&
        metadata.height > 0
      );
    } catch {
      return false;
    }
  }
}

