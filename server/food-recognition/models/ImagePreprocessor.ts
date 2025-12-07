import * as tf from "@tensorflow/tfjs-node";
import sharp from "sharp";

/**
 * 圖像預處理器
 * 負責將原始圖像轉換為模型輸入格式
 */
export class ImagePreprocessor {
  /**
   * 將圖像預處理為模型輸入格式
   * @param imageBuffer 圖像緩衝區
   * @param targetSize 目標尺寸 [width, height]
   * @returns 預處理後的張量 (batch_size=1, height, width, channels)
   */
  async preprocessImage(
    imageBuffer: Buffer,
    targetSize: [number, number] = [224, 224]
  ): Promise<tf.Tensor4D> {
    try {
      // 使用 TensorFlow.js 的 node.decodeImage 解碼圖像
      const imageTensor = tf.node.decodeImage(imageBuffer, 3); // 3 channels (RGB)

      // 調整大小
      const resized = tf.image.resizeBilinear(imageTensor, targetSize);

      // 歸一化到 [0, 1] 範圍
      const normalized = resized.div(255.0);

      // 添加批次維度 [1, height, width, channels]
      const batched = normalized.expandDims(0);

      // 清理中間張量（避免內存洩漏）
      imageTensor.dispose();
      resized.dispose();
      normalized.dispose();

      return batched as tf.Tensor4D;
    } catch (error) {
      throw new Error(`圖像預處理失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 批量預處理圖像
   * @param imageBuffers 圖像緩衝區數組
   * @param targetSize 目標尺寸
   * @returns 預處理後的張量 (batch_size, height, width, channels)
   */
  async preprocessBatch(
    imageBuffers: Buffer[],
    targetSize: [number, number] = [224, 224]
  ): Promise<tf.Tensor4D> {
    const preprocessed = await Promise.all(
      imageBuffers.map((buf) => this.preprocessImage(buf, targetSize))
    );

    // 合併所有批次
    const concatenated = tf.concat(preprocessed, 0);

    // 清理中間張量
    preprocessed.forEach((tensor) => tensor.dispose());

    return concatenated as tf.Tensor4D;
  }

  /**
   * 使用 sharp 進行圖像預處理（用於非模型輸入的圖像處理）
   * @param imageBuffer 圖像緩衝區
   * @param targetSize 目標尺寸
   * @returns 處理後的圖像緩衝區
   */
  async preprocessWithSharp(
    imageBuffer: Buffer,
    targetSize: [number, number] = [224, 224]
  ): Promise<Buffer> {
    return await sharp(imageBuffer)
      .resize(targetSize[0], targetSize[1], {
        fit: "fill",
        background: { r: 0, g: 0, b: 0 },
      })
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  /**
   * 驗證圖像格式
   * @param imageBuffer 圖像緩衝區
   * @returns 是否為有效圖像
   */
  async validateImage(imageBuffer: Buffer): Promise<boolean> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
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



