/**
 * 爬蟲相關類型定義
 */

/**
 * 餐廳資料接口
 */
export interface RestaurantData {
  name: string;
  name_en?: string;
  description?: string;
  cuisine_type?: string; // 菜系類型（中餐、日料、韓式等）
  price_range?: string; // $, $$, $$$, $$$$
  rating?: number; // 0-5
  review_count?: number;
  address?: string;
  city: string; // 必須是 "香港"
  latitude: number; // 必須有（香港範圍：22.15-22.58）
  longitude: number; // 必須有（香港範圍：113.83-114.51）
  phone?: string;
  website?: string;
  image_url?: string;
  tags?: string[]; // 標籤（可用於匹配食物類型）
  source: string; // 資料來源（openrice, google-maps, yelp）
  source_url: string; // 原始 URL
  scraped_at: string; // 爬取時間（ISO 8601）
}

/**
 * 匹配條件
 */
export interface MatchCriteria {
  /** 食物類型（例如：小籠包、壽司、拉麵） */
  foodTypes?: string[];
  /** 國家/菜系類型（例如：中餐、日料、韓式、泰式） */
  cuisineTypes?: string[];
  /** 城市（必須是 "香港"） */
  city: string;
  /** 最小評分（可選，0-5） */
  minRating?: number;
  /** 價格範圍（可選，例如：["$", "$$"]） */
  priceRange?: string[];
  /** 區域（可選，例如：["中環", "銅鑼灣"]） */
  districts?: string[];
}

/**
 * 爬取結果
 */
export interface ScrapeResult {
  /** 成功爬取的餐廳數量 */
  success: number;
  /** 失敗的數量 */
  failed: number;
  /** 跳過的數量（不符合條件） */
  skipped: number;
  /** 餐廳資料列表 */
  restaurants: RestaurantData[];
  /** 錯誤列表 */
  errors: string[];
  /** 開始時間 */
  startTime: string;
  /** 結束時間 */
  endTime: string;
  /** 總耗時（毫秒） */
  duration: number;
}

/**
 * 香港區域定義
 */
export const HONG_KONG_DISTRICTS = [
  "中環",
  "銅鑼灣",
  "尖沙咀",
  "旺角",
  "灣仔",
  "上環",
  "金鐘",
  "佐敦",
  "油麻地",
  "深水埗",
  "九龍塘",
  "觀塘",
  "黃大仙",
  "沙田",
  "大埔",
  "元朗",
  "屯門",
  "荃灣",
  "葵涌",
  "青衣",
  "東涌",
  "北角",
  "鰂魚涌",
  "太古城",
  "西灣河",
  "筲箕灣",
  "柴灣",
  "小西灣",
  "赤柱",
  "淺水灣",
  "南區",
] as const;

/**
 * 菜系類型映射（從食物識別的國家到菜系）
 */
export const COUNTRY_TO_CUISINE: { [key: string]: string } = {
  chinese: "中餐",
  japanese: "日料",
  korean: "韓式",
  thai: "泰式",
  indian: "印度菜",
  italian: "義式",
  french: "法式",
  mexican: "墨西哥",
  american: "美式",
  others: "其他",
};

/**
 * 香港地理範圍
 */
export const HONG_KONG_BOUNDS = {
  latitude: {
    min: 22.15,
    max: 22.58,
  },
  longitude: {
    min: 113.83,
    max: 114.51,
  },
} as const;






