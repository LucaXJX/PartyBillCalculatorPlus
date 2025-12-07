import * as tf from "@tensorflow/tfjs-node";
import sharp from "sharp";

/**
 * 圖像數據增強器
 * 提供各種圖像變換以增加數據多樣性
 */
export class ImageAugmentation {
  /**
   * 隨機旋轉圖像
   * @param buffer 圖像緩衝區
   * @param maxAngle 最大旋轉角度（度）
   * @returns 增強後的圖像緩衝區
   */
  async rotateImage(buffer: Buffer, maxAngle: number = 30): Promise<Buffer> {
    const angle = (Math.random() - 0.5) * 2 * maxAngle; // -maxAngle 到 +maxAngle
    return await sharp(buffer).rotate(angle).toBuffer();
  }

  /**
   * 隨機水平翻轉
   * @param buffer 圖像緩衝區
   * @param probability 翻轉概率（0-1）
   * @returns 增強後的圖像緩衝區
   */
  async flipHorizontal(
    buffer: Buffer,
    probability: number = 0.5
  ): Promise<Buffer> {
    if (Math.random() < probability) {
      return await sharp(buffer).flip().toBuffer();
    }
    return buffer;
  }

  /**
   * 隨機垂直翻轉
   * @param buffer 圖像緩衝區
   * @param probability 翻轉概率
   * @returns 增強後的圖像緩衝區
   */
  async flipVertical(
    buffer: Buffer,
    probability: number = 0.5
  ): Promise<Buffer> {
    if (Math.random() < probability) {
      return await sharp(buffer).flop().toBuffer();
    }
    return buffer;
  }

  /**
   * 調整亮度
   * @param buffer 圖像緩衝區
   * @param minBrightness 最小亮度因子（0.8 = 80%）
   * @param maxBrightness 最大亮度因子（1.2 = 120%）
   * @returns 增強後的圖像緩衝區
   */
  async adjustBrightness(
    buffer: Buffer,
    minBrightness: number = 0.8,
    maxBrightness: number = 1.2
  ): Promise<Buffer> {
    const brightness =
      minBrightness + Math.random() * (maxBrightness - minBrightness);
    return await sharp(buffer).modulate({ brightness }).toBuffer();
  }

  /**
   * 調整飽和度
   * @param buffer 圖像緩衝區
   * @param minSaturation 最小飽和度因子
   * @param maxSaturation 最大飽和度因子
   * @returns 增強後的圖像緩衝區
   */
  async adjustSaturation(
    buffer: Buffer,
    minSaturation: number = 0.8,
    maxSaturation: number = 1.2
  ): Promise<Buffer> {
    const saturation =
      minSaturation + Math.random() * (maxSaturation - minSaturation);
    return await sharp(buffer).modulate({ saturation }).toBuffer();
  }

  /**
   * 隨機裁剪和縮放
   * @param buffer 圖像緩衝區
   * @param targetSize 目標尺寸
   * @param minCropRatio 最小裁剪比例（0.8 = 裁剪 80%）
   * @returns 增強後的圖像緩衝區
   */
  async randomCropAndResize(
    buffer: Buffer,
    targetSize: [number, number],
    minCropRatio: number = 0.8
  ): Promise<Buffer> {
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || targetSize[0];
    const height = metadata.height || targetSize[1];

    // 隨機裁剪區域
    const cropRatio = minCropRatio + Math.random() * (1 - minCropRatio);
    const cropWidth = Math.floor(width * cropRatio);
    const cropHeight = Math.floor(height * cropRatio);
    const x = Math.floor(Math.random() * (width - cropWidth));
    const y = Math.floor(Math.random() * (height - cropHeight));

    return await sharp(buffer)
      .extract({ left: x, top: y, width: cropWidth, height: cropHeight })
      .resize(targetSize[0], targetSize[1], { fit: "fill" })
      .toBuffer();
  }

  /**
   * 應用隨機增強（組合多種變換）
   * @param buffer 圖像緩衝區
   * @param options 增強選項
   * @returns 增強後的圖像緩衝區
   */
  async applyRandomAugmentation(
    buffer: Buffer,
    options?: {
      rotation?: number; // 旋轉角度範圍
      flipHorizontal?: boolean; // 是否水平翻轉
      flipVertical?: boolean; // 是否垂直翻轉
      brightness?: [number, number]; // 亮度範圍
      saturation?: [number, number]; // 飽和度範圍
      cropAndResize?: {
        targetSize: [number, number];
        minCropRatio?: number;
      };
    }
  ): Promise<Buffer> {
    let augmented = buffer;

    // 隨機旋轉
    if (options?.rotation !== undefined && Math.random() > 0.5) {
      augmented = await this.rotateImage(augmented, options.rotation);
    }

    // 水平翻轉
    if (options?.flipHorizontal && Math.random() > 0.5) {
      augmented = await this.flipHorizontal(augmented);
    }

    // 垂直翻轉
    if (options?.flipVertical && Math.random() > 0.5) {
      augmented = await this.flipVertical(augmented);
    }

    // 亮度調整
    if (options?.brightness && Math.random() > 0.5) {
      const [min, max] = options.brightness;
      augmented = await this.adjustBrightness(augmented, min, max);
    }

    // 飽和度調整
    if (options?.saturation && Math.random() > 0.5) {
      const [min, max] = options.saturation;
      augmented = await this.adjustSaturation(augmented, min, max);
    }

    // 裁剪和縮放
    if (options?.cropAndResize && Math.random() > 0.5) {
      augmented = await this.randomCropAndResize(
        augmented,
        options.cropAndResize.targetSize,
        options.cropAndResize.minCropRatio
      );
    }

    return augmented;
  }
}

