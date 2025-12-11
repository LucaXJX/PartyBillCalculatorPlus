/**
 * 餐廳推薦演算法
 * 
 * 使用規則加權排序，考慮以下因素：
 * 1. 用戶歷史偏好（like/dislike/favorite）
 * 2. 餐廳評分
 * 3. 距離（如果提供了用戶位置）
 * 4. 價格匹配度
 * 5. 菜系類型匹配度
 */

import { proxy } from "./proxy.js";

export interface RecommendationConfig {
  // 權重配置（總和應為 1.0）
  weights: {
    preference: number; // 用戶偏好權重（0-1）
    rating: number; // 評分權重（0-1）
    distance: number; // 距離權重（0-1）
    price: number; // 價格匹配權重（0-1）
    cuisine: number; // 菜系匹配權重（0-1）
  };
  
  // 距離計算參數
  distanceParams: {
    maxDistance: number; // 最大考慮距離（公里），超過此距離的餐廳會被降權
    decayFactor: number; // 距離衰減因子（0-1），越小衰減越快
  };
  
  // 評分參數
  ratingParams: {
    minRating: number; // 最小評分（低於此評分的餐廳會被降權）
    normalizeMax: number; // 評分標準化最大值（通常是 5.0）
  };
}

// 默認配置
const DEFAULT_CONFIG: RecommendationConfig = {
  weights: {
    preference: 0.3, // 30% - 用戶偏好最重要
    rating: 0.25, // 25% - 評分次重要
    distance: 0.2, // 20% - 距離
    price: 0.15, // 15% - 價格匹配
    cuisine: 0.1, // 10% - 菜系匹配
  },
  distanceParams: {
    maxDistance: 10, // 10 公里
    decayFactor: 0.8, // 距離每增加 1 公里，分數乘以 0.8
  },
  ratingParams: {
    minRating: 3.0,
    normalizeMax: 5.0,
  },
};

/**
 * 計算兩點之間的距離（使用 Haversine 公式）
 * @param lat1 緯度 1
 * @param lon1 經度 1
 * @param lat2 緯度 2
 * @param lon2 經度 2
 * @returns 距離（公里）
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === 0 && lon1 === 0) return Infinity; // 無效坐標
  if (lat2 === 0 && lon2 === 0) return Infinity; // 無效坐標

  const R = 6371; // 地球半徑（公里）
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * 計算距離分數（0-1，距離越近分數越高）
 */
function calculateDistanceScore(
  distance: number,
  config: RecommendationConfig
): number {
  if (distance === Infinity || distance > config.distanceParams.maxDistance) {
    return 0; // 超出最大距離，分數為 0
  }

  // 使用指數衰減：分數 = decayFactor ^ distance
  const score = Math.pow(
    config.distanceParams.decayFactor,
    distance
  );

  return Math.max(0, Math.min(1, score)); // 確保在 0-1 範圍內
}

/**
 * 計算評分分數（0-1，評分越高分數越高）
 */
function calculateRatingScore(
  rating: number | null | undefined,
  config: RecommendationConfig
): number {
  if (!rating || rating < config.ratingParams.minRating) {
    return 0; // 低於最小評分，分數為 0
  }

  // 標準化到 0-1 範圍
  const normalized = rating / config.ratingParams.normalizeMax;
  return Math.max(0, Math.min(1, normalized));
}

/**
 * 計算用戶偏好分數（0-1）
 * @param userId 用戶 ID
 * @param restaurantId 餐廳 ID
 */
function calculatePreferenceScore(
  userId: string,
  restaurantId: string
): number {
  if (
    !proxy.user_restaurant_preference ||
    !Array.isArray(proxy.user_restaurant_preference)
  ) {
    return 0.5; // 無偏好記錄，返回中性分數
  }

  const validPreferences = proxy.user_restaurant_preference.filter(
    (p: any) => p != null
  );

  const preference = validPreferences.find(
    (p: any) =>
      p.user_id === userId && p.restaurant_id === restaurantId
  );

  if (!preference) {
    return 0.5; // 無偏好記錄，返回中性分數
  }

  // 根據偏好類型返回分數
  switch (preference.preference) {
    case "favorite":
      return 1.0; // 收藏：滿分
    case "like":
      return 0.8; // 喜歡：高分
    case "dislike":
      return 0.0; // 不喜歡：0 分
    default:
      return 0.5; // 中性
  }
}

