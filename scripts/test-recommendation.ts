/**
 * 餐廳推薦功能測試腳本
 * 
 * 使用方法：
 * 1. 確保服務器運行：npm run dev
 * 2. 運行此腳本：node --loader ts-node/esm scripts/test-recommendation.ts
 * 
 * 注意：需要先登錄獲取 sessionId，然後設置環境變量 SESSION_ID
 */

import { proxy } from "../server/proxy.js";
import { db } from "../server/db.js";
import {
  recommendRestaurants,
  extractUserPreferences,
  calculateDistance,
  type RecommendationOptions,
} from "../server/restaurantRecommender.js";

/**
 * 測試基本推薦功能
 */
async function testBasicRecommendation() {
  console.log("\n=== 測試 1: 基本推薦（無位置信息）===");

  // 獲取第一個用戶（假設有用戶）
  const users = proxy.user.filter((u: any) => u != null);
  if (users.length === 0) {
    console.log("❌ 沒有用戶數據，請先註冊用戶");
    return;
  }

  const userId = users[0].id;
  console.log(`使用用戶: ${users[0].username} (${userId})`);

  // 檢查餐廳數據
  const restaurants = proxy.restaurant.filter((r: any) => r != null && r.is_active === 1);
  console.log(`可用餐廳數量: ${restaurants.length}`);

  if (restaurants.length === 0) {
    console.log("❌ 沒有餐廳數據，請先運行爬蟲或 seed 數據");
    return;
  }

  // 獲取推薦
  const recommendations = recommendRestaurants(userId, {
    limit: 5,
  });

  console.log(`\n推薦結果 (${recommendations.length} 個):`);
  recommendations.forEach((rec, index) => {
    console.log(`\n${index + 1}. ${rec.restaurant.name}`);
    console.log(`   總分: ${rec.score.toFixed(3)}`);
    console.log(`   分解:`);
    console.log(`     - 偏好: ${rec.breakdown.preference.toFixed(3)}`);
    console.log(`     - 評分: ${rec.breakdown.rating.toFixed(3)} (${rec.restaurant.rating || "N/A"})`);
    console.log(`     - 距離: ${rec.breakdown.distance.toFixed(3)}`);
    console.log(`     - 價格: ${rec.breakdown.price.toFixed(3)} (${rec.restaurant.price_range || "N/A"})`);
    console.log(`     - 菜系: ${rec.breakdown.cuisine.toFixed(3)} (${rec.restaurant.cuisine_type || "N/A"})`);
  });
}

/**
 * 測試帶位置信息的推薦
 */
async function testLocationBasedRecommendation() {
  console.log("\n=== 測試 2: 帶位置信息的推薦 ===");

  const users = proxy.user.filter((u: any) => u != null);
  if (users.length === 0) {
    console.log("❌ 沒有用戶數據");
    return;
  }

  const userId = users[0].id;
  
  // 使用香港中環的坐標
  const userLat = 22.3193;
  const userLon = 114.1694;
  console.log(`用戶位置: (${userLat}, ${userLon}) - 香港中環`);

  const recommendations = recommendRestaurants(userId, {
    limit: 5,
    userLatitude: userLat,
    userLongitude: userLon,
  });

  console.log(`\n推薦結果 (${recommendations.length} 個):`);
  recommendations.forEach((rec, index) => {
    const restaurant = rec.restaurant;
    let distanceInfo = "無坐標";
    if (restaurant.latitude && restaurant.longitude && restaurant.latitude !== 0 && restaurant.longitude !== 0) {
      const distance = calculateDistance(userLat, userLon, restaurant.latitude, restaurant.longitude);
      distanceInfo = `${distance.toFixed(2)} 公里`;
    }
    
    console.log(`\n${index + 1}. ${restaurant.name}`);
    console.log(`   總分: ${rec.score.toFixed(3)}`);
    console.log(`   距離: ${distanceInfo} (分數: ${rec.breakdown.distance.toFixed(3)})`);
    console.log(`   地址: ${restaurant.address || "N/A"}`);
  });
}

