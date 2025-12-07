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

// 添加全局錯誤處理
process.on("unhandledRejection", (reason, promise) => {
  console.error("未處理的 Promise 拒絕:", reason);
  console.error("Promise:", promise);
  if (reason instanceof Error) {
    console.error("錯誤詳情:", reason.message);
    console.error("堆棧:", reason.stack);
  }
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("未捕獲的異常:", error);
  console.error("錯誤詳情:", error.message);
  console.error("堆棧:", error.stack);
  process.exit(1);
});

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
 * 返回: { exists: boolean, isExtracted: boolean, tarPath: string, imagesDir: string }
 */
async function checkFood101Status(): Promise<{
  exists: boolean;
  isExtracted: boolean;
  tarPath: string;
  imagesDir: string;
}> {
  const food101Dir = path.join(DATA_BASE, "raw", "food-101");
  const tarPath = path.join(food101Dir, "food-101.tar.gz");
  
  // 檢查兩種可能的目錄結構
  const imagesDir1 = path.join(food101Dir, "images");
  const imagesDir2 = path.join(food101Dir, "food-101", "images");
  const imagesDir = (await fs.pathExists(imagesDir1)) ? imagesDir1 : 
                   (await fs.pathExists(imagesDir2)) ? imagesDir2 : imagesDir1; // 默認使用第一種
  
  const tarExists = await fs.pathExists(tarPath);
  const imagesExists = await fs.pathExists(imagesDir1) || await fs.pathExists(imagesDir2);
  
  return {
    exists: tarExists || imagesExists,
    isExtracted: imagesExists,
    tarPath,
    imagesDir: imagesExists ? (await fs.pathExists(imagesDir1) ? imagesDir1 : imagesDir2) : imagesDir1,
  };
}

/**
 * 檢查 Food-101 數據集是否已下載（兼容舊接口）
 */
