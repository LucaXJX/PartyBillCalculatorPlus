/**
 * 餐廳爬蟲核心類
 * 
 * 功能：
 * - 根據食物類型或國家類型匹配餐廳
 * - 只爬取香港地區的餐廳
 * - 記錄餐廳坐標（經緯度）以便計算距離
 */

import { TargetSite } from "../config.js";
import type { RestaurantData, MatchCriteria } from "./types.js";

// 類型定義已移至 types.ts

/**
 * 基礎餐廳爬蟲類
 */
export abstract class BaseRestaurantScraper {
  protected config: TargetSite;
  protected userAgent: string;

  constructor(config: TargetSite, userAgent: string) {
    this.config = config;
    this.userAgent = userAgent;
  }

  /**
   * 爬取餐廳列表
   * @param criteria 匹配條件
   * @returns 餐廳資料列表
   */
  abstract scrapeRestaurants(criteria: MatchCriteria): Promise<RestaurantData[]>;

  /**
   * 驗證餐廳資料
   * @param restaurant 餐廳資料
   * @returns 是否有效
   */
  protected validateRestaurant(restaurant: RestaurantData): boolean {
    // 必須是香港
    if (restaurant.city !== "香港") {
      return false;
    }

    // 暫時允許沒有坐標的餐廳（坐標可以在後續通過地理編碼獲取）
    // 如果提供了坐標，驗證坐標範圍（香港大致範圍）
    // 香港緯度：22.15 - 22.58
    // 香港經度：113.83 - 114.51
    if (
      restaurant.latitude !== undefined &&
      restaurant.latitude !== null &&
      restaurant.latitude !== 0 &&
      restaurant.longitude !== undefined &&
      restaurant.longitude !== null &&
      restaurant.longitude !== 0
    ) {
      if (
        restaurant.latitude < 22.15 ||
        restaurant.latitude > 22.58 ||
        restaurant.longitude < 113.83 ||
        restaurant.longitude > 114.51
      ) {
        console.warn(
          `⚠️  餐廳 ${restaurant.name} 的坐標超出香港範圍: (${restaurant.latitude}, ${restaurant.longitude})，將重置為 0`
        );
        // 重置為 0，後續可以通過地理編碼修正
        restaurant.latitude = 0;
        restaurant.longitude = 0;
      }
    }

    // 必須有餐廳名稱
    if (!restaurant.name || restaurant.name.trim() === "") {
      return false;
    }

    return true;
  }

  /**
   * 匹配餐廳是否符合條件
   * @param restaurant 餐廳資料
   * @param criteria 匹配條件
   * @returns 是否匹配
   */
  protected matchesCriteria(
    restaurant: RestaurantData,
    criteria: MatchCriteria
  ): boolean {
    // 城市必須匹配
    if (restaurant.city !== criteria.city) {
      return false;
    }

    // 檢查評分
    if (
      criteria.minRating !== undefined &&
      (restaurant.rating === undefined || restaurant.rating < criteria.minRating)
    ) {
      return false;
    }

    // 檢查價格範圍
    if (
      criteria.priceRange !== undefined &&
      criteria.priceRange.length > 0 &&
      restaurant.price_range &&
      !criteria.priceRange.includes(restaurant.price_range)
    ) {
      return false;
    }

    // 檢查菜系類型
    if (criteria.cuisineTypes && criteria.cuisineTypes.length > 0) {
      if (!restaurant.cuisine_type) {
        return false;
      }
      const cuisineMatch = criteria.cuisineTypes.some((type) =>
        restaurant.cuisine_type!.toLowerCase().includes(type.toLowerCase())
      );
      if (!cuisineMatch) {
        return false;
      }
    }

    // 檢查食物類型（通過 tags 或 description）
    if (criteria.foodTypes && criteria.foodTypes.length > 0) {
      const searchText = [
        restaurant.name,
        restaurant.name_en,
        restaurant.description,
        ...(restaurant.tags || []),
      ]
        .filter((text) => text)
        .join(" ")
        .toLowerCase();

      const foodMatch = criteria.foodTypes.some((food) =>
        searchText.includes(food.toLowerCase())
      );

      if (!foodMatch) {
        return false;
      }
    }

    return true;
  }

