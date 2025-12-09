/**
 * 根據食物識別結果爬取餐廳示例
 * 
 * 使用場景：
 * - 用戶上傳食物圖片
 * - 系統識別出食物類型（例如：中餐、小籠包）
 * - 根據識別結果爬取匹配的香港餐廳
 */

import { OpenRiceScraper } from "../scrapers/openrice-scraper.js";
import { RestaurantMatcher } from "../scrapers/restaurant-scraper.js";
import { getTargetConfig, scraperConfig } from "../config.js";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join, resolve } from "path";

// 獲取當前文件的目錄路徑
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "../../");

// 延遲加載 proxy，確保數據庫已初始化
let proxy: any;
async function loadProxy() {
  try {
    if (!proxy) {
      console.log("📦 正在加載數據庫模塊...");
      
      // 使用 file:// URL 格式（Windows 需要）
      const dbPath = pathToFileURL(join(projectRoot, "server/db.js")).href;
      const proxyPath = pathToFileURL(join(projectRoot, "server/proxy.js")).href;
      
      // 先初始化數據庫
      await import(dbPath);
      console.log("✅ 數據庫模塊已加載");
      
      // 然後加載 proxy
      const proxyModule = await import(proxyPath);
      if (!proxyModule || !proxyModule.proxy) {
        throw new Error("無法加載 proxy 模塊");
      }
      proxy = proxyModule.proxy;
      console.log("✅ Proxy 模塊已加載");
      
      // 確保 restaurant 數組存在
      if (!proxy.restaurant) {
        console.warn("⚠️  proxy.restaurant 不存在，將跳過保存步驟");
      }
    }
    return proxy;
  } catch (error) {
    console.error("❌ 加載數據庫模塊失敗:", error);
    if (error instanceof Error) {
      console.error("錯誤詳情:", error.message);
      console.error("錯誤堆棧:", error.stack);
    }
    throw error;
  }
}

/**
 * 根據食物識別結果爬取餐廳
 * 
 * @param foodCountry 食物識別的國家（例如：chinese, japanese）
 * @param foodName 食物名稱（可選，例如：小籠包、壽司）
 * @returns 匹配的餐廳列表
 */
export async function scrapeRestaurantsByFoodRecognition(
  foodCountry?: string,
  foodName?: string
): Promise<void> {
  console.log("🚀 開始根據食物識別結果爬取餐廳...");
  console.log(`   國家: ${foodCountry || "未指定"}`);
  console.log(`   食物: ${foodName || "未指定"}`);

  // 1. 根據食物識別結果創建匹配條件
  const criteria = RestaurantMatcher.createCriteriaFromFoodRecognition(
    foodCountry,
    foodName
  );

  console.log("📋 匹配條件:", JSON.stringify(criteria, null, 2));

  // 2. 創建爬蟲實例
  const openRiceConfig = getTargetConfig("OpenRice");
  if (!openRiceConfig) {
    throw new Error("OpenRice 配置不存在");
  }

  const scraper = new OpenRiceScraper(
    openRiceConfig,
    scraperConfig.userAgent
  );

  try {
    // 3. 初始化爬蟲
    await scraper.initialize();
    console.log("✅ 爬蟲初始化完成");

    // 4. 爬取餐廳
    const restaurants = await scraper.scrapeRestaurants(criteria);
    console.log(`✅ 找到 ${restaurants.length} 個匹配的餐廳`);

    // 5. 保存到數據庫
    const dbProxy = await loadProxy();
    let savedCount = 0;
    
    if (!dbProxy || !dbProxy.restaurant) {
      console.warn("⚠️  數據庫未初始化，跳過保存步驟");
      console.log(`📊 爬取結果（未保存）: ${restaurants.length} 個餐廳`);
      restaurants.forEach((r) => {
        console.log(`   - ${r.name} (${r.cuisine_type || "未知菜系"})`);
      });
      return;
    }

    for (const restaurant of restaurants) {
      try {
        // 生成 ID
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

        // 轉換為數據庫格式
        const dbRestaurant = {
          id,
          name: restaurant.name,
          name_en: restaurant.name_en || null,
          description: restaurant.description || null,
          cuisine_type: restaurant.cuisine_type || null,
          price_range: restaurant.price_range || null,
          rating: restaurant.rating || null,
          review_count: restaurant.review_count || 0,
          address: restaurant.address || null,
          city: restaurant.city, // 必須是 "香港"
          latitude: restaurant.latitude, // 必須有
          longitude: restaurant.longitude, // 必須有
          phone: restaurant.phone || null,
          website: restaurant.website || null,
          image_url: restaurant.image_url || null,
          tags: restaurant.tags ? JSON.stringify(restaurant.tags) : null,
          is_active: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // 檢查是否已存在（根據名稱和地址）
        const existing = dbProxy.restaurant.find(
          (r: any) =>
            r &&
            r.name === restaurant.name &&
            r.address === restaurant.address
        );

        if (!existing) {
          dbProxy.restaurant.push(dbRestaurant);
          savedCount++;
          console.log(`   ✅ 保存餐廳: ${restaurant.name}`);
        } else {
          console.log(`   ⏭️  跳過重複餐廳: ${restaurant.name}`);
        }
      } catch (error) {
        console.error(`   ❌ 保存餐廳失敗: ${restaurant.name}`, error);
      }
    }

    console.log(`\n🎉 完成！共保存 ${savedCount} 個新餐廳`);
  } catch (error) {
    console.error("❌ 爬取失敗:", error);
    throw error;
  } finally {
    // 6. 關閉爬蟲
    await scraper.close();
    console.log("✅ 爬蟲已關閉");
  }
}

/**
 * 主函數（用於測試）
 */
async function main() {
  try {
    console.log("🚀 開始執行爬蟲示例...");
    
    // 示例：根據識別出的中餐和小籠包爬取餐廳
    await scrapeRestaurantsByFoodRecognition("chinese", "小籠包");
    
    console.log("✅ 執行完成");
  } catch (error) {
    console.error("❌ 執行失敗:", error);
    if (error instanceof Error) {
      console.error("錯誤詳情:", error.message);
      console.error("錯誤堆棧:", error.stack);
    }
    process.exit(1);
  }
}

// 如果直接運行此文件
// 使用更可靠的方式檢測是否直接運行
const isMainModule = 
  import.meta.url.endsWith('scrape-by-food-recognition.ts') ||
  import.meta.url.endsWith('scrape-by-food-recognition.js') ||
  process.argv[1]?.endsWith('scrape-by-food-recognition.ts') ||
  process.argv[1]?.endsWith('scrape-by-food-recognition.js');

if (isMainModule || process.argv[1]?.includes('scrape-by-food-recognition')) {
  main().catch((error) => {
    console.error("❌ 未捕獲的錯誤:", error);
    process.exit(1);
  });
}