async function checkFood101Exists(): Promise<boolean> {
  const status = await checkFood101Status();
  return status.isExtracted; // 只有解壓後才認為存在
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

  // 檢查 Food-101 狀態
  const status = await checkFood101Status();
  
  if (!status.isExtracted) {
    if (status.exists) {
      console.warn("⚠️  Food-101 tar.gz 文件已存在，但未解壓");
      console.log(`   文件位置: ${status.tarPath}`);
      console.log("💡 請手動解壓縮：");
      console.log(`   解壓到: ${path.dirname(status.tarPath)}`);
      console.log("   解壓後目錄結構應為: food-101/images/類別名/圖片文件");
      console.log("\n   提示：可以使用以下命令解壓（在 Git Bash 中）：");
      console.log(`   cd ${path.dirname(status.tarPath)}`);
      console.log("   tar -xzf food-101.tar.gz");
      return;
    } else {
      console.warn("⚠️  Food-101 數據集未找到");
      console.log("💡 請先下載 Food-101 數據集：");
      console.log("   1. 訪問 https://www.vision.ee.ethz.ch/datasets_extra/food-101/");
      console.log("   2. 下載 food-101.tar.gz");
      console.log(`   3. 解壓到: ${path.dirname(status.tarPath)}`);
      console.log("   4. 確保目錄結構為: food-101/images/...");
      console.log("\n   或運行自動下載（如果可用）:");
      const downloaded = await downloadFood101();
      if (!downloaded) {
        return; // 下載失敗或需要解壓
      }
    }
  }
  
  // 使用正確的 images 目錄路徑
  let food101ImagesDir = status.imagesDir;
  
  // 如果默認路徑不存在，嘗試 food-101/food-101/images
  if (!(await fs.pathExists(food101ImagesDir))) {
    const altPath = path.join(DATA_BASE, "raw", "food-101", "food-101", "images");
    if (await fs.pathExists(altPath)) {
      food101ImagesDir = altPath;
      console.log(`  ℹ️  使用替代路徑: ${altPath}`);
    }
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
      // 增加到 120 張（與第二層一致）
      const maxImages = 120;
      for (const file of imageFiles.slice(0, maxImages)) {
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

  // 檢查兩種可能的目錄結構
  const food101Dir1 = path.join(DATA_BASE, "raw", "food-101", "images");
  const food101Dir2 = path.join(DATA_BASE, "raw", "food-101", "food-101", "images");
  const food101Dir = (await fs.pathExists(food101Dir1)) ? food101Dir1 : 
                    (await fs.pathExists(food101Dir2)) ? food101Dir2 : null;
  
  if (!food101Dir) {
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
      // 增加到 120 張（平衡數據量和處理時間）
      const maxImages = 120;
      for (const file of imageFiles.slice(0, maxImages)) {
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

  // 檢查兩種可能的目錄結構
  const food101Dir1 = path.join(DATA_BASE, "raw", "food-101", "images");
  const food101Dir2 = path.join(DATA_BASE, "raw", "food-101", "food-101", "images");
  const food101Dir = (await fs.pathExists(food101Dir1)) ? food101Dir1 : 
                    (await fs.pathExists(food101Dir2)) ? food101Dir2 : null;
  
  if (!food101Dir) {
    console.warn("⚠️  Food-101 數據集未找到");
    return;
  }

  // 按國家組織細粒度數據（擴展到所有國家，僅使用 Food-101 中實際存在的類別）
  const countryCategories: { [country: string]: string[] } = {
    chinese: [
      "chicken_curry",
      "chicken_wings",
      "fried_rice",
      "spring_rolls",
      "hot_and_sour_soup",
    ],
    japanese: [
      "sushi",
      "ramen",
      "miso_soup",
      "seaweed_salad",
      "edamame",
    ],
    american: [
      "hamburger",
      "hot_dog",
      "french_fries",
      "apple_pie",
      "waffles",
    ],
    italian: [
      "pizza",
      "lasagna",
      "bruschetta",
      "ravioli",
      "spaghetti_bolognese",
    ],
    mexican: [
      "tacos",
      "breakfast_burrito",
      "nachos",
      "chicken_quesadilla",
      "churros",
    ],
    french: [
      "french_toast",
      "french_onion_soup",
      "creme_brulee",
      "croque_madame",
      "macarons",
    ],
    indian: [
      "chicken_curry", // 與 chinese 共享，但可用於訓練
      "samosa",
      "lamb_chops",
      "beef_carpaccio",
      "beef_tartare",
    ],
    korean: [
      "bibimbap",
      "beef_tartare",
      "beef_carpaccio",
      "lamb_chops",
      "seaweed_salad",
    ],
    thai: [
      "pad_thai",
      "beef_carpaccio",
      "beef_tartare",
      "lamb_chops",
      "fried_rice", // 與 chinese 共享
    ],
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

      // 限制每個類別最多 120 張（與第二層一致）
      const maxImages = 120;
      const sourceFiles = imageFiles.slice(0, maxImages).map((file) =>
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

  // 檢查狀態
  const status = await checkFood101Status();
  
  if (status.isExtracted) {
    console.log("  ✅ Food-101 數據集已解壓，跳過下載");
    return true;
  }
  
  if (status.exists && !status.isExtracted) {
    console.log("  ⚠️  Food-101 tar.gz 文件已存在，但未解壓");
    console.log(`     文件位置: ${status.tarPath}`);
    console.log("  💡 請手動解壓縮，或等待腳本自動解壓（如果實現了）");
    console.log(`     解壓到: ${path.dirname(status.tarPath)}`);
    return false; // 返回 false，讓調用者知道需要解壓
  }

  const food101Dir = path.join(DATA_BASE, "raw", "food-101");
  await fs.ensureDir(food101Dir);

  // Food-101 下載 URL
  const downloadUrl =
    "https://data.vision.ee.ethz.ch/cvl/food-101.tar.gz";
  const tarPath = path.join(food101Dir, "food-101.tar.gz");

  // 檢查是否已經部分下載
  let downloadedBytes = 0;
  if (await fs.pathExists(tarPath)) {
    const stats = await fs.stat(tarPath);
    downloadedBytes = stats.size;
    if (downloadedBytes > 0) {
      console.log(`  ℹ️  發現部分下載的文件 (${(downloadedBytes / 1024 / 1024).toFixed(2)} MB)`);
      console.log("  💡 將繼續下載...");
    }
  }

  try {
    console.log("  ⬇️  正在下載 Food-101...");
    console.log("  ⚠️  注意：Food-101 約 5GB，下載可能需要較長時間");
    
    const response = await axios({
      method: "GET",
      url: downloadUrl,
      responseType: "stream",
      timeout: 0, // 無超時（大文件下載）
      headers: downloadedBytes > 0 ? {
        Range: `bytes=${downloadedBytes}-`
      } : undefined,
    });

    const totalBytes = parseInt(response.headers["content-length"] || "0") + downloadedBytes;
    let receivedBytes = downloadedBytes;
    const startTime = Date.now();

    const writer = fs.createWriteStream(tarPath, {
      flags: downloadedBytes > 0 ? "a" : "w", // 追加模式（如果部分下載）
    });
    
    response.data.on("data", (chunk: Buffer) => {
      receivedBytes += chunk.length;
      const elapsed = (Date.now() - startTime) / 1000; // 秒
      const speed = receivedBytes / elapsed / 1024 / 1024; // MB/s
      const progress = totalBytes > 0 ? ((receivedBytes / totalBytes) * 100).toFixed(1) : "?";
      const receivedMB = (receivedBytes / 1024 / 1024).toFixed(2);
      const totalMB = totalBytes > 0 ? (totalBytes / 1024 / 1024).toFixed(2) : "?";
      
      // 每 10MB 顯示一次進度
      if (receivedBytes % (10 * 1024 * 1024) < chunk.length || receivedBytes === totalBytes) {
        process.stdout.write(
          `\r  📥 進度: ${progress}% (${receivedMB} MB / ${totalMB} MB) | 速度: ${speed.toFixed(2)} MB/s`
        );
      }
    });

    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on("finish", async () => {
        console.log("\n  ✅ 下載完成");
        
        // 驗證文件完整性
        const finalStats = await fs.stat(tarPath);
        const finalSize = finalStats.size;
        const expectedSize = totalBytes;
        
        console.log(`  📊 文件大小: ${(finalSize / 1024 / 1024).toFixed(2)} MB`);
        if (expectedSize > 0) {
          const sizeDiff = Math.abs(finalSize - expectedSize);
          const sizeDiffMB = sizeDiff / 1024 / 1024;
          if (sizeDiffMB > 10) {
            console.warn(`  ⚠️  文件大小不匹配（差異: ${sizeDiffMB.toFixed(2)} MB）`);
            console.warn(`     預期: ${(expectedSize / 1024 / 1024).toFixed(2)} MB`);
            console.warn(`     實際: ${(finalSize / 1024 / 1024).toFixed(2)} MB`);
            console.warn(`  💡 文件可能下載不完整，建議重新下載`);
          } else {
            console.log(`  ✅ 文件大小驗證通過`);
          }
        }
        
        resolve();
      });
      writer.on("error", (err) => reject(err));
      response.data.on("error", (err) => reject(err));
    });

    console.log("  ✅ 下載完成");
    console.log("  💡 下載完成後，請運行解壓腳本：");
    console.log("     pnpm run data:extract");
    console.log(`     或手動解壓到: ${food101Dir}`);

    return true;
  } catch (error) {
    console.warn("  ⚠️  自動下載失敗");
    if (error instanceof Error) {
      console.warn(`     錯誤: ${error.message}`);
    }
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
main().catch((error) => {
  console.error("\n❌ 未捕獲的錯誤:");
  console.error("錯誤類型:", typeof error);
  console.error("錯誤值:", error);
  if (error instanceof Error) {
    console.error("錯誤詳情:", error.message);
    console.error("堆棧:", error.stack);
  } else {
    console.error("錯誤對象:", JSON.stringify(error, null, 2));
  }
  process.exit(1);
});