/**
 * 測試指定偏好的推薦
 */
async function testPreferenceBasedRecommendation() {
  console.log("\n=== 測試 3: 指定偏好的推薦 ===");

  const users = proxy.user.filter((u: any) => u != null);
  if (users.length === 0) {
    console.log("❌ 沒有用戶數據");
    return;
  }

  const userId = users[0].id;

  const recommendations = recommendRestaurants(userId, {
    limit: 5,
    userPreferences: {
      priceRange: "$$",
      cuisineTypes: ["中餐"],
    },
  });

  console.log(`\n推薦結果 (價格: $$, 菜系: 中餐):`);
  recommendations.forEach((rec, index) => {
    const restaurant = rec.restaurant;
    console.log(`\n${index + 1}. ${restaurant.name}`);
    console.log(`   總分: ${rec.score.toFixed(3)}`);
    console.log(`   價格: ${restaurant.price_range || "N/A"} (匹配分數: ${rec.breakdown.price.toFixed(3)})`);
    console.log(`   菜系: ${restaurant.cuisine_type || "N/A"} (匹配分數: ${rec.breakdown.cuisine.toFixed(3)})`);
  });
}

/**
 * 測試用戶偏好提取
 */
async function testUserPreferenceExtraction() {
  console.log("\n=== 測試 4: 用戶偏好提取 ===");

  const users = proxy.user.filter((u: any) => u != null);
  if (users.length === 0) {
    console.log("❌ 沒有用戶數據");
    return;
  }

  const userId = users[0].id;
  const preferences = extractUserPreferences(userId);

  console.log(`\n用戶 ${users[0].username} 的偏好:`);
  console.log(`  菜系類型: ${preferences.preferredCuisineTypes.length > 0 ? preferences.preferredCuisineTypes.join(", ") : "無"}`);
  console.log(`  價格範圍: ${preferences.preferredPriceRanges.length > 0 ? preferences.preferredPriceRanges.join(", ") : "無"}`);

  if (preferences.preferredCuisineTypes.length === 0 && preferences.preferredPriceRanges.length === 0) {
    console.log("\n💡 提示: 用戶還沒有記錄偏好，可以通過心動模式記錄一些偏好");
  }
}

/**
 * 測試距離計算
 */
async function testDistanceCalculation() {
  console.log("\n=== 測試 5: 距離計算 ===");

  // 測試幾個香港地點之間的距離
  const locations = [
    { name: "中環", lat: 22.3193, lon: 114.1694 },
    { name: "銅鑼灣", lat: 22.2783, lon: 114.1828 },
    { name: "尖沙咀", lat: 22.2974, lon: 114.1720 },
    { name: "旺角", lat: 22.3197, lon: 114.1696 },
  ];

  console.log("\n地點之間的距離（公里）:");
  for (let i = 0; i < locations.length; i++) {
    for (let j = i + 1; j < locations.length; j++) {
      const distance = calculateDistance(
        locations[i].lat,
        locations[i].lon,
        locations[j].lat,
        locations[j].lon
      );
      console.log(`  ${locations[i].name} <-> ${locations[j].name}: ${distance.toFixed(2)} 公里`);
    }
  }
}

/**
 * 主測試函數
 */
async function main() {
  console.log("🚀 開始測試餐廳推薦功能...\n");

  try {
    await testBasicRecommendation();
    await testLocationBasedRecommendation();
    await testPreferenceBasedRecommendation();
    await testUserPreferenceExtraction();
    await testDistanceCalculation();

    console.log("\n✅ 所有測試完成！");
  } catch (error) {
    console.error("\n❌ 測試失敗:", error);
    if (error instanceof Error) {
      console.error("錯誤詳情:", error.message);
      console.error("錯誤堆棧:", error.stack);
    }
  }
}

// 如果直接運行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

