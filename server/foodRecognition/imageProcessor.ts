/**
 * 圖片處理工具
 * 用於壓縮和處理上傳的食物圖片
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 使用 Node.js 內置方法處理圖片（如果沒有 sharp，使用簡單的複製）
// 注意：如果需要真正的圖片壓縮，需要安裝 sharp: npm install sharp
let sharpModule: any = null;

async function loadSharp() {
  if (sharpModule !== null) return sharpModule;
  try {
    const sharpImport = await import("sharp");
    sharpModule = sharpImport.default || sharpImport;
    return sharpModule;
  } catch {
    sharpModule = false; // 標記為已嘗試但失敗
    return null;
  }
}

export interface ImageInfo {
  width: number;
  height: number;
  size: number; // 文件大小（字節）
  format: string; // 圖片格式
}

/**
 * 壓縮圖片
 * @param inputPath 輸入圖片路徑
 * @param outputPath 輸出圖片路徑
 * @param maxWidth 最大寬度（默認 1920）
 * @param maxHeight 最大高度（默認 1920）
 * @param quality 質量（1-100，默認 85）
 */
export async function compressImage(
  inputPath: string,
  outputPath: string,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {}
): Promise<ImageInfo> {
  const { maxWidth = 1920, maxHeight = 1920, quality = 85 } = options;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`輸入圖片不存在: ${inputPath}`);
  }

  // 確保輸出目錄存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sharp = await loadSharp();
  if (sharp) {
    // 使用 sharp 進行壓縮
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // 調整大小
    const resized = image.resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    });

    // 根據格式保存
    if (metadata.format === "jpeg" || metadata.format === "jpg") {
      await resized.jpeg({ quality }).toFile(outputPath);
    } else if (metadata.format === "png") {
      await resized.png({ quality: Math.floor(quality / 100 * 9) }).toFile(outputPath);
    } else if (metadata.format === "webp") {
      await resized.webp({ quality }).toFile(outputPath);
    } else {
      // 其他格式轉換為 JPEG
      await resized.jpeg({ quality }).toFile(outputPath);
    }

    const outputStats = fs.statSync(outputPath);
    const outputMetadata = await sharp(outputPath).metadata();

    return {
      width: outputMetadata.width || 0,
      height: outputMetadata.height || 0,
      size: outputStats.size,
      format: outputMetadata.format || "jpeg",
    };
  } else {
    // 如果沒有 sharp，簡單複製文件（不壓縮）
    // 這是一個降級方案，建議安裝 sharp 以獲得更好的壓縮效果
    console.warn("sharp 未安裝，將直接複製圖片（不壓縮）。建議運行: npm install sharp");
    fs.copyFileSync(inputPath, outputPath);
    const stats = fs.statSync(outputPath);

    // 嘗試讀取圖片尺寸（使用簡單的方法）
    // 注意：這是一個簡化版本，可能不準確
    return {
      width: 0, // 需要 sharp 才能準確獲取
      height: 0,
      size: stats.size,
      format: path.extname(outputPath).slice(1) || "unknown",
    };
  }
}

/**
 * 獲取圖片信息
 */
export async function getImageInfo(imagePath: string): Promise<ImageInfo> {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`圖片不存在: ${imagePath}`);
  }

  const sharp = await loadSharp();
  if (sharp) {
    const metadata = await sharp(imagePath).metadata();
    const stats = fs.statSync(imagePath);

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      size: stats.size,
      format: metadata.format || "unknown",
    };
  } else {
    const stats = fs.statSync(imagePath);
    return {
      width: 0,
      height: 0,
      size: stats.size,
      format: path.extname(imagePath).slice(1) || "unknown",
    };
  }
}

/**
 * 刪除文件（安全刪除，忽略錯誤）
 */
export async function safeDeleteFile(filePath: string): Promise<void> {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`刪除文件失敗: ${filePath}`, error);
    // 不拋出錯誤，允許繼續執行
  }
}

