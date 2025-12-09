/**
 * OpenRice 頁面結構調試腳本
 * 用於檢查實際的 HTML 結構和選擇器
 */

import { chromium } from "playwright";
import { getTargetConfig, scraperConfig } from "../config.js";

async function debugOpenRice() {
  const browser = await chromium.launch({
    headless: false, // 使用有頭模式，方便觀察
  });

  const context = await browser.newContext({
    userAgent: scraperConfig.userAgent,
  });

  const page = await context.newPage();

  try {
    // 訪問 OpenRice 搜索頁面
    const url = "https://www.openrice.com/zh/hongkong/restaurants?what=小籠包";
    console.log(`🔍 訪問: ${url}`);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // 等待頁面加載
    await page.waitForTimeout(3000);

    // 檢查頁面標題
    const title = await page.title();
    console.log(`📄 頁面標題: ${title}`);

    // 檢查 URL（可能被重定向）
    const currentUrl = page.url();
    console.log(`🔗 當前 URL: ${currentUrl}`);

    // 嘗試多種選擇器
    const selectors = [
      ".poi-list-desktop-container a[href*='/restaurant/']",
      "[class*='poi-list'] a[href*='/restaurant/']",
      "[class*='poi-item'] a",
      "a[href*='/restaurant/']",
      "a[href*='/zh/hongkong/restaurant/']",
      ".sr1-listing-content",
      ".poi-list-item",
      "[data-restaurant-id]",
      ".restaurant-item",
      ".poi-info",
    ];

    console.log("\n🔍 測試選擇器:");
    for (const selector of selectors) {
      try {
        const count = await page.$$(selector).then((els) => els.length);
        console.log(`   ${selector}: ${count} 個元素`);
        
        if (count > 0 && count <= 5) {
          // 如果元素不多，顯示詳細信息
          const elements = await page.$$(selector);
          for (let i = 0; i < Math.min(elements.length, 3); i++) {
            const text = await elements[i].textContent();
            const href = await elements[i].getAttribute("href");
            console.log(`      [${i}] 文本: ${text?.substring(0, 50)}`);
            console.log(`      [${i}] 鏈接: ${href}`);
          }
        }
      } catch (error) {
        console.log(`   ${selector}: 錯誤 - ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 查找所有包含 "restaurant" 的鏈接（過濾掉導航鏈接）
    console.log("\n🔍 查找所有餐廳鏈接（過濾導航）:");
    const allRestaurantLinks = await page.$$eval("a[href*='restaurant']", (links) => {
      return links
        .map((link) => ({
          href: link.getAttribute("href") || "",
          text: link.textContent?.trim() || "",
          className: link.className,
        }))
        .filter((link) => {
          // 過濾掉導航和功能鏈接
          const href = link.href;
          return (
            href.includes("/restaurant/") &&
            !href.includes("ranking") &&
            !href.includes("article") &&
            !href.includes("report") &&
            !href.includes("map") &&
            !href.includes("restaurants-map") &&
            href.match(/\/restaurant\/[^\/]+\.htm/) // 只接受餐廳詳情頁
          );
        })
        .slice(0, 20);
    });

    console.log(`   找到 ${allRestaurantLinks.length} 個餐廳鏈接:`);
    allRestaurantLinks.forEach((link, i) => {
      console.log(`   [${i + 1}] ${link.text.substring(0, 30)}`);
      console.log(`       鏈接: ${link.href}`);
      console.log(`       類名: ${link.className}`);
    });

    // 保存頁面截圖（用於調試）
    await page.screenshot({ path: "scraper/data/openrice-debug.png", fullPage: true });
    console.log("\n📸 頁面截圖已保存到: scraper/data/openrice-debug.png");

    // 保存 HTML（用於分析）
    const html = await page.content();
    const fs = await import("fs");
    fs.writeFileSync("scraper/data/openrice-debug.html", html);
    console.log("📄 HTML 已保存到: scraper/data/openrice-debug.html");

    console.log("\n⏸️  保持瀏覽器打開 10 秒，方便手動檢查...");
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error("❌ 調試失敗:", error);
    if (error instanceof Error) {
      console.error("錯誤詳情:", error.message);
      console.error("錯誤堆棧:", error.stack);
    }
  } finally {
    await browser.close();
  }
}

debugOpenRice().catch(console.error);

