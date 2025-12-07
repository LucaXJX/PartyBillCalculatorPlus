/**
 * 下載和組織訓練數據
 * 從免費、可靠的數據源獲取食物圖像數據集
 * 主要使用 Food-101 數據集
 */

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 目標數據目錄
const DATA_BASE = path.resolve(__dirname, "../../data");

/**
 * 圖片處理配置
 * 根據不同層級使用不同的圖片尺寸
 */
const IMAGE_PROCESSING_CONFIG = {
  level1: {
    size: [224, 224] as [number, number],
    format: "jpeg" as const,
    quality: 85,
  },
  level2: {
    size: [224, 224] as [number, number],
    format: "jpeg" as const,
    quality: 85,
  },
  level3: {
    size: [380, 380] as [number, number],
    format: "jpeg" as const,
    quality: 90, // 第三層需要更高質量
  },
};

/**
 * 數據集配置
 */
interface DatasetConfig {
  name: string;
  url?: string;
  description: string;
  categories: string[];
  targetCount?: number; // 每個類別目標數量
}

/**
 * 第一層數據集：食物 vs 非食物
 */
const LEVEL1_DATASETS: DatasetConfig[] = [
  {
    name: "food-101",
    description: "Food-101 數據集（101 種食物）",
    categories: ["food"],
    targetCount: 10000,
  },
  {
    name: "imagenet-non-food",
    description: "ImageNet 非食物類別",
    categories: ["non-food"],
    targetCount: 10000,
  },
];

/**
 * 第二層數據集：國家分類
 */
const LEVEL2_DATASETS: DatasetConfig[] = [
  {
    name: "food-101-by-country",
    description: "Food-101 按國家分類",
    categories: [
      "chinese",
      "japanese",
      "korean",
      "thai",
      "indian",
      "italian",
      "french",
      "mexican",
      "american",
    ],
  },
];

/**
 * 第三層數據集：細粒度食物分類
 */
const LEVEL3_DATASETS: DatasetConfig[] = [
  {
    name: "food-101-fine-grained",
    description: "Food-101 細粒度分類",
    categories: [], // 動態從數據集獲取
  },
];

/**
 * 檢查 Food-101 數據集是否已下載
 */
async function checkFood101Exists(): Promise<boolean> {
  const food101Dir = path.join(DATA_BASE, "raw", "food-101");
  const imagesDir = path.join(food101Dir, "images");
  return await fs.pathExists(imagesDir);
}

/**
 * 處理單張圖片：調整大小、轉換格式、優化
 * @param sourceFile 源文件路徑
 * @param targetFile 目標文件路徑
 * @param config 處理配置
 * @param deleteOriginal 是否刪除原始文件
 */
async function processImage(
  sourceFile: string,
  targetFile: string,
  config: {
    size: [number, number];
    format: "jpeg" | "png" | "webp";
    quality: number;
  },
  deleteOriginal: boolean = true
): Promise<boolean> {
  try {
    // 檢查源文件是否存在
    if (!(await fs.pathExists(sourceFile))) {
      return false;
    }

    // 檢查目標文件是否已存在
    if (await fs.pathExists(targetFile)) {
      // 如果目標已存在，直接刪除原始文件（如果需要的話）
      if (deleteOriginal && sourceFile !== targetFile) {
        await fs.remove(sourceFile);
      }
      return true;
    }

    // 使用 sharp 處理圖片
    await sharp(sourceFile)
      .resize(config.size[0], config.size[1], {
        fit: "fill", // 填充整個尺寸
        background: { r: 255, g: 255, b: 255 }, // 白色背景
      })
      .toFormat(config.format, {
        quality: config.quality,
        mozjpeg: true, // 使用 mozjpeg 編碼器（更好的壓縮）
      })
      .toFile(targetFile);

    // 刪除原始文件（如果需要的話）
    if (deleteOriginal && sourceFile !== targetFile) {
      await fs.remove(sourceFile);
    }

    return true;
  } catch (error) {
    console.error(`處理圖片失敗 ${sourceFile}:`, error);
    return false;
  }
}

/**
 * 批量處理圖片
 */
async function processImagesBatch(
  sourceFiles: string[],
  targetDir: string,
  config: {
    size: [number, number];
    format: "jpeg" | "png" | "webp";
    quality: number;
  },
  deleteOriginal: boolean = true,
  progressCallback?: (current: number, total: number) => void
): Promise<number> {
  let processed = 0;
  const total = sourceFiles.length;

  for (let i = 0; i < sourceFiles.length; i++) {
    const sourceFile = sourceFiles[i];
    const fileName = path.basename(sourceFile);
    const nameWithoutExt = path.parse(fileName).name;
    const targetFile = path.join(
      targetDir,
      `${nameWithoutExt}.${config.format}`
    );

    const success = await processImage(
      sourceFile,
      targetFile,
      config,
      deleteOriginal
    );

    if (success) {
      processed++;
    }

    if (progressCallback && (i + 1) % 10 === 0) {
      progressCallback(i + 1, total);
    }
  }

  return processed;
}