  /**
   * 標準化菜系類型
   * 將各種菜系名稱映射到標準類型
   */
  protected normalizeCuisineType(cuisineType: string): string {
    const cuisineMap: { [key: string]: string } = {
      // 中餐
      中餐: "中餐",
      中式: "中餐",
      中國菜: "中餐",
      粵菜: "中餐",
      川菜: "中餐",
      上海菜: "中餐",
      chinese: "中餐",
      "chinese cuisine": "中餐",
      // 日料
      日料: "日料",
      日本料理: "日料",
      日式: "日料",
      japanese: "日料",
      "japanese cuisine": "日料",
      // 韓式
      韓式: "韓式",
      韓國料理: "韓式",
      korean: "韓式",
      "korean cuisine": "韓式",
      // 泰式
      泰式: "泰式",
      泰國菜: "泰式",
      thai: "泰式",
      "thai cuisine": "泰式",
      // 義式
      義式: "義式",
      義大利菜: "義式",
      italian: "義式",
      "italian cuisine": "義式",
      // 法式
      法式: "法式",
      法國菜: "法式",
      french: "法式",
      "french cuisine": "法式",
      // 美式
      美式: "美式",
      美國菜: "美式",
      american: "美式",
      "american cuisine": "美式",
      // 墨西哥
      墨西哥: "墨西哥",
      mexican: "墨西哥",
      "mexican cuisine": "墨西哥",
    };

    const normalized = cuisineMap[cuisineType.toLowerCase()];
    return normalized || cuisineType;
  }

  /**
   * 延遲函數（遵守 robots.txt）
   */
  protected async delay(ms?: number): Promise<void> {
    const delayTime = ms || this.config.actualDelay;
    await new Promise((resolve) => setTimeout(resolve, delayTime));
  }

  /**
   * 獲取地理坐標（如果餐廳資料中沒有）
   * 使用地理編碼 API 或地圖服務
   */
  protected async geocodeAddress(
    address: string,
    city: string
  ): Promise<{ latitude: number; longitude: number } | null> {
    try {
      // 使用 OpenStreetMap Nominatim API（免費）
      const { createDefaultGeocoder } = await import("../utils/geocoder.js");
      const geocoder = createDefaultGeocoder();
      const result = await geocoder.geocode(address, city);

      if (result) {
        return {
          latitude: result.latitude,
          longitude: result.longitude,
        };
      }

      return null;
    } catch (error) {
      console.error(`地理編碼失敗: ${address}`, error);
      return null;
    }
  }
}

/**
 * 餐廳匹配器
 * 用於根據食物識別結果匹配餐廳
 */
export class RestaurantMatcher {
  /**
   * 根據食物識別結果匹配餐廳
   * @param foodCountry 食物識別的國家（例如：chinese, japanese）
   * @param foodName 食物名稱（可選）
   * @returns 匹配條件
   */
  static createCriteriaFromFoodRecognition(
    foodCountry?: string,
    foodName?: string
  ): MatchCriteria {
    const criteria: MatchCriteria = {
      city: "香港", // 固定為香港
    };

    // 根據國家映射到菜系類型
    if (foodCountry) {
      const countryToCuisine: { [key: string]: string } = {
        chinese: "中餐",
        japanese: "日料",
        korean: "韓式",
        thai: "泰式",
        indian: "印度菜",
        italian: "義式",
        french: "法式",
        mexican: "墨西哥",
        american: "美式",
      };

      const cuisineType = countryToCuisine[foodCountry.toLowerCase()];
      if (cuisineType) {
        criteria.cuisineTypes = [cuisineType];
      }
    }

    // 如果有食物名稱，添加到食物類型
    if (foodName) {
      criteria.foodTypes = [foodName];
    }

    return criteria;
  }

  /**
   * 根據用戶偏好匹配餐廳
   * @param preferredCuisines 用戶偏好的菜系列表
   * @param preferredFoods 用戶偏好的食物列表（可選）
   * @returns 匹配條件
   */
  static createCriteriaFromPreferences(
    preferredCuisines: string[],
    preferredFoods?: string[]
  ): MatchCriteria {
    return {
      city: "香港",
      cuisineTypes: preferredCuisines,
      foodTypes: preferredFoods,
    };
  }
}

