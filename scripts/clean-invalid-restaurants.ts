/**
 * 清理數據庫中的無效餐廳數據
 * 
 * 功能：
 * - 刪除地址為空的餐廳
 * - 刪除圖片為404圖片的餐廳
 * - 刪除重複的餐廳（相同名稱和地址）
 * - 標記名稱重複過多的餐廳為不活躍
 */

import { db } from "../server/db.js";
import { proxy } from "../server/proxy.js";

async function cleanInvalidRestaurants() {
  try {
    console.log("🧹 開始清理無效餐廳數據...\n");

    if (!proxy.restaurant || !Array.isArray(proxy.restaurant)) {
      console.warn("⚠️  數據庫中沒有餐廳數據");
      return;
    }

    const restaurants = proxy.restaurant.filter((r: any) => r != null);
    console.log(`📊 當前數據庫中有 ${restaurants.length} 個餐廳\n`);

    let deletedCount = 0;
    let deactivatedCount = 0;
    const deletedReasons: { [key: string]: number } = {};

    // 1. 刪除地址為空的餐廳
    const restaurantsWithoutAddress = restaurants.filter(
      (r: any) => !r.address || r.address.trim() === ""
    );
    for (const restaurant of restaurantsWithoutAddress) {
      try {
        db.prepare("DELETE FROM restaurant WHERE id = ?").run(restaurant.id);
        deletedCount++;
        deletedReasons["地址為空"] = (deletedReasons["地址為空"] || 0) + 1;
        console.log(`  🗑️  刪除: ${restaurant.name} (地址為空)`);
      } catch (error) {
        console.error(`  ❌ 刪除失敗: ${restaurant.name}`, error);
      }
    }

    // 2. 刪除圖片為404圖片的餐廳
    const restaurantsWith404Image = restaurants.filter((r: any) => {
      if (!r.image_url) return false;
      const urlLower = r.image_url.toLowerCase();
      return (
        urlLower.includes("illust-404") ||
        urlLower.includes("404.png") ||
        urlLower.includes("not-found") ||
        urlLower.includes("placeholder") ||
        urlLower.includes("default-image")
      );
    });

    for (const restaurant of restaurantsWith404Image) {
      try {
        // 如果地址也為空，直接刪除；否則只清除圖片
        if (!restaurant.address || restaurant.address.trim() === "") {
          db.prepare("DELETE FROM restaurant WHERE id = ?").run(restaurant.id);
          deletedCount++;
          deletedReasons["404圖片且地址為空"] = (deletedReasons["404圖片且地址為空"] || 0) + 1;
          console.log(`  🗑️  刪除: ${restaurant.name} (404圖片且地址為空)`);
        } else {
          // 只清除圖片URL
          db.prepare("UPDATE restaurant SET image_url = NULL WHERE id = ?").run(restaurant.id);
          console.log(`  🖼️  清除圖片: ${restaurant.name}`);
        }
      } catch (error) {
        console.error(`  ❌ 處理失敗: ${restaurant.name}`, error);
      }
    }

    // 3. 刪除重複的餐廳（相同名稱和地址，保留第一個）
    const nameAddressMap = new Map<string, any[]>();
    restaurants.forEach((r: any) => {
      if (r.address && r.address.trim() !== "") {
        const key = `${r.name}|${r.address}`;
        if (!nameAddressMap.has(key)) {
          nameAddressMap.set(key, []);
        }
        nameAddressMap.get(key)!.push(r);
      }
    });

    for (const [key, duplicates] of nameAddressMap.entries()) {
      if (duplicates.length > 1) {
        // 保留第一個（通常是創建時間最早的），刪除其他的
        const sorted = duplicates.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateA - dateB;
        });
        const toKeep = sorted[0];
        const toDelete = sorted.slice(1);

        for (const restaurant of toDelete) {
          try {
            db.prepare("DELETE FROM restaurant WHERE id = ?").run(restaurant.id);
            deletedCount++;
            deletedReasons["重複餐廳"] = (deletedReasons["重複餐廳"] || 0) + 1;
            console.log(`  🗑️  刪除重複: ${restaurant.name} (${restaurant.address})`);
          } catch (error) {
            console.error(`  ❌ 刪除失敗: ${restaurant.name}`, error);
          }
        }
      }
    }

    // 4. 標記名稱重複過多的餐廳為不活躍（保留前3個）
    const nameMap = new Map<string, any[]>();
    restaurants.forEach((r: any) => {
      if (r.name && r.is_active === 1) {
        if (!nameMap.has(r.name)) {
          nameMap.set(r.name, []);
        }
        nameMap.get(r.name)!.push(r);
      }
    });

    for (const [name, sameNameRestaurants] of nameMap.entries()) {
      if (sameNameRestaurants.length > 3) {
        // 按創建時間排序，保留前3個，其他的標記為不活躍
        const sorted = sameNameRestaurants.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateA - dateB;
        });
        const toKeep = sorted.slice(0, 3);
        const toDeactivate = sorted.slice(3);

        for (const restaurant of toDeactivate) {
          try {
            db.prepare("UPDATE restaurant SET is_active = 0 WHERE id = ?").run(restaurant.id);
            deactivatedCount++;
            console.log(`  ⏸️  標記為不活躍: ${restaurant.name} (名稱重複過多)`);
          } catch (error) {
            console.error(`  ❌ 更新失敗: ${restaurant.name}`, error);
          }
        }
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 清理統計:");
    console.log(`  - 刪除餐廳: ${deletedCount} 個`);
    console.log(`  - 標記為不活躍: ${deactivatedCount} 個`);
    console.log("\n刪除原因統計:");
    Object.entries(deletedReasons).forEach(([reason, count]) => {
      console.log(`  - ${reason}: ${count} 個`);
    });
    console.log("=".repeat(50));

    // 重新加載 proxy（如果需要）
    console.log("\n✅ 清理完成！");
  } catch (error: any) {
    console.error("❌ 清理失敗:", error?.message || String(error));
    if (error?.stack) {
      console.error("錯誤堆棧:", error.stack);
    }
    process.exit(1);
  }
}

// 運行清理
cleanInvalidRestaurants().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("❌ 清理過程出錯:", error);
  process.exit(1);
});


