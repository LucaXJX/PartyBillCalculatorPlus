/**
 * 運行爬蟲獲取真實餐廳數據
 * 
 * 使用場景：
 * - 爬取 OpenRice 上的香港餐廳
 * - 保存到數據庫
 */

// 全局錯誤處理
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('未處理的 Promise 拒絕:', reason);
  if (reason instanceof Error) {
    console.error('錯誤消息:', reason.message);
    console.error('錯誤堆棧:', reason.stack);
  } else if (reason && typeof reason === 'object') {
    try {
      console.error('錯誤對象:', JSON.stringify(reason, Object.getOwnPropertyNames(reason), 2));
    } catch (e) {
      console.error('無法序列化錯誤對象:', reason);
    }
  }
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  console.error('未捕獲的異常:', error.message);
  console.error('錯誤堆棧:', error.stack);
  process.exit(1);
});

import { OpenRiceScraper } from "../scrapers/openrice-scraper.js";
import { getTargetConfig, scraperConfig } from "../config.js";

// 直接導入 proxy 和 db（而不是動態導入）
// 使用相對路徑：從 scraper/examples/ 到 server/，路徑是 ../../server/
import { proxy } from "../../server/proxy.js";
import { db } from "../../server/db.js";

// 簡單的包裝函數以保持兼容性
async function loadProxy() {
  console.log("📦 數據庫模塊已就緒");
  
  // 確保 restaurant 數組存在
  if (!proxy.restaurant) {
    console.warn("⚠️  proxy.restaurant 不存在，將跳過保存步驟");
  } else {
    console.log(`📊 當前數據庫中有 ${proxy.restaurant.length} 個餐廳`);
  }
  
  return proxy;
}