/**
 * 從 Food-101 數據集組織第一層數據（食物檢測）
 */
async function organizeLevel1Data() {
  console.log("\n📂 組織第一層數據（食物檢測）...");

  const targetDir = path.join(DATA_BASE, "level1-food-detection");
  const foodDir = path.join(targetDir, "food");
  const nonFoodDir = path.join(targetDir, "non-food");

  await fs.ensureDir(foodDir);
  await fs.ensureDir(nonFoodDir);

  // 檢查 Food-101 是否已下載
  const food101Dir = path.join(DATA_BASE, "raw", "food-101");
  const food101ImagesDir = path.join(food101Dir, "images");

  if (!(await checkFood101Exists())) {
    console.warn("⚠️  Food-101 數據集未找到");
    console.log("💡 請先下載 Food-101 數據集：");
    console.log("   1. 訪問 https://www.vision.ee.ethz.ch/datasets_extra/food-101/");
    console.log("   2. 下載 food-101.tar.gz");
    console.log(`   3. 解壓到: ${food101Dir}`);
    console.log("   4. 確保目錄結構為: food-101/images/...");
    console.log("\n   或運行自動下載（如果可用）:");
    await downloadFood101();
    return;
  }

  console.log("✅ Food-101 數據集已找到");

  // 從 Food-101 處理食物圖像
  if (await fs.pathExists(food101ImagesDir)) {
    const categories = await fs.readdir(food101ImagesDir, { withFileTypes: true });

    let copied = 0;
    for (const category of categories) {
      if (!category.isDirectory()) continue;

      const categoryPath = path.join(food101ImagesDir, category.name);
      const files = await fs.readdir(categoryPath);
      const imageFiles = files.filter((file) =>
        /\.(jpg|jpeg|png)$/i.test(file)
      );

      const sourceFiles: string[] = [];
      for (const file of imageFiles.slice(0, 100)) {
        // 限制每個類別 100 張
        const sourceFile = path.join(categoryPath, file);
        sourceFiles.push(sourceFile);
      }

      // 批量處理圖片：調整大小、轉換格式、優化
      if (sourceFiles.length > 0) {
        const processed = await processImagesBatch(
          sourceFiles,
          foodDir,
          IMAGE_PROCESSING_CONFIG.level1,
          true, // 刪除原始文件
          (current, total) => {
            if (current % 50 === 0) {
              console.log(`    處理進度: ${current}/${total}`);
            }
          }
        );

        copied += processed;
      }
    }

    console.log(`  ✅ 已複製 ${copied} 張食物圖像`);
  }

  // 非食物圖像：從 ImageNet 或其他來源
  console.log("\n  ⚠️  非食物圖像需要手動收集");
  console.log("  💡 建議來源：");
  console.log("     - ImageNet 非食物類別");
  console.log("     - COCO 數據集（人物、動物、物品等）");
  console.log("     - 或使用公開的非食物圖像數據集");
}

/**
 * 從 Food-101 組織第二層數據（國家分類）
 */
async function organizeLevel2Data() {
  console.log("\n📂 組織第二層數據（國家分類）...");

  const targetDir = path.join(DATA_BASE, "level2-country-classification");
  await fs.ensureDir(targetDir);

  // 國家到 Food-101 類別的映射
  const countryMapping: { [country: string]: string[] } = {
    chinese: [
      "chicken_curry",
      "chicken_wings",
      "fried_rice",
      "spring_rolls",
      "wonton_soup",
    ],
    japanese: [
      "sushi",
      "ramen",
      "miso_soup",
      "tempura",
      "teriyaki_chicken",
    ],
    korean: [
      "bibimbap",
      "bulgogi",
      "kimchi",
    ],
    thai: [
      "pad_thai",
      "tom_yum_soup",
      "green_curry",
    ],
    indian: [
      "chicken_curry",
      "naan",
      "samosa",
      "butter_chicken",
    ],
    italian: [
      "pizza",
      "pasta_carbonara",
      "lasagna",
      "bruschetta",
      "ravioli",
    ],
    french: [
      "french_toast",
      "french_onion_soup",
      "creme_brulee",
      "croque_madame",
    ],
    mexican: [
      "tacos",
      "burrito",
      "nachos",
      "quesadilla",
    ],
    american: [
      "hamburger",
      "hot_dog",
      "french_fries",
      "apple_pie",
    ],
  };

  const food101Dir = path.join(DATA_BASE, "raw", "food-101", "images");
  if (!(await fs.pathExists(food101Dir))) {
    console.warn("⚠️  Food-101 數據集未找到，請先運行第一層數據組織");
    return;
  }

  // 為每個國家創建目錄並複製圖像
  for (const [country, categories] of Object.entries(countryMapping)) {
    const countryDir = path.join(targetDir, country);
    await fs.ensureDir(countryDir);

    let copied = 0;
    for (const category of categories) {
      const categoryPath = path.join(food101Dir, category);
      if (!(await fs.pathExists(categoryPath))) {
        continue;
      }

      const files = await fs.readdir(categoryPath);
      const imageFiles = files.filter((file) =>
        /\.(jpg|jpeg|png)$/i.test(file)
      );

      const sourceFiles: string[] = [];
      for (const file of imageFiles.slice(0, 50)) {
        // 每個類別最多 50 張
        const sourceFile = path.join(categoryPath, file);
        sourceFiles.push(sourceFile);
      }

      // 批量處理圖片
      if (sourceFiles.length > 0) {
        const processed = await processImagesBatch(
          sourceFiles,
          countryDir,
          IMAGE_PROCESSING_CONFIG.level2,
          true, // 刪除原始文件
          (current, total) => {
            if (current % 20 === 0) {
              console.log(`    處理進度: ${current}/${total}`);
            }
          }
        );

        copied += processed;
      }
    }

    console.log(`  ✅ ${country}: ${copied} 張圖像`);
  }
}

