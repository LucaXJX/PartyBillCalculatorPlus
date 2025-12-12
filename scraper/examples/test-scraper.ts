/**
 * 簡化版爬蟲測試腳本
 * 用於調試和測試
 */

import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("📁 當前目錄:", __dirname);
console.log("📁 當前文件:", __filename);

async function test() {
  try {
    console.log("1️⃣ 測試導入 OpenRiceScraper...");
    const { OpenRiceScraper } = await import("../scrapers/openrice-scraper.js");
    console.log("✅ OpenRiceScraper 導入成功");

    console.log("2️⃣ 測試導入 RestaurantMatcher...");
    const { RestaurantMatcher } = await import("../scrapers/restaurant-scraper.js");
    console.log("✅ RestaurantMatcher 導入成功");

    console.log("3️⃣ 測試導入 config...");
    const { getTargetConfig, scraperConfig } = await import("../config.js");
    console.log("✅ Config 導入成功");

    console.log("4️⃣ 測試創建匹配條件...");
    const criteria = RestaurantMatcher.createCriteriaFromFoodRecognition("chinese", "小籠包");
    console.log("✅ 匹配條件:", JSON.stringify(criteria, null, 2));

    console.log("5️⃣ 測試獲取配置...");
    const openRiceConfig = getTargetConfig("OpenRice");
    if (!openRiceConfig) {
      throw new Error("OpenRice 配置不存在");
    }
    console.log("✅ OpenRice 配置:", openRiceConfig.name);

    console.log("6️⃣ 測試創建爬蟲實例...");
    const scraper = new OpenRiceScraper(openRiceConfig, scraperConfig.userAgent);
    console.log("✅ 爬蟲實例創建成功");

    console.log("7️⃣ 測試初始化瀏覽器...");
    await scraper.initialize();
    console.log("✅ 瀏覽器初始化成功");

    console.log("8️⃣ 測試關閉瀏覽器...");
    await scraper.close();
    console.log("✅ 瀏覽器關閉成功");

    console.log("\n🎉 所有測試通過！");
  } catch (error) {
    console.error("❌ 測試失敗:", error);
    if (error instanceof Error) {
      console.error("錯誤類型:", error.constructor.name);
      console.error("錯誤消息:", error.message);
      console.error("錯誤堆棧:", error.stack);
    } else {
      console.error("未知錯誤類型:", typeof error);
      console.error("錯誤值:", error);
    }
    process.exit(1);
  }
}

test();





