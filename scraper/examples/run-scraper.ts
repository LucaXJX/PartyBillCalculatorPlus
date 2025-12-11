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

// 延遲加載 proxy，確保數據庫已初始化
let proxy: any;
async function loadProxy() {
  try {
    if (!proxy) {
      console.log("📦 正在加載數據庫模塊...");
      
      // 使用相對路徑導入（更可靠）
      // 從 scraper/examples/ 到 server/，路徑是 ../../server/
      const dbModule = await import("../../server/db.js");
      console.log("✅ 數據庫模塊已加載");
      
      // 然後加載 proxy
      const proxyModule = await import("../../server/proxy.js");
      if (!proxyModule || !proxyModule.proxy) {
        throw new Error("無法加載 proxy 模塊");
      }
      proxy = proxyModule.proxy;
      console.log("✅ Proxy 模塊已加載");
      
      // 確保 restaurant 數組存在
      if (!proxy.restaurant) {
        console.warn("⚠️  proxy.restaurant 不存在，將跳過保存步驟");
      } else {
        console.log(`📊 當前數據庫中有 ${proxy.restaurant.length} 個餐廳`);
      }
    }
    return proxy;
  } catch (error: any) {
    console.error("❌ 加載數據庫模塊失敗:", error);
    if (error instanceof Error) {
      console.error("錯誤詳情:", error.message);
      console.error("錯誤堆棧:", error.stack);
    }
    throw error;
  }
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

    // 定義要爬取的餐廳類型（可以根據需要修改）
    const searchCriteria = [
      { cuisine_type: "中餐", food_type: "小籠包", city: "香港" },
      { cuisine_type: "日料", food_type: "壽司", city: "香港" },
      { cuisine_type: "韓式", food_type: "烤肉", city: "香港" },
      { cuisine_type: "泰式", food_type: "冬陰功", city: "香港" },
      { cuisine_type: "義式", food_type: "披薩", city: "香港" },
    ];

    let totalSaved = 0;

    for (const criteria of searchCriteria) {
      console.log(`\n🔍 正在爬取: ${criteria.cuisine_type} - ${criteria.food_type}`);
      console.log("─".repeat(50));

      try {
        // 爬取餐廳
        const restaurants = await scraper.scrapeRestaurants(criteria);

        console.log(`\n📊 找到 ${restaurants.length} 個餐廳`);

        // 保存到數據庫
        if (dbProxy.restaurant && Array.isArray(dbProxy.restaurant)) {
          let savedCount = 0;
          for (const restaurant of restaurants) {
            try {
              // 檢查是否已存在（根據名稱和地址）
              const existing = dbProxy.restaurant.find(
                (r: any) =>
                  r &&
                  r.name === restaurant.name &&
                  r.address === restaurant.address
              );

              if (!existing) {
                // 生成 ID
                const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                
                dbProxy.restaurant.push({
                  id,
                  name: restaurant.name,
                  name_en: restaurant.name_en || null,
                  description: restaurant.description || null,
                  cuisine_type: restaurant.cuisine_type || null,
                  price_range: restaurant.price_range || null,
                  rating: restaurant.rating || null,
                  review_count: restaurant.review_count || 0,
                  address: restaurant.address || null,
                  city: restaurant.city || "香港",
                  latitude: restaurant.latitude || null,
                  longitude: restaurant.longitude || null,
                  phone: restaurant.phone || null,
                  website: restaurant.website || null,
                  image_url: restaurant.image_url || null,
                  tags: restaurant.tags
                    ? JSON.stringify(restaurant.tags)
                    : null,
                  is_active: 1,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                savedCount++;
                console.log(`  ✅ 已保存: ${restaurant.name}`);
              } else {
                console.log(`  ⏭️  已存在: ${restaurant.name}`);
              }
            } catch (error: any) {
              console.error(`  ❌ 保存失敗: ${restaurant.name}`, error?.message || String(error));
            }
          }
          totalSaved += savedCount;
          console.log(`\n💾 本次保存了 ${savedCount} 個新餐廳`);
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
