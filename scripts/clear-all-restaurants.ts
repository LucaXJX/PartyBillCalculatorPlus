/**
 * 清理數據庫中的所有餐廳數據
 * 
 * 功能：
 * - 刪除所有用戶餐廳偏好記錄（user_restaurant_preference）
 * - 刪除所有餐廳記錄（restaurant）
 * 
 * 注意：此操作不可逆，請謹慎使用！
 */

import { db } from "../server/db.js";
import { proxy } from "../server/proxy.js";

async function clearAllRestaurants() {
  try {
    console.log("🧹 開始清理所有餐廳數據...\n");

    // 1. 檢查當前數據
    const restaurantCount = proxy.restaurant 
      ? proxy.restaurant.filter((r: any) => r != null).length 
      : 0;
    
    // 檢查用戶偏好記錄
    const preferenceCount = proxy.user_restaurant_preference
      ? proxy.user_restaurant_preference.filter((p: any) => p != null).length
      : 0;

    console.log(`📊 當前數據統計:`);
    console.log(`  - 餐廳數量: ${restaurantCount} 個`);
    console.log(`  - 用戶偏好記錄: ${preferenceCount} 個\n`);

    if (restaurantCount === 0 && preferenceCount === 0) {
      console.log("ℹ️  數據庫中沒有餐廳數據，無需清理");
      return;
    }

    // 2. 刪除所有用戶餐廳偏好記錄（先刪除，避免外鍵約束問題）
    console.log("🗑️  正在刪除用戶餐廳偏好記錄...");
    let deletedPreferences = 0;
    try {
      const result = db.prepare("DELETE FROM user_restaurant_preference").run();
      deletedPreferences = result.changes || 0;
      console.log(`  ✅ 已刪除 ${deletedPreferences} 條用戶偏好記錄`);
    } catch (error: any) {
      console.error(`  ❌ 刪除用戶偏好記錄失敗:`, error?.message || String(error));
      throw error;
    }

    // 3. 刪除所有餐廳記錄
    console.log("\n🗑️  正在刪除所有餐廳記錄...");
    let deletedRestaurants = 0;
    try {
      const result = db.prepare("DELETE FROM restaurant").run();
      deletedRestaurants = result.changes || 0;
      console.log(`  ✅ 已刪除 ${deletedRestaurants} 個餐廳`);
    } catch (error: any) {
      console.error(`  ❌ 刪除餐廳記錄失敗:`, error?.message || String(error));
      throw error;
    }

    // 4. 驗證清理結果
    console.log("\n" + "=".repeat(50));
    console.log("📊 清理統計:");
    console.log(`  - 刪除餐廳: ${deletedRestaurants} 個`);
    console.log(`  - 刪除用戶偏好記錄: ${deletedPreferences} 條`);
    console.log("=".repeat(50));

    // 5. 驗證數據庫狀態
    const remainingRestaurants = proxy.restaurant 
      ? proxy.restaurant.filter((r: any) => r != null).length 
      : 0;
    const remainingPreferences = proxy.user_restaurant_preference
      ? proxy.user_restaurant_preference.filter((p: any) => p != null).length
      : 0;

    if (remainingRestaurants === 0 && remainingPreferences === 0) {
      console.log("\n✅ 清理完成！數據庫中已無餐廳數據，可以重新運行爬蟲。");
    } else {
      console.warn(`\n⚠️  警告：仍有 ${remainingRestaurants} 個餐廳和 ${remainingPreferences} 條偏好記錄未清理`);
    }
  } catch (error: any) {
    console.error("\n❌ 清理失敗:", error?.message || String(error));
    if (error?.stack) {
      console.error("錯誤堆棧:", error.stack);
    }
    process.exit(1);
  }
}

// 運行清理
clearAllRestaurants().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("❌ 清理過程出錯:", error);
  process.exit(1);
});