/**
 * 組織第三層數據（細粒度分類）
 */
async function organizeLevel3Data() {
  console.log("\n📂 組織第三層數據（細粒度分類）...");

  const targetDir = path.join(DATA_BASE, "level3-fine-grained");
  await fs.ensureDir(targetDir);

  const food101Dir = path.join(DATA_BASE, "raw", "food-101", "images");
  if (!(await fs.pathExists(food101Dir))) {
    console.warn("⚠️  Food-101 數據集未找到");
    return;
  }

  // 按國家組織細粒度數據
  const countryCategories: { [country: string]: string[] } = {
    chinese: [
      "chicken_curry",
      "chicken_wings",
      "fried_rice",
      "spring_rolls",
      "wonton_soup",
    ],
    japanese: ["sushi", "ramen", "miso_soup", "tempura", "teriyaki_chicken"],
  };

  for (const [country, categories] of Object.entries(countryCategories)) {
    const countryDir = path.join(targetDir, country);
    await fs.ensureDir(countryDir);

    for (const category of categories) {
      const categoryDir = path.join(countryDir, category);
      await fs.ensureDir(categoryDir);

      const sourceCategoryPath = path.join(food101Dir, category);
      if (!(await fs.pathExists(sourceCategoryPath))) {
        continue;
      }

      const files = await fs.readdir(sourceCategoryPath);
      const imageFiles = files.filter((file) =>
        /\.(jpg|jpeg|png)$/i.test(file)
      );

      // 批量處理圖片
      const sourceFiles = imageFiles.map((file) =>
        path.join(sourceCategoryPath, file)
      );

      let copied = 0;
      if (sourceFiles.length > 0) {
        const processed = await processImagesBatch(
          sourceFiles,
          categoryDir,
          IMAGE_PROCESSING_CONFIG.level3,
          true, // 刪除原始文件
          (current, total) => {
            if (current % 50 === 0) {
              console.log(`    處理進度: ${current}/${total}`);
            }
          }
        );

        copied = processed;
      }

      console.log(`  ✅ ${country}/${category}: ${copied} 張圖像`);
    }
  }
}

/**
 * 下載 Food-101 數據集（如果 image-dataset 不支持，提供手動下載指南）
 */
