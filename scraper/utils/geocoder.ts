/**
 * 地理編碼工具
 * 
 * 從地址獲取地理坐標（經緯度）
 * 支持多種地理編碼服務：
 * 1. OpenStreetMap Nominatim API（免費，無需 API Key）
 * 2. Google Geocoding API（需要 API Key）
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted_address?: string;
  source: string;
}

export interface GeocoderConfig {
  provider: "nominatim" | "google";
  apiKey?: string;
  delay?: number; // 請求間隔（毫秒），避免觸發速率限制
}

/**
 * 地理編碼器類
 */
export class Geocoder {
  private config: GeocoderConfig;
  private lastRequestTime: number = 0;

  constructor(config: GeocoderConfig) {
    this.config = {
      delay: 1000, // 默認 1 秒間隔
      ...config,
    };
  }

  /**
   * 地理編碼（從地址獲取坐標）
   */
  async geocode(
    address: string,
    city: string = "香港"
  ): Promise<GeocodeResult | null> {
    // 速率限制
    await this.rateLimit();

    // 構建完整地址
    // 如果地址已經包含"香港"或"Hong Kong"，就不重複添加
    let fullAddress = address.trim();
    if (!fullAddress.includes("香港") && !fullAddress.includes("Hong Kong")) {
      fullAddress = `${address}, ${city}, Hong Kong`;
    }

    try {
      if (this.config.provider === "nominatim") {
        return await this.geocodeNominatim(fullAddress);
      } else if (this.config.provider === "google") {
        return await this.geocodeGoogle(fullAddress);
      }
    } catch (error) {
      console.error(`地理編碼失敗 (${this.config.provider}):`, error);
      return null;
    }

    return null;
  }

  /**
   * 使用 OpenStreetMap Nominatim API 地理編碼
   * 免費，無需 API Key，但有限制：
   * - 每分鐘最多 1 次請求
   * - 每天最多 1000 次請求
   */
  private async geocodeNominatim(
    address: string
  ): Promise<GeocodeResult | null> {
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.append("q", address);
      url.searchParams.append("format", "json");
      url.searchParams.append("limit", "1");
      url.searchParams.append("countrycodes", "hk"); // 限制為香港
      url.searchParams.append("addressdetails", "1");
      url.searchParams.append("extratags", "1"); // 獲取額外標籤

      console.log(`   🔍 地理編碼請求: ${address.substring(0, 50)}...`);

      const response = await fetch(url.toString(), {
        headers: {
          "User-Agent": "PartyBillCalculator-Bot/1.0 (Educational Purpose)",
          "Accept-Language": "zh-TW,zh,en",
          "Referer": "https://www.openrice.com/",
        },
      });

      if (!response.ok) {
        console.error(`   ❌ Nominatim API 響應錯誤: ${response.status} ${response.statusText}`);
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        // 驗證坐標是否在香港範圍內（緯度 22-23，經度 113-115）
        if (lat >= 22 && lat <= 23 && lon >= 113 && lon <= 115) {
          console.log(`   ✅ 地理編碼成功: (${lat}, ${lon})`);
          return {
            latitude: lat,
            longitude: lon,
            formatted_address: result.display_name,
            source: "nominatim",
          };
        } else {
          console.warn(`   ⚠️  地理編碼結果超出香港範圍: (${lat}, ${lon})`);
        }
      } else {
        console.warn(`   ⚠️  未找到地址結果: ${address.substring(0, 50)}...`);
      }

      return null;
    } catch (error) {
      console.error("   ❌ Nominatim 地理編碼失敗:", error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * 使用 Google Geocoding API 地理編碼
   * 需要 API Key，有免費額度
   */
  private async geocodeGoogle(
    address: string
  ): Promise<GeocodeResult | null> {
    if (!this.config.apiKey) {
      console.warn("⚠️  Google Geocoding API Key 未設置");
      return null;
    }

    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.append("address", address);
      url.searchParams.append("key", this.config.apiKey!);
      url.searchParams.append("region", "hk"); // 限制為香港

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "OK" && data.results && data.results.length > 0) {
        const result = data.results[0];
        const location = result.geometry.location;
        return {
          latitude: location.lat,
          longitude: location.lng,
          formatted_address: result.formatted_address,
          source: "google",
        };
      }

      if (data.status === "ZERO_RESULTS") {
        console.warn(`⚠️  未找到地址: ${address}`);
        return null;
      }

      console.warn(`⚠️  Google Geocoding API 錯誤: ${data.status}`);
      return null;
    } catch (error) {
      console.error("Google 地理編碼失敗:", error);
      return null;
    }
  }

  /**
   * 速率限制
   * Nominatim 要求：每分鐘最多 1 次請求
   * 為了安全起見，設置為 65 秒間隔
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // 根據 provider 設置不同的延遲
    let delay = this.config.delay || 1000;
    if (this.config.provider === "nominatim") {
      // Nominatim 要求每分鐘最多 1 次請求，設置為 65 秒更安全
      delay = 65000;
    }

    if (timeSinceLastRequest < delay) {
      const waitTime = delay - timeSinceLastRequest;
      console.log(`   ⏳ 地理編碼速率限制：等待 ${Math.ceil(waitTime / 1000)} 秒...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * 批量地理編碼
   */
  async geocodeBatch(
    addresses: string[],
    city: string = "香港"
  ): Promise<Map<string, GeocodeResult | null>> {
    const results = new Map<string, GeocodeResult | null>();

    for (const address of addresses) {
      const result = await this.geocode(address, city);
      results.set(address, result);
    }

    return results;
  }
}

/**
 * 創建默認地理編碼器（使用 Nominatim，免費）
 * 注意：Nominatim 要求每分鐘最多 1 次請求，實際延遲在 rateLimit 中設置為 65 秒
 */
export function createDefaultGeocoder(): Geocoder {
  return new Geocoder({
    provider: "nominatim",
    delay: 65000, // 65 秒間隔（Nominatim 要求每分鐘最多 1 次，設置為 65 秒更安全）
  });
}

/**
 * 創建 Google 地理編碼器（需要 API Key）
 */
export function createGoogleGeocoder(apiKey: string): Geocoder {
  return new Geocoder({
    provider: "google",
    apiKey,
    delay: 100, // Google API 限制較寬鬆，可以設置更短的間隔
  });
}

