/**
 * 檢查數據處理狀態
 * 顯示當前處理進度和完成情況
 */

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_BASE = path.resolve(__dirname, "../../data");

interface ProcessingStatus {
  level1: {
    food: number;
    nonFood: number;
    total: number;
    completed: boolean;
  };
  level2: {
    countries: { [key: string]: number };
    total: number;
    completed: boolean;
  };
  level3: {
    countries: { [key: string]: { categories: number; total: number } };
    total: number;
    completed: boolean;
  };
}

async function checkStatus(): Promise<ProcessingStatus> {
  const status: ProcessingStatus = {
    level1: { food: 0, nonFood: 0, total: 0, completed: false },
    level2: { countries: {}, total: 0, completed: false },
    level3: { countries: {}, total: 0, completed: false },
  };

  // 檢查第一層
  const level1Dir = path.join(DATA_BASE, "level1-food-detection");
  if (await fs.pathExists(level1Dir)) {
    const foodDir = path.join(level1Dir, "food");
    const nonFoodDir = path.join(level1Dir, "non-food");

    if (await fs.pathExists(foodDir)) {
      const files = await fs.readdir(foodDir);
      status.level1.food = files.filter((f) => /\.(jpg|jpeg|png)$/i.test(f)).length;
    }

    if (await fs.pathExists(nonFoodDir)) {
      const files = await fs.readdir(nonFoodDir);
      status.level1.nonFood = files.filter((f) => /\.(jpg|jpeg|png)$/i.test(f)).length;
    }

    status.level1.total = status.level1.food + status.level1.nonFood;
    status.level1.completed = status.level1.food > 0; // 至少有一些食物圖片
  }

  // 檢查第二層
  const level2Dir = path.join(DATA_BASE, "level2-country-classification");
  if (await fs.pathExists(level2Dir)) {
    const countries = await fs.readdir(level2Dir, { withFileTypes: true });
    let total = 0;

    for (const country of countries) {
      if (!country.isDirectory()) continue;

      const countryPath = path.join(level2Dir, country.name);
      const files = await fs.readdir(countryPath);
      const images = files.filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
      const count = images.length;

      status.level2.countries[country.name] = count;
      total += count;
    }

    status.level2.total = total;
    status.level2.completed = total > 0;
  }

  // 檢查第三層
  const level3Dir = path.join(DATA_BASE, "level3-fine-grained");
  if (await fs.pathExists(level3Dir)) {
    const countries = await fs.readdir(level3Dir, { withFileTypes: true });
    let total = 0;

    for (const country of countries) {
      if (!country.isDirectory()) continue;

      const countryPath = path.join(level3Dir, country.name);
      const categories = await fs.readdir(countryPath, { withFileTypes: true });
      let countryTotal = 0;
      let categoryCount = 0;

      for (const category of categories) {
        if (!category.isDirectory()) continue;

        const categoryPath = path.join(countryPath, category.name);
        const files = await fs.readdir(categoryPath);
        const images = files.filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
        countryTotal += images.length;
        categoryCount++;
      }

      status.level3.countries[country.name] = {
        categories: categoryCount,
        total: countryTotal,
      };
      total += countryTotal;
    }

    status.level3.total = total;
    status.level3.completed = total > 0;
  }

  return status;
}

function printStatus(status: ProcessingStatus) {
  console.log("\n" + "=".repeat(60));
  console.log("📊 數據處理狀態");
  console.log("=".repeat(60));

  // 第一層
  console.log("\n第一層 - 食物檢測:");
  console.log(`  ✅ 食物圖片: ${status.level1.food.toLocaleString()} 張`);
  console.log(`  ${status.level1.nonFood > 0 ? "✅" : "⏳"} 非食物圖片: ${status.level1.nonFood.toLocaleString()} 張`);
  console.log(`  📦 總計: ${status.level1.total.toLocaleString()} 張`);
  console.log(`  狀態: ${status.level1.completed ? "✅ 已完成" : "⏳ 處理中..."}`);

  // 第二層
  console.log("\n第二層 - 國家分類:");
  if (Object.keys(status.level2.countries).length > 0) {
    for (const [country, count] of Object.entries(status.level2.countries)) {
      console.log(`  ${country.padEnd(15)}: ${count.toLocaleString()} 張`);
    }
    console.log(`  📦 總計: ${status.level2.total.toLocaleString()} 張`);
  } else {
    console.log("  ⏳ 尚未處理");
  }
  console.log(`  狀態: ${status.level2.completed ? "✅ 已完成" : "⏳ 處理中..."}`);

  // 第三層
  console.log("\n第三層 - 細粒度分類:");
  if (Object.keys(status.level3.countries).length > 0) {
    for (const [country, info] of Object.entries(status.level3.countries)) {
      console.log(`  ${country.padEnd(15)}: ${info.total.toLocaleString()} 張 (${info.categories} 個類別)`);
    }
    console.log(`  📦 總計: ${status.level3.total.toLocaleString()} 張`);
  } else {
    console.log("  ⏳ 尚未處理");
  }
  console.log(`  狀態: ${status.level3.completed ? "✅ 已完成" : "⏳ 處理中..."}`);

  // 總體狀態
  console.log("\n" + "=".repeat(60));
  const allCompleted =
    status.level1.completed && status.level2.completed && status.level3.completed;
  console.log(`總體狀態: ${allCompleted ? "✅ 全部完成" : "⏳ 處理中..."}`);
  console.log("=".repeat(60) + "\n");
}

async function main() {
  try {
    const status = await checkStatus();
    printStatus(status);

    // 如果全部完成，給出下一步提示
    if (
      status.level1.completed &&
      status.level2.completed &&
      status.level3.completed
    ) {
      console.log("🎉 數據處理完成！");
      console.log("\n📝 下一步：");
      console.log("  1. 檢查數據質量");
      console.log("  2. 運行訓練腳本：");
      console.log("     cd food-recognition-service");
      console.log("     python train/train_level1.py");
      console.log("     python train/train_level2.py");
      console.log("     python train/train_level3.py");
      console.log("  3. 轉換模型：");
      console.log("     python convert/convert_to_tfjs.py");
    }
  } catch (error) {
    console.error("❌ 檢查狀態失敗:", error);
    process.exit(1);
  }
}

main();