async function main() {
  try {
    console.log("🚀 開始運行餐廳爬蟲...\n");

    // 加載數據庫
    const dbProxy = await loadProxy();

    // 創建爬蟲實例
    const targetConfig = getTargetConfig("OpenRice");
    if (!targetConfig) {
      throw new Error("無法找到 OpenRice 配置，請檢查 scraper/config.ts");
    }
    
    const scraper = new OpenRiceScraper(
      targetConfig,
      scraperConfig.userAgent
    );

    // 初始化爬蟲
    await scraper.initialize();
    console.log("✅ 爬蟲已初始化\n");

    // 定義要爬取的餐廳類型（擴展更多搜索條件以獲取更多餐廳）
    const searchCriteria = [
      // 中餐
      { cuisine_type: "中餐", food_type: "小籠包", city: "香港" },
      { cuisine_type: "中餐", food_type: "點心", city: "香港" },
      { cuisine_type: "中餐", food_type: "粵菜", city: "香港" },
      { cuisine_type: "中餐", food_type: "川菜", city: "香港" },
      { cuisine_type: "中餐", food_type: "上海菜", city: "香港" },
      // 日料
      { cuisine_type: "日料", food_type: "壽司", city: "香港" },
      { cuisine_type: "日料", food_type: "拉麵", city: "香港" },
      { cuisine_type: "日料", food_type: "燒肉", city: "香港" },
      { cuisine_type: "日料", food_type: "居酒屋", city: "香港" },
      // 韓式
      { cuisine_type: "韓式", food_type: "烤肉", city: "香港" },
      { cuisine_type: "韓式", food_type: "炸雞", city: "香港" },
      // 泰式
      { cuisine_type: "泰式", food_type: "冬陰功", city: "香港" },
      { cuisine_type: "泰式", food_type: "泰國菜", city: "香港" },
      // 義式
      { cuisine_type: "義式", food_type: "披薩", city: "香港" },
      { cuisine_type: "義式", food_type: "義大利麵", city: "香港" },
      // 其他
      { cuisine_type: "法式", food_type: "法國菜", city: "香港" },
      { cuisine_type: "美式", food_type: "漢堡", city: "香港" },
      { cuisine_type: "港式", food_type: "茶餐廳", city: "香港" },
      { cuisine_type: "港式", food_type: "燒臘", city: "香港" },
    ];

    let totalSaved = 0;

    for (const searchItem of searchCriteria) {
      console.log(`\n🔍 正在爬取: ${searchItem.cuisine_type} - ${searchItem.food_type}`);
      console.log("─".repeat(50));

      try {
        // 轉換為 MatchCriteria 格式
        const criteria = {
          city: searchItem.city,
          cuisineTypes: searchItem.cuisine_type ? [searchItem.cuisine_type] : undefined,
          foodTypes: searchItem.food_type ? [searchItem.food_type] : undefined,
        };
        
        // 爬取餐廳
        const restaurants = await scraper.scrapeRestaurants(criteria);

        console.log(`\n📊 找到 ${restaurants.length} 個餐廳`);

        // 數據驗證和過濾函數
        function isValidRestaurant(restaurant: any, existingRestaurants: any[]): { valid: boolean; reason?: string } {
          // 1. 檢查地址是否為空
          if (!restaurant.address || restaurant.address.trim() === "") {
            return { valid: false, reason: "地址為空" };
          }

          // 2. 檢查名稱是否為空
          if (!restaurant.name || restaurant.name.trim() === "") {
            return { valid: false, reason: "名稱為空" };
          }

          // 3. 檢查圖片URL是否為404圖片
          if (restaurant.image_url) {
            const imageUrl = restaurant.image_url.toLowerCase();
            if (
              imageUrl.includes("illust-404") ||
              imageUrl.includes("404.png") ||
              imageUrl.includes("not-found") ||
              imageUrl.includes("placeholder") ||
              imageUrl.includes("default-image")
            ) {
              return { valid: false, reason: "無效圖片（404圖片）" };
            }
          }

          // 4. 檢查名稱是否重複（相同名稱且相同地址）
          const duplicateByNameAndAddress = existingRestaurants.find(
            (r: any) =>
              r &&
              r.name === restaurant.name &&
              r.address === restaurant.address &&
              r.is_active === 1
          );
          if (duplicateByNameAndAddress) {
            return { valid: false, reason: "重複餐廳（相同名稱和地址）" };
          }

          // 5. 檢查是否有太多相同名稱的餐廳（可能是重複數據）
          const sameNameCount = existingRestaurants.filter(
            (r: any) => r && r.name === restaurant.name && r.is_active === 1
          ).length;
          if (sameNameCount >= 3) {
            // 如果已經有3個或更多相同名稱的餐廳，跳過
            return { valid: false, reason: `名稱重複過多（已有${sameNameCount}個同名餐廳）` };
          }

          return { valid: true };
        }

        // 保存到數據庫
        if (dbProxy.restaurant && Array.isArray(dbProxy.restaurant)) {
          let savedCount = 0;
          let skippedCount = 0;
          const existingRestaurants = dbProxy.restaurant.filter((r: any) => r != null);

          for (const restaurant of restaurants) {
            try {
              // 驗證餐廳數據
              const validation = isValidRestaurant(restaurant, existingRestaurants);
              
              if (!validation.valid) {
                skippedCount++;
                console.log(`  ⏭️  跳過: ${restaurant.name} (${validation.reason})`);
                continue;
              }

              // 生成 ID
              const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
              
              // 清理圖片URL（如果包含404圖片，設為null）
              let imageUrl = restaurant.image_url || null;
              if (imageUrl) {
                const urlLower = imageUrl.toLowerCase();
                if (
                  urlLower.includes("illust-404") ||
                  urlLower.includes("404.png") ||
                  urlLower.includes("not-found") ||
                  urlLower.includes("placeholder") ||
                  urlLower.includes("default-image")
                ) {
                  imageUrl = null;
                }
              }
              
              dbProxy.restaurant.push({
                id,
                name: restaurant.name.trim(),
                name_en: restaurant.name_en?.trim() || null,
                description: restaurant.description?.trim() || null,
                cuisine_type: restaurant.cuisine_type || null,
                price_range: restaurant.price_range || null,
                rating: restaurant.rating || null,
                review_count: restaurant.review_count || 0,
                address: restaurant.address.trim(), // 確保地址不為空
                city: restaurant.city || "香港",
                latitude: restaurant.latitude || null,
                longitude: restaurant.longitude || null,
                phone: restaurant.phone || null,
                website: restaurant.website || null,
                image_url: imageUrl,
                tags: restaurant.tags
                  ? JSON.stringify(restaurant.tags)
                  : null,
                source_url: restaurant.source_url || null, // 保存 OpenRice URL
                is_active: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              
              savedCount++;
              console.log(`  ✅ 已保存: ${restaurant.name} (${restaurant.address})`);
            } catch (error: any) {
              console.error(`  ❌ 保存失敗: ${restaurant.name}`, error?.message || String(error));
            }
          }
          totalSaved += savedCount;
          console.log(`\n💾 本次保存了 ${savedCount} 個新餐廳，跳過了 ${skippedCount} 個無效餐廳`);
        } else {
          console.warn("⚠️  無法保存到數據庫（proxy.restaurant 不存在）");
        }

        // 延遲一下，避免請求過快
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`❌ 爬取失敗 (${criteria.cuisine_type}):`, error?.message || String(error));
        if (error?.stack) {
          console.error("錯誤堆棧:", error.stack);
        }
        continue;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`🎉 爬蟲運行完成！總共保存了 ${totalSaved} 個新餐廳`);
    console.log("=".repeat(50));

    // 關閉爬蟲
    await scraper.close();
  } catch (error: any) {
    console.error("❌ 爬蟲運行失敗:", error?.message || String(error));
    if (error?.stack) {
      console.error("錯誤堆棧:", error.stack);
    }
    process.exit(1);
  }
}

// 運行主函數（使用立即執行的異步函數）
(async () => {
  try {
    await main();
  } catch (error: any) {
    console.error("\n❌ 未處理的錯誤:");
    console.error("錯誤類型:", error?.constructor?.name || typeof error);
    console.error("錯誤消息:", error?.message || String(error));
    if (error?.stack) {
      console.error("錯誤堆棧:", error.stack);
    }
    // 嘗試獲取更多錯誤信息
    if (error && typeof error === 'object') {
      try {
        const errorKeys = Object.keys(error);
        console.error("錯誤對象的鍵:", errorKeys);
        for (const key of errorKeys) {
          try {
            console.error(`  ${key}:`, error[key]);
          } catch (e) {
            // 忽略無法序列化的屬性
          }
        }
      } catch (e) {
        // 忽略序列化錯誤
      }
    }
    process.exit(1);
  }
})();