/**
 * 在 TensorFlow.js 張量層面進行數據增強（更高效）
 */
export class TensorAugmentation {
  /**
   * 增強圖像張量
   * @param imageTensor 圖像張量 [batch, height, width, channels]
   * @param options 增強選項
   * @returns 增強後的張量
   */
  augmentTensor(
    imageTensor: tf.Tensor4D,
    options?: {
      flipHorizontal?: boolean;
      flipVertical?: boolean;
      rotate?: boolean;
      brightness?: boolean;
      contrast?: boolean;
    }
  ): tf.Tensor4D {
    let augmented = imageTensor;

    // 隨機水平翻轉
    if (options?.flipHorizontal && Math.random() > 0.5) {
      augmented = tf.image.flipLeftRight(augmented);
    }

    // 隨機垂直翻轉（TensorFlow.js 沒有 flipUpDown，使用轉置實現）
    if (options?.flipVertical && Math.random() > 0.5) {
      // 通過轉置和水平翻轉實現垂直翻轉
      augmented = tf.transpose(augmented, [0, 2, 1, 3]);
      augmented = tf.image.flipLeftRight(augmented);
      augmented = tf.transpose(augmented, [0, 2, 1, 3]);
    }

    // 隨機旋轉（TensorFlow.js 沒有 rot90，使用轉置實現 90 度旋轉）
    if (options?.rotate && Math.random() > 0.5) {
      const k = Math.floor(Math.random() * 4); // 0, 1, 2, 3
      // 簡單實現：只支持 180 度翻轉（通過兩次水平+垂直翻轉）
      if (k === 2) {
        augmented = tf.image.flipLeftRight(augmented);
        augmented = tf.transpose(augmented, [0, 2, 1, 3]);
        augmented = tf.image.flipLeftRight(augmented);
        augmented = tf.transpose(augmented, [0, 2, 1, 3]);
      }
    }

    // 隨機亮度調整（手動實現）
    if (options?.brightness && Math.random() > 0.5) {
      const delta = (Math.random() - 0.5) * 0.2; // ±0.1
      augmented = augmented.add(tf.scalar(delta));
      augmented = tf.clipByValue(augmented, 0, 1);
    }

    // 隨機對比度調整（手動實現）
    if (options?.contrast && Math.random() > 0.5) {
      const factor = 0.8 + Math.random() * 0.4; // 0.8 到 1.2
      const mean = augmented.mean();
      augmented = augmented.sub(mean).mul(tf.scalar(factor)).add(mean);
      augmented = tf.clipByValue(augmented, 0, 1);
    }

    return augmented;
  }

  /**
   * 在數據管道中應用增強
   * @param dataset 原始數據集
   * @param options 增強選項
   * @returns 增強後的數據集
   */
  augmentDataset(
    dataset: tf.data.Dataset<{ xs: tf.Tensor4D; ys: tf.Tensor }>,
    options?: {
      flipHorizontal?: boolean;
      flipVertical?: boolean;
      rotate?: boolean;
      brightness?: boolean;
      contrast?: boolean;
    }
  ): tf.data.Dataset<{ xs: tf.Tensor4D; ys: tf.Tensor }> {
    return dataset.map((item) => ({
      xs: this.augmentTensor(item.xs, options),
      ys: item.ys,
    }));
  }
}

/**
 * 批量增強圖像
 * @param images 圖像緩衝區數組
 * @param augmentationFactor 每個圖像生成的增強版本數量
 * @param options 增強選項
 * @returns 增強後的圖像數組（包含原始圖像）
 */
export async function augmentBatch(
  images: Buffer[],
  augmentationFactor: number = 2,
  options?: Parameters<ImageAugmentation["applyRandomAugmentation"]>[1]
): Promise<Buffer[]> {
  const augmentation = new ImageAugmentation();
  const augmented: Buffer[] = [];

  for (const image of images) {
    // 原始圖像
    augmented.push(image);

    // 生成增強版本
    for (let i = 0; i < augmentationFactor; i++) {
      const aug = await augmentation.applyRandomAugmentation(image, options);
      augmented.push(aug);
    }
  }

  return augmented;
}

