/**
 * OpenRice 餐廳爬蟲
 *
 * 功能：
 * - 爬取 OpenRice 上的香港餐廳
 * - 根據菜系和食物類型過濾
 * - 提取餐廳坐標
 */

import { BaseRestaurantScraper } from "./restaurant-scraper.js";
import type { MatchCriteria, RestaurantData } from "./types.js";
import type { TargetSite } from "../config.js";
import { chromium, Browser, Page } from "playwright";

export class OpenRiceScraper extends BaseRestaurantScraper {
  private browser: Browser | null = null;

  constructor(config: TargetSite, userAgent: string) {
    super(config, userAgent);
  }

  /**
   * 初始化瀏覽器
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-software-rasterizer",
          "--disable-extensions",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
          "--disable-renderer-backgrounding",
          "--disable-backgrounding-occluded-windows",
          "--disable-ipc-flooding-protection",
        ],
        // 增加超時時間
        timeout: 60000,
      });
    }
  }

  /**
   * 創建帶有 User-Agent 的頁面
   */
  private async createPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error("瀏覽器未初始化");
    }
    const context = await this.browser.newContext({
      userAgent: this.userAgent,
      // 增加視口大小，避免渲染問題
      viewport: { width: 1920, height: 1080 },
      // 忽略 HTTPS 錯誤
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    // 設置頁面超時
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    // 監聽頁面崩潰事件
    page.on("crash", () => {
      console.warn("⚠️  頁面崩潰，將嘗試重新創建頁面");
    });

    // 監聽控制台錯誤（過濾常見的無關緊要的錯誤）
    // 注意：完全禁用控制台錯誤監聽，因為這些錯誤大多是廣告和第三方腳本的問題，不影響爬取
    // 如果需要調試，可以取消註釋下面的代碼
    /*
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // 過濾常見的無關緊要的錯誤（HTTP 錯誤、廣告錯誤、資源加載錯誤等）
        const ignoredErrors = [
          "Failed to load resource",
          "422", "410", "404", "403", "401",
          "redirect",
          "ERR_TOO_MANY_REDIRECTS",
          "ERR_NAME_NOT_RESOLVED",
          "TypeError: Failed to fetch",
          "The script resource is behind a redirect",
          "schain.complete", "schain.ver", "schain.nodes",
          "AmazonTam", "No bids received", "getVastFromAmazonTam",
          "googlesyndication", "pagead", "rum.js",
          "ad", "ads", "advertisement",
        ];
        
        // 只記錄重要的錯誤（不包含被忽略的關鍵詞）
        const isImportant = !ignoredErrors.some(ignored => 
          text.toLowerCase().includes(ignored.toLowerCase())
        );
        if (isImportant) {
          console.warn("⚠️  頁面控制台錯誤:", text);
        }
        // 其他錯誤靜默忽略，避免日誌污染
      }
    });
    */

    return page;
  }

  /**
   * 關閉瀏覽器
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * 爬取餐廳列表（支持分頁）
   */
  async scrapeRestaurants(criteria: MatchCriteria): Promise<RestaurantData[]> {
    if (!this.browser) {
      await this.initialize();
    }

    const restaurants: RestaurantData[] = [];
    let page: Page = await this.createPage(); // 使用 let 以便重新賦值

    try {
      // 構建搜索 URL
      const searchUrl = this.buildSearchUrl(criteria);
      console.log(`🔍 開始爬取: ${searchUrl}`);

      let pageNumber = 1; // 重命名為 pageNumber 避免與 currentPage 變量衝突
      let hasNextPage = true;
      const maxPages = 10; // 限制最大頁數，避免無限爬取

      while (hasNextPage && pageNumber <= maxPages) {
        console.log(`📄 正在爬取第 ${pageNumber} 頁...`);

        // 構建分頁 URL
        const pageUrl = this.buildPageUrl(searchUrl, pageNumber);
        try {
          // 使用 domcontentloaded 避免超時，然後手動等待內容
          await page.goto(pageUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });

          // 等待頁面基本結構加載
          await page.waitForTimeout(3000);

          // 嘗試等待列表容器（如果存在）
          try {
            await page.waitForSelector(".poi-list-desktop-container", {
              timeout: 10000,
            });
            console.log(`   ✅ 列表容器已加載`);
          } catch (e) {
            console.log(`   ⚠️  列表容器未找到，繼續嘗試...`);
          }

          // 嘗試等待餐廳列表項目容器
          try {
            await page.waitForSelector(".poi-list-cells, .poi-list-cell", {
              timeout: 10000,
            });
            console.log(`   ✅ 餐廳列表項目容器已加載`);
          } catch (e) {
            console.log(`   ⚠️  餐廳列表項目容器未找到，繼續嘗試...`);
          }

          // 滾動頁面觸發無限滾動加載（OpenRice 使用懶加載）
          console.log(`   📜 滾動頁面觸發內容加載...`);
          for (let i = 0; i < 3; i++) {
            await page.evaluate((pos) => {
              window.scrollTo(0, pos);
            }, (i + 1) * 800);
            await page.waitForTimeout(2000);
          }

          // 額外等待讓 Vue 渲染完成
          await this.delay(3000);
        } catch (error) {
          console.error(`   ❌ 訪問頁面失敗: ${pageUrl}`, error);
          hasNextPage = false;
          break;
        }

        // 提取當前頁的餐廳列表
        const restaurantLinks = await this.extractRestaurantLinks(page);

        if (restaurantLinks.length === 0) {
          console.log("⚠️  當前頁沒有找到餐廳，停止爬取");
          hasNextPage = false;
          break;
        }

        console.log(`   ✅ 找到 ${restaurantLinks.length} 個餐廳`);

        // 爬取每個餐廳的詳情
        let successCount = 0;
        let failCount = 0;
        let consecutiveFails = 0; // 連續失敗計數
        let currentPage: Page = page; // 使用變量而不是常量，以便重新賦值

        for (const link of restaurantLinks) {
          try {
            const restaurant = await this.scrapeRestaurantDetail(
              currentPage,
              link.url,
              link.name,
              criteria
            );

            if (restaurant && this.validateRestaurant(restaurant)) {
              if (this.matchesCriteria(restaurant, criteria)) {
                restaurants.push(restaurant);
                successCount++;
                console.log(
                  `   ✅ 已爬取 (${successCount}/${restaurantLinks.length}): ${restaurant.name}`
                );
              } else {
                console.log(`   ⏭️  跳過（不符合條件）: ${restaurant.name}`);
              }
            } else {
              failCount++;
              consecutiveFails++;
              console.warn(`   ⚠️  餐廳驗證失敗或為空: ${link.name}`);
            }

            // 成功時重置連續失敗計數
            if (restaurant && this.validateRestaurant(restaurant)) {
              consecutiveFails = 0;
            }

            // 延遲，避免請求過快
            await this.delay();

            // 每 10 個餐廳後，稍作休息，避免內存積累
            if ((successCount + failCount) % 10 === 0) {
              console.log(
                `   💤 已處理 ${successCount + failCount} 個餐廳，稍作休息...`
              );
              await this.delay(5000);
            }
          } catch (error: any) {
            failCount++;
            consecutiveFails++;
            const errorMsg = error?.message || String(error);
            console.error(`   ❌ 爬取餐廳失敗: ${link.url}`);
            console.error(`   錯誤: ${errorMsg}`);

            // 如果連續失敗太多，可能需要重新創建頁面
            if (consecutiveFails >= 5) {
              console.warn(
                `   ⚠️  連續失敗 ${consecutiveFails} 次，嘗試重新創建頁面...`
              );
              try {
                if (!currentPage.isClosed()) {
                  await currentPage.close();
                }
                currentPage = await this.createPage();
                consecutiveFails = 0; // 重置計數器
                console.log(`   ✅ 頁面已重新創建，繼續爬取...`);
              } catch (e: any) {
                console.error(
                  `   ❌ 重新創建頁面失敗:`,
                  e?.message || String(e)
                );
                // 如果重新創建失敗，可能需要重新初始化瀏覽器
                if (consecutiveFails >= 10) {
                  console.error(`   ❌ 連續失敗過多，停止爬取當前頁`);
                  break;
                }
              }
            }
          }
        }

        console.log(
          `   📊 本頁統計: 成功 ${successCount} 個，失敗 ${failCount} 個`
        );

        // 如果頁面被重新創建，更新 page 變量以便後續使用
        page = currentPage;

        // 檢查是否有下一頁
        hasNextPage = await this.hasNextPage(page);
        if (hasNextPage) {
          pageNumber++;
          await this.delay(); // 頁面間延遲
        }
      }

      console.log(
        `\n✅ 爬取完成！共獲取 ${restaurants.length} 個符合條件的餐廳`
      );
    } catch (error) {
      console.error("❌ 爬取過程出錯:", error);
    } finally {
      await page.close();
    }

    return restaurants;
  }

  /**
   * 提取餐廳列表鏈接
   */
  private async extractRestaurantLinks(
    page: Page
  ): Promise<Array<{ name: string; url: string }>> {
    try {
      // 等待頁面內容加載（OpenRice 使用 Vue.js 動態渲染）
      // 等待餐廳列表容器出現
      try {
        await page.waitForSelector(".poi-list-desktop-container", {
          timeout: 10000,
        });
        console.log(`   ✅ 找到列表容器: .poi-list-desktop-container`);
      } catch (e) {
        console.log(`   ⚠️  列表容器未找到，繼續嘗試...`);
      }

      // 等待 Vue 應用加載完成（等待實際的餐廳項目出現）
      try {
        // 等待至少一個餐廳項目出現
        await page.waitForSelector(
          ".poi-list-desktop-container a[href*='/restaurant/']",
          { timeout: 15000 }
        );
        console.log(`   ✅ 餐廳項目已加載`);
      } catch (e) {
        console.log(`   ⚠️  餐廳項目未找到，繼續嘗試...`);
      }

      // 滾動頁面觸發懶加載
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await page.waitForTimeout(2000);

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(2000);

      // 調試：保存頁面 HTML（僅用於調試）
      const html = await page.content();
      console.log(`   📄 頁面 HTML 長度: ${html.length} 字符`);

      // 嘗試多種可能的選擇器（OpenRice 使用 Vue.js 動態渲染）
      // 根據 HTML 分析，OpenRice 使用新的 URL 格式：/r-餐廳名稱-... 或 /zh/hongkong/r-...
      // 餐廳列表在 .poi-list-cells 或 .poi-list-cell 內
      // 餐廳名稱鏈接在 .poi-list-cell-link 或 .poi-name 內
      const selectors = [
        ".poi-list-cell-link a[href*='/r-']", // 餐廳名稱鏈接（新格式）
        ".poi-name a[href*='/r-']", // 餐廳名稱
        ".poi-list-cell a[href*='/r-']", // 在餐廳項目內
        ".poi-list-cells a[href*='/r-']", // 在列表容器內
        ".poi-list-cell-link a[href*='/zh/hongkong/r-']", // 完整路徑
        "a[href*='/r-']:not([href*='ranking']):not([href*='article']):not([href*='report']):not([href*='map']):not([href*='opinion'])", // 新格式
        ".poi-list-cells a[href*='/restaurant/'][href*='.htm']", // 舊格式（如果還有）
        ".poi-list-cell a[href*='/restaurant/'][href*='.htm']", // 舊格式
        ".poi-list-container a[href*='/restaurant/'][href*='.htm']", // 列表容器
        ".poi-list-desktop-container .poi-list-cell a[href*='/restaurant/']", // 完整路徑
        "a[href*='/restaurant/'][href*='.htm']:not([href*='ranking']):not([href*='article']):not([href*='report']):not([href*='map']):not([href*='opinion'])",
        "[class*='poi-list'] a[href*='/restaurant/']",
        "[class*='poi'] a[href*='/restaurant/']",
      ];

      let restaurantLinks: Array<{ name: string; url: string }> = [];

      for (const selector of selectors) {
        try {
          const count = await page.$$(selector).then((els) => els.length);
          console.log(`   🔍 選擇器 "${selector}" 找到 ${count} 個元素`);

          if (count === 0) continue;

          const links = await page.$$eval(selector, (elements) => {
            return elements
              .map((el) => {
                // 查找鏈接（優先查找新格式 /r-）
                let linkEl: Element | null = null;
                let name = "";

                if (el.tagName === "A") {
                  linkEl = el as HTMLAnchorElement;
                } else {
                  // 查找鏈接（優先新格式）
                  linkEl =
                    el.querySelector("a[href*='/r-']") ||
                    el.querySelector("a[href*='/zh/hongkong/r-']") ||
                    el.querySelector("a[href*='/restaurant/']") ||
                    el.querySelector("a[href*='/zh/hongkong/restaurant/']") ||
                    el.closest("a");
                }

                if (!linkEl) return null;

                let url = linkEl.getAttribute("href") || "";
                if (!url) return null;

                // OpenRice 使用兩種 URL 格式：
                // 1. 新格式：/r-餐廳名稱-... 或 /zh/hongkong/r-...
                // 2. 舊格式：/restaurant/餐廳名稱.htm

                // 檢查是否是新格式
                const isNewFormat = url.includes("/r-");
                // 檢查是否是舊格式
                const isOldFormat = /\/restaurant\/[^\/]+\.htm$/.test(url);

                if (!isNewFormat && !isOldFormat) {
                  return null;
                }

                // 過濾掉功能頁面
                const urlLower = url.toLowerCase();
                const functionalPages = [
                  "ranking",
                  "article",
                  "report",
                  "map",
                  "opinion",
                  "contact",
                  "about",
                  "help",
                  "terms",
                  "privacy",
                  "index",
                  "restaurants-map",
                ];
                if (functionalPages.some((page) => urlLower.includes(page))) {
                  return null;
                }

                // 新格式的 URL 可能包含 /photos，需要去掉
                if (isNewFormat && urlLower.includes("/photos")) {
                  url = url.replace(/\/photos.*$/, "");
                }

                // 確保新格式的 URL 以 / 結尾（基礎 URL）
                if (isNewFormat && !url.endsWith("/") && !url.includes("?")) {
                  const urlMatch = url.match(/\/r-[^\/]+/);
                  if (urlMatch) {
                    url = urlMatch[0] + "/";
                  }
                }

                // 查找餐廳名稱（多種可能的位置）
                // 優先查找 .poi-name 或 .poi-list-cell-link（OpenRice 的實際結構）
                // 注意：.poi-name 可能包含子元素，需要獲取直接文本
                const nameSelectors = [
                  ".poi-list-cell-title .poi-name",
                  ".poi-name",
                  ".poi-list-cell-link",
                  ".sr1-listing-title",
                  ".restaurant-name",
                  "h1",
                  "h2",
                  "h3",
                  "[class*='title']",
                  "[class*='name']",
                ];

                for (const nameSel of nameSelectors) {
                  const nameEl = el.querySelector(nameSel);
                  if (nameEl) {
                    // 獲取直接文本內容（不包括子元素）
                    name = Array.from(nameEl.childNodes)
                      .filter((node) => node.nodeType === Node.TEXT_NODE)
                      .map((node) => node.textContent?.trim() || "")
                      .join(" ")
                      .trim();

                    // 如果直接文本為空，使用全部文本
                    if (!name) {
                      name = nameEl.textContent?.trim() || "";
                    }

                    // 過濾掉無效的名稱：
                    // 1. 只包含數字和符號的文本（可能是照片數量，如 "+1.7K"）
                    // 2. 太短的文本（少於 2 個字符）
                    // 3. 只包含單個字母或符號
                    if (name) {
                      const cleanName = name.trim();
                      if (
                        cleanName.length >= 2 &&
                        !/^[\d\+\s\.KkMm]+$/.test(cleanName) && // 過濾 "+1.7K" 這類
                        !/^[a-zA-Z]$/.test(cleanName) && // 過濾單個字母
                        !/^\+/.test(cleanName) // 過濾以 + 開頭的（通常是照片數量）
                      ) {
                        break; // 找到有效名稱
                      } else {
                        name = ""; // 重置，繼續查找
                      }
                    }
                  }
                }

                // 如果還是沒有名稱，嘗試從鏈接文本獲取
                // 注意：避免提取到照片數量（如 "+334"）
                if (!name && linkEl) {
                  const linkText = linkEl.textContent?.trim() || "";
                  // 過濾掉無效的文本
                  if (
                    linkText &&
                    linkText.length >= 2 &&
                    !/^[\d\+\s\.KkMm]+$/.test(linkText) &&
                    !/^[a-zA-Z]$/.test(linkText) &&
                    !/^\+/.test(linkText)
                  ) {
                    name = linkText;
                  }
                }

                // 如果還是沒有名稱，從 URL 提取
                if (!name) {
                  // 嘗試新格式：/r-餐廳名稱-...
                  // 新格式：/zh/hongkong/r-星級好德來小籠包店-佐敦-滬菜-上海-中式包點-r837041/
                  const newFormatMatch = url.match(/\/r-([^/-]+)/);
                  if (newFormatMatch) {
                    name = decodeURIComponent(newFormatMatch[1]);
                  } else {
                    // 嘗試舊格式：/restaurant/餐廳名稱.htm
                    const oldFormatMatch = url.match(/restaurant\/([^/?]+)/);
                    if (oldFormatMatch) {
                      name = decodeURIComponent(oldFormatMatch[1])
                        .replace(/\.htm$/, "")
                        .replace(/-/g, " ");
                    }
                  }
                }

                if (name && url) {
                  // 確保 URL 是完整的
                  let fullUrl = url.startsWith("http")
                    ? url
                    : `https://www.openrice.com${url}`;

                  // 如果是新格式且包含 /photos，去掉 /photos 部分
                  if (fullUrl.includes("/r-") && fullUrl.includes("/photos")) {
                    fullUrl = fullUrl.replace(/\/photos.*$/, "");
                  }

                  // 確保新格式的 URL 以 / 結尾
                  if (
                    fullUrl.includes("/r-") &&
                    !fullUrl.endsWith("/") &&
                    !fullUrl.includes("?")
                  ) {
                    fullUrl = fullUrl + "/";
                  }

                  return { name, url: fullUrl };
                }
                return null;
              })
              .filter(
                (item): item is { name: string; url: string } => item !== null
              );
          });

          if (links.length > 0) {
            restaurantLinks = links;
            console.log(
              `   ✅ 使用選擇器 "${selector}" 找到 ${links.length} 個餐廳`
            );
            break;
          }
        } catch (error) {
          // 選擇器無效，嘗試下一個
          console.log(
            `   ⚠️  選擇器 "${selector}" 執行失敗:`,
            error instanceof Error ? error.message : String(error)
          );
          continue;
        }
      }

      // 去重（根據 URL）
      const uniqueLinks = Array.from(
        new Map(restaurantLinks.map((link) => [link.url, link])).values()
      );

      if (uniqueLinks.length === 0) {
        // 調試：嘗試查找所有鏈接
        const allLinks = await page.$$eval("a[href]", (links) => {
          return links
            .map((link) => ({
              href: link.getAttribute("href") || "",
              text: link.textContent?.trim() || "",
            }))
            .filter((l) => l.href.includes("restaurant"))
            .slice(0, 10); // 只取前 10 個
        });
        console.log(
          `   🔍 調試：找到 ${allLinks.length} 個包含 'restaurant' 的鏈接`
        );
        if (allLinks.length > 0) {
          console.log(`   📋 示例鏈接:`, allLinks[0]);
        }
      }

      return uniqueLinks;
    } catch (error) {
      console.error("❌ 提取餐廳鏈接失敗:", error);
      if (error instanceof Error) {
        console.error("錯誤詳情:", error.message);
      }
      return [];
    }
  }

  /**
   * 爬取餐廳詳情（帶重試機制）
   */
  private async scrapeRestaurantDetail(
    page: Page,
    url: string,
    fallbackName: string,
    criteria: MatchCriteria
  ): Promise<RestaurantData | null> {
    const maxRetries = 3;
    let lastError: Error | null = null;
    let currentPage: Page = page; // 使用變量而不是常量，以便重新賦值

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 檢查頁面是否已關閉或崩潰
        if (currentPage.isClosed()) {
          console.warn(`   ⚠️  頁面已關閉，嘗試 ${attempt}/${maxRetries}...`);
          // 重新創建頁面
          currentPage = await this.createPage();
        }

        // 使用 domcontentloaded 避免超時，增加超時時間
        await currentPage.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 45000, // 增加到 45 秒
        });

        // 等待頁面基本內容加載
        await currentPage.waitForTimeout(2000);

        // 嘗試等待關鍵元素出現
        try {
          await currentPage.waitForSelector(
            "h1, .poi-name, [itemprop='name']",
            {
              timeout: 5000,
            }
          );
        } catch (e) {
          // 繼續，即使沒有找到
        }

        await this.delay();

        // 提取餐廳信息
        const restaurantData = await currentPage.evaluate((fallbackName) => {
          const data: any = {
            name: fallbackName,
            name_en: null,
            description: null,
            cuisine_type: null,
            price_range: null,
            rating: null,
            review_count: 0,
            address: null,
            phone: null,
            website: null,
            image_url: null,
            tags: [],
            latitude: null,
            longitude: null,
          };

          // 1. 提取餐廳名稱（多種可能的選擇器）
          const nameSelectors = [
            "h1.poi-name",
            "h1[itemprop='name']",
            ".poi-title h1",
            "h1",
            ".restaurant-name",
          ];
          for (const selector of nameSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              data.name = el.textContent?.trim() || fallbackName;
              break;
            }
          }

          // 提取英文名稱
          const nameEnEl = document.querySelector(
            ".poi-name-en, .restaurant-name-en"
          );
          if (nameEnEl) {
            data.name_en = nameEnEl.textContent?.trim() || null;
          }

          // 2. 提取地址（OpenRice 詳情頁的實際結構）
          const addressSelectors = [
            "[itemprop='address']",
            ".poi-address",
            ".restaurant-address",
            ".address",
            "[data-address]",
            ".poi-info-address",
            ".poi-detail-address",
            "[class*='address']",
          ];
          for (const selector of addressSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              const address =
                el.textContent?.trim() || el.getAttribute("data-address");
              if (address && address.length > 5) {
                // 確保地址不是太短
                data.address = address;
                break;
              }
            }
          }

          // 如果還是沒有地址，嘗試從頁面文本中查找（包含"地址"或"Address"的文本）
          if (!data.address) {
            const addressKeywords = ["地址", "Address", "位置", "Location"];
            for (const keyword of addressKeywords) {
              const elements = Array.from(document.querySelectorAll("*"));
              for (const el of elements) {
                if (el.textContent?.includes(keyword)) {
                  const nextSibling = el.nextElementSibling;
                  if (nextSibling && nextSibling.textContent) {
                    const potentialAddress = nextSibling.textContent.trim();
                    if (
                      potentialAddress.length > 5 &&
                      potentialAddress.length < 200
                    ) {
                      data.address = potentialAddress;
                      break;
                    }
                  }
                }
              }
              if (data.address) break;
            }
          }

          // 3. 提取坐標（從地圖組件或 data 屬性）
          // 方法 1: 從地圖組件的 data 屬性
          const mapSelectors = [
            "[data-latitude][data-longitude]",
            ".map-container[data-lat][data-lng]",
            "[data-map]",
          ];
          for (const selector of mapSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              const lat =
                el.getAttribute("data-latitude") || el.getAttribute("data-lat");
              const lng =
                el.getAttribute("data-longitude") ||
                el.getAttribute("data-lng");
              if (lat && lng) {
                data.latitude = parseFloat(lat);
                data.longitude = parseFloat(lng);
                break;
              }
              // 嘗試從 data-map 屬性解析（格式可能是 "lat,lng"）
              const mapData = el.getAttribute("data-map");
              if (mapData) {
                const coords = mapData.split(",");
                if (coords.length === 2) {
                  data.latitude = parseFloat(coords[0].trim());
                  data.longitude = parseFloat(coords[1].trim());
                  break;
                }
              }
            }
          }

          // 方法 2: 從 JavaScript 變量中提取（如果頁面有）
          const scripts = Array.from(document.querySelectorAll("script"));
          for (const script of scripts) {
            const content = script.textContent || "";

            // 查找類似 "latitude: 22.xxx" 或 "lat: 22.xxx" 的模式
            const latMatch = content.match(
              /["']?lat(itude)?["']?\s*[:=]\s*([\d.]+)/i
            );
            const lngMatch = content.match(
              /["']?l(ng|ongitude)["']?\s*[:=]\s*([\d.]+)/i
            );
            if (latMatch && lngMatch && !data.latitude) {
              const lat = parseFloat(latMatch[2]);
              const lng = parseFloat(lngMatch[2]);
              // 驗證是否在香港範圍內
              if (lat >= 22 && lat <= 23 && lng >= 113 && lng <= 115) {
                data.latitude = lat;
                data.longitude = lng;
                break;
              }
            }

            // 查找數組格式 [lng, lat] 或 [lat, lng]（常見於地圖庫）
            const coordArrayMatch = content.match(/\[([\d.]+),\s*([\d.]+)\]/g);
            if (coordArrayMatch && !data.latitude) {
              for (const match of coordArrayMatch) {
                const coords = match.match(/\[([\d.]+),\s*([\d.]+)\]/);
                if (coords) {
                  const val1 = parseFloat(coords[1]);
                  const val2 = parseFloat(coords[2]);
                  // 香港的緯度約 22-23，經度約 113-115
                  if (val1 >= 22 && val1 <= 23 && val2 >= 113 && val2 <= 115) {
                    data.latitude = val1;
                    data.longitude = val2;
                    break;
                  } else if (
                    val2 >= 22 &&
                    val2 <= 23 &&
                    val1 >= 113 &&
                    val1 <= 115
                  ) {
                    data.latitude = val2;
                    data.longitude = val1;
                    break;
                  }
                }
              }
              if (data.latitude && data.longitude) break;
            }

            // 查找 OpenRice 特定的坐標格式（可能在 window.__INITIAL_STATE__ 或其他全局變量中）
            const openriceCoordMatch = content.match(
              /(?:lat|latitude)[:\s]*([\d.]+).*?(?:lng|longitude)[:\s]*([\d.]+)/i
            );
            if (openriceCoordMatch && !data.latitude) {
              const lat = parseFloat(openriceCoordMatch[1]);
              const lng = parseFloat(openriceCoordMatch[2]);
              if (lat >= 22 && lat <= 23 && lng >= 113 && lng <= 115) {
                data.latitude = lat;
                data.longitude = lng;
                break;
              }
            }
          }

          // 4. 提取評分
          const ratingSelectors = [
            "[itemprop='ratingValue']",
            ".rating-value",
            ".poi-rating",
            "[data-rating]",
          ];
          for (const selector of ratingSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              const ratingText =
                el.textContent?.trim() || el.getAttribute("data-rating") || "";
              const rating = parseFloat(ratingText);
              if (!isNaN(rating) && rating > 0 && rating <= 5) {
                data.rating = rating;
                break;
              }
            }
          }

          // 5. 提取評論數量
          const reviewSelectors = [
            "[itemprop='reviewCount']",
            ".review-count",
            ".poi-review-count",
          ];
          for (const selector of reviewSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              const reviewText = el.textContent?.trim() || "";
              const reviewMatch = reviewText.match(/(\d+)/);
              if (reviewMatch) {
                data.review_count = parseInt(reviewMatch[1], 10);
                break;
              }
            }
          }

          // 6. 提取菜系類型
          const cuisineSelectors = [
            "[itemprop='servesCuisine']",
            ".cuisine-type",
            ".poi-cuisine",
            ".restaurant-cuisine",
          ];
          for (const selector of cuisineSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              data.cuisine_type = el.textContent?.trim() || null;
              if (data.cuisine_type) break;
            }
          }

          // 7. 提取價格範圍
          const priceSelectors = [
            ".price-range",
            ".poi-price",
            "[data-price-range]",
          ];
          for (const selector of priceSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              const priceText =
                el.textContent?.trim() ||
                el.getAttribute("data-price-range") ||
                "";
              // 提取 $ 符號數量或價格範圍
              const dollarCount = (priceText.match(/\$/g) || []).length;
              if (dollarCount > 0) {
                data.price_range = "$".repeat(dollarCount);
              } else if (priceText.includes("$")) {
                data.price_range = priceText;
              }
              if (data.price_range) break;
            }
          }

          // 8. 提取描述
          const descSelectors = [
            "[itemprop='description']",
            ".poi-description",
            ".restaurant-description",
          ];
          for (const selector of descSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              data.description = el.textContent?.trim() || null;
              if (data.description) break;
            }
          }

          // 9. 提取電話
          const phoneSelectors = [
            "[itemprop='telephone']",
            ".poi-phone",
            ".restaurant-phone",
            "a[href^='tel:']",
          ];
          for (const selector of phoneSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              const phone =
                el.textContent?.trim() ||
                el.getAttribute("href")?.replace("tel:", "") ||
                null;
              if (phone) {
                data.phone = phone;
                break;
              }
            }
          }

          // 10. 提取網站
          const websiteEl = document.querySelector(
            "a[itemprop='url'], .poi-website a"
          );
          if (websiteEl) {
            data.website = websiteEl.getAttribute("href") || null;
          }

          // 11. 提取圖片（改進版：嘗試多種方法）
          // 方法 1: 檢查 OpenGraph 圖片
          const ogImage = document.querySelector("meta[property='og:image']");
          if (ogImage) {
            const ogUrl = ogImage.getAttribute("content");
            if (ogUrl && ogUrl.startsWith("http")) {
              data.image_url = ogUrl;
            }
          }

          // 方法 2: 檢查 JSON-LD 結構化數據
          if (!data.image_url) {
            const jsonLdScripts = Array.from(
              document.querySelectorAll('script[type="application/ld+json"]')
            );
            for (const script of jsonLdScripts) {
              try {
                const jsonData = JSON.parse(script.textContent || "{}");
                if (jsonData.image) {
                  const imageUrl = Array.isArray(jsonData.image)
                    ? jsonData.image[0]
                    : jsonData.image;
                  if (
                    typeof imageUrl === "string" &&
                    imageUrl.startsWith("http")
                  ) {
                    data.image_url = imageUrl;
                    break;
                  }
                }
              } catch (e) {
                // 忽略 JSON 解析錯誤
              }
            }
          }

          // 方法 3: 檢查常見的圖片選擇器
          if (!data.image_url) {
            const imageSelectors = [
              "img[itemprop='image']",
              ".poi-image img",
              ".restaurant-image img",
              ".poi-photo img",
              ".photo-gallery img:first-of-type",
              ".main-photo img",
              ".hero-image img",
              "img.poi-main-image",
              "img.restaurant-main-image",
            ];
            for (const selector of imageSelectors) {
              const el = document.querySelector(selector);
              if (el) {
                const src =
                  el.getAttribute("src") ||
                  el.getAttribute("data-src") ||
                  el.getAttribute("data-lazy-src");
                if (src) {
                  // 確保是完整 URL
                  if (src.startsWith("http")) {
                    data.image_url = src;
                  } else if (src.startsWith("//")) {
                    data.image_url = `https:${src}`;
                  } else if (src.startsWith("/")) {
                    data.image_url = `https://www.openrice.com${src}`;
                  } else {
                    data.image_url = `https://www.openrice.com/${src}`;
                  }
                  break;
                }
              }
            }
          }

          // 方法 4: 檢查背景圖片（CSS background-image）
          if (!data.image_url) {
            const bgImageElements = Array.from(
              document.querySelectorAll(
                ".poi-image, .restaurant-image, .hero-image, .main-image"
              )
            );
            for (const el of bgImageElements) {
              const style = window.getComputedStyle(el);
              const bgImage = style.backgroundImage;
              if (bgImage && bgImage !== "none") {
                const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                if (urlMatch && urlMatch[1]) {
                  let url = urlMatch[1];
                  if (url.startsWith("http")) {
                    data.image_url = url;
                  } else if (url.startsWith("//")) {
                    data.image_url = `https:${url}`;
                  } else if (url.startsWith("/")) {
                    data.image_url = `https://www.openrice.com${url}`;
                  }
                  if (data.image_url) break;
                }
              }
            }
          }

          // 方法 5: 檢查所有圖片，選擇最大的（通常是主圖）
          if (!data.image_url) {
            const allImages = Array.from(document.querySelectorAll("img"));
            let largestImage: string | null = null;
            let largestSize = 0;
            for (const img of allImages) {
              const src =
                img.getAttribute("src") ||
                img.getAttribute("data-src") ||
                img.getAttribute("data-lazy-src");
              if (
                src &&
                !src.includes("icon") &&
                !src.includes("logo") &&
                !src.includes("avatar")
              ) {
                const width =
                  parseInt(img.getAttribute("width") || "0", 10) ||
                  img.naturalWidth ||
                  0;
                const height =
                  parseInt(img.getAttribute("height") || "0", 10) ||
                  img.naturalHeight ||
                  0;
                const size = width * height;
                if (size > largestSize && size > 10000) {
                  // 至少 100x100
                  largestSize = size;
                  largestImage = src;
                }
              }
            }
            if (largestImage) {
              if (largestImage.startsWith("http")) {
                data.image_url = largestImage;
              } else if (largestImage.startsWith("//")) {
                data.image_url = `https:${largestImage}`;
              } else if (largestImage.startsWith("/")) {
                data.image_url = `https://www.openrice.com${largestImage}`;
              }
            }
          }

          // 12. 提取標籤
          const tagSelectors = [
            ".poi-tags .tag",
            ".restaurant-tags .tag",
            ".tags span",
          ];
          const tagElements = Array.from(
            document.querySelectorAll(tagSelectors.join(", "))
          );
          if (tagElements.length > 0) {
            data.tags = tagElements
              .map((el) => el.textContent?.trim())
              .filter((tag) => tag && tag.length > 0);
          }

          return data;
        }, fallbackName);

        // 構建完整的餐廳資料對象
        const restaurant: RestaurantData = {
          name: restaurantData.name || fallbackName,
          name_en: restaurantData.name_en || undefined,
          description: restaurantData.description || undefined,
          cuisine_type: restaurantData.cuisine_type
            ? this.normalizeCuisineType(restaurantData.cuisine_type)
            : undefined,
          price_range: restaurantData.price_range || undefined,
          rating: restaurantData.rating || undefined,
          review_count: restaurantData.review_count || 0,
          address: restaurantData.address || undefined,
          city: "香港",
          latitude: restaurantData.latitude || 0,
          longitude: restaurantData.longitude || 0,
          phone: restaurantData.phone || undefined,
          website: restaurantData.website || undefined,
          image_url: restaurantData.image_url || undefined,
          tags:
            restaurantData.tags && restaurantData.tags.length > 0
              ? restaurantData.tags
              : undefined,
          source: "openrice",
          source_url: url,
          scraped_at: new Date().toISOString(),
        };

        // 暫時跳過地理編碼，先保存餐廳數據
        // 如果沒有坐標但有地址，記錄地址以便後續處理
        if (
          restaurant.latitude === 0 &&
          restaurant.longitude === 0 &&
          restaurant.address
        ) {
          console.log(`   ℹ️  暫未獲取坐標，將使用地址: ${restaurant.address}`);
          // 地理編碼可以在後續批次處理中進行
          // 目前先保存餐廳基本信息
        }

        return restaurant;
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMsg = error?.message || String(error);

        // 檢查是否為頁面崩潰錯誤
        const isPageCrashed =
          errorMsg.includes("Page crashed") ||
          errorMsg.includes("Target closed") ||
          errorMsg.includes("Session closed");

        if (isPageCrashed && attempt < maxRetries) {
          console.warn(
            `   ⚠️  頁面崩潰 (嘗試 ${attempt}/${maxRetries})，將重試...`
          );
          // 等待一段時間後重試
          await this.delay(3000);
          // 重新創建頁面
          try {
            if (!currentPage.isClosed()) {
              await currentPage.close();
            }
          } catch (e) {
            // 忽略關閉錯誤
          }
          currentPage = await this.createPage();
          continue;
        }

        // 檢查是否為超時錯誤
        const isTimeout =
          errorMsg.includes("timeout") ||
          errorMsg.includes("Navigation timeout");

        if (isTimeout && attempt < maxRetries) {
          console.warn(
            `   ⚠️  頁面加載超時 (嘗試 ${attempt}/${maxRetries})，將重試...`
          );
          await this.delay(2000);
          continue;
        }

        // 其他錯誤或已達到最大重試次數
        if (attempt === maxRetries) {
          console.error(
            `   ❌ 爬取餐廳詳情失敗 (已重試 ${maxRetries} 次): ${url}`
          );
          console.error(`   錯誤: ${errorMsg}`);
          return null;
        }
      }
    }

    // 如果所有重試都失敗
    if (lastError) {
      console.error(`   ❌ 爬取餐廳詳情最終失敗: ${url}`);
      console.error(`   最後錯誤: ${lastError.message}`);
    }
    return null;
  }

  /**
   * 構建搜索 URL
   */
  private buildSearchUrl(criteria: MatchCriteria): string {
    // OpenRice 的搜索 URL 格式
    // 注意：OpenRice 的 URL 參數可能需要調整
    // 可以先訪問 https://www.openrice.com/zh/hongkong 查看實際的搜索 URL 格式
    const baseUrl = "https://www.openrice.com/zh/hongkong/restaurants";
    const params = new URLSearchParams();

    // 添加搜索關鍵詞（優先使用食物類型）
    if (criteria.foodTypes && criteria.foodTypes.length > 0) {
      params.append("what", criteria.foodTypes[0]);
    }

    // 添加菜系類型（需要映射到 OpenRice 的菜系 ID）
    if (criteria.cuisineTypes && criteria.cuisineTypes.length > 0) {
      const cuisineId = this.mapCuisineToOpenRiceId(criteria.cuisineTypes[0]);
      if (cuisineId) {
        params.append("cuisine", cuisineId.toString());
      }
    }

    // 添加區域（需要映射到 OpenRice 的區域 ID）
    if (criteria.districts && criteria.districts.length > 0) {
      const districtId = this.mapDistrictToOpenRiceId(criteria.districts[0]);
      if (districtId) {
        params.append("district", districtId.toString());
      }
    }

    const queryString = params.toString();
    const finalUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;
    console.log(`   🔗 構建的搜索 URL: ${finalUrl}`);
    return finalUrl;
  }

  /**
   * 構建分頁 URL
   */
  private buildPageUrl(baseUrl: string, page: number): string {
    const url = new URL(baseUrl);
    url.searchParams.set("page", page.toString());
    return url.toString();
  }

  /**
   * 檢查是否有下一頁
   */
  private async hasNextPage(page: Page): Promise<boolean> {
    try {
      // 嘗試多種可能的分頁選擇器
      const nextPageSelectors = [
        ".pagination-next:not(.disabled)",
        ".pagination .next:not(.disabled)",
        "a[aria-label='下一頁']:not(.disabled)",
        "a[title='下一頁']:not(.disabled)",
        ".page-next:not(.disabled)",
      ];

      for (const selector of nextPageSelectors) {
        const nextButton = await page.$(selector);
        if (nextButton) {
          const isDisabled = await nextButton.evaluate(
            (el) =>
              el.classList.contains("disabled") || el.hasAttribute("disabled")
          );
          if (!isDisabled) {
            return true;
          }
        }
      }

      // 檢查當前頁碼和總頁數
      const pageInfo = await page.evaluate(() => {
        const currentPageEl = document.querySelector(
          ".pagination-current, .page-current"
        );
        const totalPageEl = document.querySelector(
          ".pagination-total, .page-total"
        );
        if (currentPageEl && totalPageEl) {
          const current = parseInt(currentPageEl.textContent || "1", 10);
          const total = parseInt(totalPageEl.textContent || "1", 10);
          return { current, total };
        }
        return null;
      });

      if (pageInfo && pageInfo.current < pageInfo.total) {
        return true;
      }

      return false;
    } catch (error) {
      console.error("檢查下一頁失敗:", error);
      return false;
    }
  }

  /**
   * 將菜系類型映射到 OpenRice 的菜系 ID
   * 注意：這些 ID 需要根據 OpenRice 的實際情況調整
   */
  private mapCuisineToOpenRiceId(cuisineType: string): number | null {
    const cuisineMap: { [key: string]: number } = {
      中餐: 1,
      日料: 2,
      韓式: 3,
      泰式: 4,
      義式: 5,
      法式: 6,
      美式: 7,
      墨西哥: 8,
      印度菜: 9,
    };

    return cuisineMap[cuisineType] || null;
  }

  /**
   * 將區域映射到 OpenRice 的區域 ID
   * 注意：這些 ID 需要根據 OpenRice 的實際情況調整
   */
  private mapDistrictToOpenRiceId(district: string): number | null {
    const districtMap: { [key: string]: number } = {
      中環: 2001,
      銅鑼灣: 2002,
      尖沙咀: 2003,
      旺角: 2004,
      灣仔: 2005,
      上環: 2006,
      金鐘: 2007,
      佐敦: 2008,
      油麻地: 2009,
      深水埗: 2010,
    };

    return districtMap[district] || null;
  }
}