/**
 * 計算價格匹配分數（0-1）
 * @param restaurantPriceRange 餐廳價格範圍（如 "$", "$$", "$$$"）
 * @param userPreferredPriceRange 用戶偏好價格範圍（可選）
 */
function calculatePriceScore(
  restaurantPriceRange: string | null | undefined,
  userPreferredPriceRange?: string | string[]
): number {
  if (!restaurantPriceRange) {
    return 0.5; // 無價格信息，返回中性分數
  }

  if (!userPreferredPriceRange) {
    return 0.5; // 無用戶偏好，返回中性分數
  }

  const preferredRanges = Array.isArray(userPreferredPriceRange)
    ? userPreferredPriceRange
    : [userPreferredPriceRange];

  // 如果餐廳價格在用戶偏好範圍內，返回高分
  if (preferredRanges.includes(restaurantPriceRange)) {
    return 1.0;
  }

  // 否則返回較低分數（可以根據價格差異調整）
  return 0.3;
}

/**
 * 計算菜系匹配分數（0-1）
 * @param restaurantCuisineType 餐廳菜系類型
 * @param userPreferredCuisineTypes 用戶偏好菜系類型（可選）
 */
function calculateCuisineScore(
  restaurantCuisineType: string | null | undefined,
  userPreferredCuisineTypes?: string | string[]
): number {
  if (!restaurantCuisineType) {
    return 0.5; // 無菜系信息，返回中性分數
  }

  if (!userPreferredCuisineTypes) {
    return 0.5; // 無用戶偏好，返回中性分數
  }

  const preferredTypes = Array.isArray(userPreferredCuisineTypes)
    ? userPreferredCuisineTypes
    : [userPreferredCuisineTypes];

  // 檢查餐廳菜系是否在用戶偏好中
  const normalizedRestaurantCuisine = restaurantCuisineType.toLowerCase();
  const match = preferredTypes.some((type) =>
    normalizedRestaurantCuisine.includes(type.toLowerCase()) ||
    type.toLowerCase().includes(normalizedRestaurantCuisine)
  );

  if (match) {
    return 1.0; // 匹配：滿分
  }

  return 0.3; // 不匹配：較低分數
}

/**
 * 計算餐廳推薦分數
 */
export interface RestaurantScore {
  restaurant: any;
  score: number;
  breakdown: {
    preference: number;
    rating: number;
    distance: number;
    price: number;
    cuisine: number;
  };
}

export function calculateRestaurantScore(
  restaurant: any,
  userId: string,
  userLatitude?: number,
  userLongitude?: number,
  userPreferences?: {
    priceRange?: string | string[];
    cuisineTypes?: string | string[];
  },
  config: RecommendationConfig = DEFAULT_CONFIG
): RestaurantScore {
  // 計算各項分數
  const preferenceScore = calculatePreferenceScore(userId, restaurant.id);
  const ratingScore = calculateRatingScore(restaurant.rating, config);
  
  // 距離分數
  let distanceScore = 0.5; // 默認中性分數
  if (
    userLatitude &&
    userLongitude &&
    restaurant.latitude &&
    restaurant.longitude &&
    restaurant.latitude !== 0 &&
    restaurant.longitude !== 0
  ) {
    const distance = calculateDistance(
      userLatitude,
      userLongitude,
      restaurant.latitude,
      restaurant.longitude
    );
    distanceScore = calculateDistanceScore(distance, config);
  }

  // 價格分數
  const priceScore = calculatePriceScore(
    restaurant.price_range,
    userPreferences?.priceRange
  );

  // 菜系分數
  const cuisineScore = calculateCuisineScore(
    restaurant.cuisine_type,
    userPreferences?.cuisineTypes
  );

  // 加權總分
  const totalScore =
    preferenceScore * config.weights.preference +
    ratingScore * config.weights.rating +
    distanceScore * config.weights.distance +
    priceScore * config.weights.price +
    cuisineScore * config.weights.cuisine;

  return {
    restaurant,
    score: totalScore,
    breakdown: {
      preference: preferenceScore,
      rating: ratingScore,
      distance: distanceScore,
      price: priceScore,
      cuisine: cuisineScore,
    },
  };
}