async function downloadFood101(): Promise<boolean> {
  console.log("\n📥 嘗試下載 Food-101 數據集...");

  const food101Dir = path.join(DATA_BASE, "raw", "food-101");
  await fs.ensureDir(food101Dir);

  // Food-101 下載 URL
  const downloadUrl =
    "https://data.vision.ee.ethz.ch/cvl/food-101.tar.gz";
  const tarPath = path.join(food101Dir, "food-101.tar.gz");

  try {
    console.log("  ⬇️  正在下載 Food-101...");
    console.log("  ⚠️  注意：Food-101 約 5GB，下載可能需要較長時間");
    
    const response = await axios({
      method: "GET",
      url: downloadUrl,
      responseType: "stream",
      timeout: 300000, // 5 分鐘超時
    });

    const writer = fs.createWriteStream(tarPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    console.log("  ✅ 下載完成");
    console.log("  💡 請手動解壓縮 food-101.tar.gz");
    console.log(`     解壓到: ${food101Dir}`);
    console.log("     解壓後目錄結構應為: food-101/images/類別名/圖片文件");

    return true;
  } catch (error) {
    console.warn("  ⚠️  自動下載失敗");
    console.log("  💡 請手動下載 Food-101 數據集：");
    console.log("     https://www.vision.ee.ethz.ch/datasets_extra/food-101/");
    console.log(`     解壓到: ${food101Dir}`);
    return false;
  }
}

/**
 * 清理原始數據（可選，在處理完成後）
 */
async function cleanupRawData() {
  console.log("\n🧹 清理原始數據...");

  const food101Dir = path.join(DATA_BASE, "raw", "food-101");
  const imagesDir = path.join(food101Dir, "images");

  if (await fs.pathExists(imagesDir)) {
    console.log("  ⚠️  原始圖片已處理完成，是否刪除原始數據？");
    console.log(`     原始數據目錄: ${imagesDir}`);
    console.log("  💡 建議：保留原始數據以便重新處理，或手動刪除");
    // 不自動刪除，讓用戶手動決定
  }
}

/**
 * 顯示數據統計
 */
async function showStatistics() {
  console.log("\n📊 數據統計");
  console.log("=".repeat(60));

  // 第一層統計
  const level1Dir = path.join(DATA_BASE, "level1-food-detection");
  if (await fs.pathExists(level1Dir)) {
    const foodDir = path.join(level1Dir, "food");
    const nonFoodDir = path.join(level1Dir, "non-food");

    if (await fs.pathExists(foodDir)) {
      const files = await fs.readdir(foodDir);
      const images = files.filter((file) =>
        /\.(jpg|jpeg|png)$/i.test(file)
      );
      console.log(`第一層 - food: ${images.length} 張`);
    }

    if (await fs.pathExists(nonFoodDir)) {
      const files = await fs.readdir(nonFoodDir);
      const images = files.filter((file) =>
        /\.(jpg|jpeg|png)$/i.test(file)
      );
      console.log(`第一層 - non-food: ${images.length} 張`);
    }
  }

  // 第二層統計
  const level2Dir = path.join(DATA_BASE, "level2-country-classification");
  if (await fs.pathExists(level2Dir)) {
    const countries = await fs.readdir(level2Dir, { withFileTypes: true });
    let total = 0;

    console.log("\n第二層 - 國家分類:");
    for (const entry of countries) {
      if (!entry.isDirectory()) continue;

      const countryPath = path.join(level2Dir, entry.name);
      const files = await fs.readdir(countryPath);
      const images = files.filter((file) =>
        /\.(jpg|jpeg|png)$/i.test(file)
      );

      console.log(`  ${entry.name.padEnd(15)} : ${images.length} 張`);
      total += images.length;
    }
    console.log(`  總計: ${total} 張`);
  }

  // 第三層統計
  const level3Dir = path.join(DATA_BASE, "level3-fine-grained");
  if (await fs.pathExists(level3Dir)) {
    const countries = await fs.readdir(level3Dir, { withFileTypes: true });

    console.log("\n第三層 - 細粒度分類:");
    for (const countryEntry of countries) {
      if (!countryEntry.isDirectory()) continue;

      const countryPath = path.join(level3Dir, countryEntry.name);
      const categories = await fs.readdir(countryPath, { withFileTypes: true });

      let countryTotal = 0;
      for (const categoryEntry of categories) {
        if (!categoryEntry.isDirectory()) continue;

        const categoryPath = path.join(countryPath, categoryEntry.name);
        const files = await fs.readdir(categoryPath);
        const images = files.filter((file) =>
          /\.(jpg|jpeg|png)$/i.test(file)
        );

        countryTotal += images.length;
      }

      console.log(`  ${countryEntry.name}: ${countryTotal} 張（${categories.length} 個類別）`);
    }
  }

  console.log("=".repeat(60));
}

/**
 * 主函數
 */
async function main() {
  console.log("🚀 開始下載和組織訓練數據...");
  console.log("=".repeat(60));

  try {
    // 下載 Food-101 數據集
    await downloadFood101();

    // 組織第一層數據
    await organizeLevel1Data();

    // 組織第二層數據
    await organizeLevel2Data();

    // 組織第三層數據
    await organizeLevel3Data();

    // 顯示統計
    await showStatistics();

    // 可選：清理原始數據
    // await cleanupRawData();

    console.log("\n✅ 數據組織完成！");
    console.log("\n📊 處理摘要：");
    console.log("  - 所有圖片已調整到目標尺寸");
    console.log("  - 圖片格式已統一為 JPEG");
    console.log("  - 圖片已優化壓縮");
    console.log("  - 原始圖片已刪除（節省空間）");
    console.log("\n📝 下一步：");
    console.log("  1. 檢查數據目錄結構");
    console.log("  2. 補充非食物圖像（第一層）");
    console.log("  3. 運行訓練腳本：pnpm run train:level1");
  } catch (error) {
    console.error("\n❌ 數據組織失敗:", error);
    process.exit(1);
  }
}

// 執行
main();

