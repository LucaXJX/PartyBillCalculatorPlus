/**
 * 爬蟲配置文件
 *
 * 配置目標網站列表、爬取參數、速率限制等
 */

export interface ScraperConfig {
  /** 目標網站配置 */
  targets: TargetSite[];
  /** 全局速率限制（毫秒） */
  globalDelay: number;
  /** 是否啟用日誌 */
  enableLogging: boolean;
  /** 資料存儲路徑 */
  dataPath: string;
  /** 用戶代理 */
  userAgent: string;
}

export interface TargetSite {
  /** 網站名稱 */
  name: string;
  /** 網站 URL */
  baseUrl: string;
  /** Robots.txt URL */
  robotsUrl: string;
  /** 是否啟用 */
  enabled: boolean;
  /** 爬取延遲（毫秒，遵守 robots.txt） */
  crawlDelay: number;
  /** 實際使用的延遲（可能比 robots.txt 要求更長） */
  actualDelay: number;
  /** 最大重試次數 */
  maxRetries: number;
  /** 超時時間（毫秒） */
  timeout: number;
  /** 爬取區域（城市列表） */
  cities: string[];
  /** 是否使用官方 API（如果可用） */
  useOfficialAPI: boolean;
  /** API Key（如果使用官方 API） */
  apiKey?: string;
}

/**
 * 目標網站配置列表
 */
export const targetSites: TargetSite[] = [
  {
    name: "OpenRice",
    baseUrl: "https://www.openrice.com",
    robotsUrl: "https://www.openrice.com/robots.txt",
    enabled: true,
    crawlDelay: 2000, // robots.txt 要求 2 秒
    actualDelay: 3000, // 實際使用 3 秒（更保守）
    maxRetries: 3,
    timeout: 30000, // 30 秒
    cities: ["香港"], // 只爬取香港地區
    useOfficialAPI: false,
  },
  {
    name: "Google Maps",
    baseUrl: "https://www.google.com/maps",
    robotsUrl: "https://www.google.com/robots.txt",
    enabled: false, // 默認禁用，建議使用 API
    crawlDelay: 10000, // robots.txt 要求 10 秒
    actualDelay: 20000, // 實際使用 20 秒（更保守）
    maxRetries: 2,
    timeout: 60000, // 60 秒
    cities: ["香港"], // 只爬取香港地區
    useOfficialAPI: true, // 強烈建議使用 Google Places API
    apiKey: process.env.GOOGLE_PLACES_API_KEY, // 從環境變數讀取
  },
  {
    name: "Yelp",
    baseUrl: "https://www.yelp.com",
    robotsUrl: "https://www.yelp.com/robots.txt",
    enabled: false, // 已跳過：Yelp Fusion API 需要付費
    crawlDelay: 1000, // robots.txt 要求 1 秒
    actualDelay: 3000, // 實際使用 3 秒（更保守）
    maxRetries: 3,
    timeout: 30000, // 30 秒
    cities: ["香港"], // 只爬取香港地區
    useOfficialAPI: false, // 已跳過：需要付費
    apiKey: undefined, // 不需要 API Key
  },
];

/**
 * 全局爬蟲配置
 */
export const scraperConfig: ScraperConfig = {
  targets: targetSites.filter((site) => site.enabled),
  globalDelay: 1000, // 全局額外延遲 1 秒
  enableLogging: true,
  dataPath: "./scraper/data/raw",
  userAgent:
    "PartyBillCalculator-Bot/1.0 (Educational Purpose; +https://github.com/your-repo)",
};

/**
 * 獲取目標網站配置
 */
export function getTargetConfig(name: string): TargetSite | undefined {
  return targetSites.find((site) => site.name === name);
}

/**
 * 檢查是否應該使用官方 API
 */
export function shouldUseAPI(name: string): boolean {
  const config = getTargetConfig(name);
  return config?.useOfficialAPI ?? false;
}