/**
 * 推薦餐廳
 * @param userId 用戶 ID
 * @param options 推薦選項
 */
export interface RecommendationOptions {
  limit?: number; // 返回數量（默認 10）
  userLatitude?: number; // 用戶緯度
  userLongitude?: number; // 用戶經度
  userPreferences?: {
    priceRange?: string | string[];
    cuisineTypes?: string | string[];
  };
  excludeRestaurantIds?: string[]; // 排除的餐廳 ID
  minScore?: number; // 最小推薦分數（0-1）
  config?: RecommendationConfig; // 自定義配置
}

export function recommendRestaurants(
  userId: string,
  options: RecommendationOptions = {}
): RestaurantScore[] {
  const {
    limit = 10,
    userLatitude,
    userLongitude,
    userPreferences,
    excludeRestaurantIds = [],
    minScore = 0.0,
    config = DEFAULT_CONFIG,
  } = options;

  // 獲取所有有效餐廳
  if (!proxy.restaurant || !Array.isArray(proxy.restaurant)) {
    return [];
  }

  const validRestaurants = proxy.restaurant.filter(
    (r: any) =>
      r != null &&
      r.is_active === 1 &&
      r.city === "香港" &&
      !excludeRestaurantIds.includes(r.id)
  );

  // 計算每個餐廳的分數
  const scoredRestaurants = validRestaurants.map((restaurant: any) =>
    calculateRestaurantScore(
      restaurant,
      userId,
      userLatitude,
      userLongitude,
      userPreferences,
      config
    )
  );

  // 過濾低分餐廳
  const filteredRestaurants = scoredRestaurants.filter(
    (item) => item.score >= minScore
  );

  // 按分數降序排序
  filteredRestaurants.sort((a, b) => b.score - a.score);

  // 返回前 N 個
  return filteredRestaurants.slice(0, limit);
}

/**
 * 從用戶歷史偏好中提取偏好信息
 */
export function extractUserPreferences(userId: string): {
  preferredCuisineTypes: string[];
  preferredPriceRanges: string[];
} {
  const preferredCuisineTypes: string[] = [];
  const preferredPriceRanges: string[] = [];

  if (
    !proxy.user_restaurant_preference ||
    !Array.isArray(proxy.user_restaurant_preference)
  ) {
    return { preferredCuisineTypes, preferredPriceRanges };
  }

  const validPreferences = proxy.user_restaurant_preference.filter(
    (p: any) => p != null && p.user_id === userId && (p.preference === "like" || p.preference === "favorite")
  );

  // 從用戶喜歡的餐廳中提取菜系和價格偏好
  const likedRestaurantIds = validPreferences.map((p: any) => p.restaurant_id);
  
  if (!proxy.restaurant || !Array.isArray(proxy.restaurant)) {
    return { preferredCuisineTypes, preferredPriceRanges };
  }

  const validRestaurants = proxy.restaurant.filter((r: any) => r != null);
  
  for (const restaurantId of likedRestaurantIds) {
    const restaurant = validRestaurants.find((r: any) => r.id === restaurantId);
    if (restaurant) {
      if (restaurant.cuisine_type && !preferredCuisineTypes.includes(restaurant.cuisine_type)) {
        preferredCuisineTypes.push(restaurant.cuisine_type);
      }
      if (restaurant.price_range && !preferredPriceRanges.includes(restaurant.price_range)) {
        preferredPriceRanges.push(restaurant.price_range);
      }
    }
  }

  return { preferredCuisineTypes, preferredPriceRanges };
}



