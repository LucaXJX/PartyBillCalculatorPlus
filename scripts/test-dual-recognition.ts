/**
 * 雙重識別系統測試腳本
 * 用於快速測試 API 和模型識別功能
 */

import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const BASE_URL = process.env.TEST_API_URL || "http://localhost:3000";
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || "test@example.com";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "test123";

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

/**
 * 測試步驟
 */
async function runTests() {
  console.log("🧪 開始測試雙重識別系統...\n");

  let authToken: string | null = null;
  let testBillId: string | null = null;
  let testImageId: number | null = null;

  try {
    // 1. 測試登錄（如果失敗，嘗試註冊）
    console.log("1️⃣  測試用戶登錄...");
    try {
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      if (loginResponse.data.sessionId) {
        authToken = loginResponse.data.sessionId;
        results.push({
          name: "用戶登錄",
          success: true,
          message: "登錄成功",
        });
        console.log("   ✅ 登錄成功\n");
      } else {
        throw new Error("未返回 sessionId");
      }
    } catch (error: any) {
      // 詳細錯誤信息
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.error || error.message;
      const errorDetails = error.response?.data || {};
      
      console.log(`   🔍 錯誤詳情:`);
      console.log(`      - 狀態碼: ${statusCode || "N/A"}`);
      console.log(`      - 錯誤信息: ${errorMessage}`);
      if (error.code === "ECONNREFUSED") {
        console.log(`      - 連接被拒絕，請確保服務器正在運行 (${BASE_URL})`);
      }
      
      // 如果登錄失敗，嘗試註冊
      if (statusCode === 401 || statusCode === 404 || error.code === "ECONNREFUSED") {
        if (error.code === "ECONNREFUSED") {
          results.push({
            name: "用戶登錄",
            success: false,
            message: `無法連接到服務器: ${BASE_URL}`,
          });
          console.log("   ❌ 無法連接到服務器");
          console.log("   💡 提示: 請先運行 `npm run dev` 啟動服務器\n");
          return;
        }
        
        console.log("   ⚠️  用戶不存在，嘗試註冊...");
        try {
          const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
            username: "測試用戶",
            email: TEST_USER_EMAIL,
            password: TEST_USER_PASSWORD,
          });

          if (registerResponse.data.sessionId) {
            authToken = registerResponse.data.sessionId;
            results.push({
              name: "用戶註冊",
              success: true,
              message: "註冊成功",
            });
            console.log("   ✅ 註冊成功，已自動創建測試用戶\n");
          } else {
            // 註冊成功但沒有 sessionId，嘗試登錄
            const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
              email: TEST_USER_EMAIL,
              password: TEST_USER_PASSWORD,
            });
            if (loginResponse.data.sessionId) {
              authToken = loginResponse.data.sessionId;
              results.push({
                name: "用戶登錄",
                success: true,
                message: "登錄成功（註冊後）",
              });
              console.log("   ✅ 註冊後登錄成功\n");
            } else {
              throw new Error("註冊成功但登錄失敗");
            }
          }
        } catch (registerError: any) {
          const registerStatus = registerError.response?.status;
          const registerMessage = registerError.response?.data?.error || registerError.message;
          
          results.push({
            name: "用戶註冊/登錄",
            success: false,
            message: registerMessage,
          });
          console.log("   ❌ 註冊失敗:");
          console.log(`      - 狀態碼: ${registerStatus || "N/A"}`);
          console.log(`      - 錯誤信息: ${registerMessage}`);
          console.log("   💡 提示: 請手動創建測試用戶或檢查環境變量\n");
          return;
        }
      } else {
        results.push({
          name: "用戶登錄",
          success: false,
          message: errorMessage,
        });
        console.log("   ❌ 登錄失敗:", errorMessage);
        console.log("   💡 提示: 請先創建測試用戶或檢查環境變量\n");
        return;
      }
    }

    // 2. 獲取或創建測試訂單
    console.log("2️⃣  獲取測試訂單...");
    try {
      console.log(`   🔍 請求 URL: ${BASE_URL}/api/bills`);
      console.log(`   🔍 Session ID: ${authToken?.substring(0, 20)}...`);
      
      const billsResponse = await axios.get(`${BASE_URL}/api/bills`, {
        headers: { 
          Authorization: `Bearer ${authToken}`,
          "x-session-id": authToken,
        },
      });

      if (billsResponse.data.bills && billsResponse.data.bills.length > 0) {
        testBillId = billsResponse.data.bills[0].id;
        results.push({
          name: "獲取訂單",
          success: true,
          message: `找到 ${billsResponse.data.bills.length} 個訂單`,
        });
        console.log(`   ✅ 使用現有訂單: ${testBillId}\n`);
      } else {
        console.log("   ⚠️  沒有現有訂單，需要創建新訂單");
        console.log("   💡 提示: 系統使用單一賬單模式，需要先創建賬單\n");
        
        // 對於單一賬單模式，我們需要先創建一個賬單
        // 但首先需要檢查是否有創建賬單的 API
        // 如果沒有，我們可以嘗試使用 /api/bill/reset 來創建新賬單
        try {
          // 嘗試重置/創建新賬單
          await axios.post(
            `${BASE_URL}/api/bill/reset`,
            {},
            {
              headers: { 
                Authorization: `Bearer ${authToken}`,
                "x-session-id": authToken,
              },
            }
          );
          
          // 設置賬單信息
          await axios.post(
            `${BASE_URL}/api/bill/info`,
            {
              name: "測試訂單 - 雙重識別",
              date: new Date().toISOString().split("T")[0],
              location: "測試餐廳",
              tipPercentage: 10,
              payerId: null,
            },
            {
              headers: { 
                Authorization: `Bearer ${authToken}`,
                "x-session-id": authToken,
              },
            }
          );
          
          // 添加參與者
          const p1 = await axios.post(
            `${BASE_URL}/api/participant`,
            { name: "測試用戶1" },
            {
              headers: { 
                Authorization: `Bearer ${authToken}`,
                "x-session-id": authToken,
              },
            }
          );
          
          const p2 = await axios.post(
            `${BASE_URL}/api/participant`,
            { name: "測試用戶2" },
            {
              headers: { 
                Authorization: `Bearer ${authToken}`,
                "x-session-id": authToken,
              },
            }
          );
          
          // 設置付款人
          await axios.post(
            `${BASE_URL}/api/bill/info`,
            {
              name: "測試訂單 - 雙重識別",
              date: new Date().toISOString().split("T")[0],
              location: "測試餐廳",
              tipPercentage: 10,
              payerId: p1.data.id,
            },
            {
              headers: { 
                Authorization: `Bearer ${authToken}`,
                "x-session-id": authToken,
              },
            }
          );
          
          // 保存賬單以獲取 billId
          const saveResponse = await axios.post(
            `${BASE_URL}/api/bill/save`,
            {},
            {
              headers: { 
                Authorization: `Bearer ${authToken}`,
                "x-session-id": authToken,
              },
            }
          );
          
          testBillId = saveResponse.data.billId;
          results.push({
            name: "創建訂單",
            success: true,
            message: "創建測試訂單成功",
          });
          console.log(`   ✅ 創建新訂單: ${testBillId}\n`);
        } catch (createError: any) {
          console.log("   ⚠️  無法創建新訂單，將使用現有賬單（如果有的話）");
          console.log(`   🔍 創建錯誤: ${createError.response?.status} - ${createError.response?.data?.error || createError.message}`);
          
          // 如果創建失敗，嘗試再次獲取賬單列表
          const retryResponse = await axios.get(`${BASE_URL}/api/bills`, {
            headers: { 
              Authorization: `Bearer ${authToken}`,
              "x-session-id": authToken,
            },
          });
          
          if (retryResponse.data.bills && retryResponse.data.bills.length > 0) {
            testBillId = retryResponse.data.bills[0].id;
            console.log(`   ✅ 使用現有訂單: ${testBillId}\n`);
          } else {
            throw new Error("無法獲取或創建訂單");
          }
        }
      }
    } catch (error: any) {
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.error || error.message;
      const errorDetails = error.response?.data || {};
      
      results.push({
        name: "獲取/創建訂單",
        success: false,
        message: errorMessage,
      });
      
      console.log("   ❌ 失敗:");
      console.log(`      - 狀態碼: ${statusCode || "N/A"}`);
      console.log(`      - 錯誤信息: ${errorMessage}`);
      console.log(`      - 請求 URL: ${BASE_URL}/api/bills`);
      
      if (statusCode === 404) {
        console.log("   💡 可能原因:");
        console.log("      - API 端點不存在或路由未正確配置");
        console.log("      - 認證失敗導致路由未匹配");
        console.log("      - 服務器未正確啟動");
      } else if (statusCode === 401) {
        console.log("   💡 可能原因:");
        console.log("      - Session ID 無效或已過期");
        console.log("      - 認證頭部未正確傳遞");
      }
      
      console.log();
      
      // 不立即返回，繼續測試其他功能
      // return;
    }

    // 3. 檢查食物圖片
    console.log("3️⃣  檢查食物圖片...");
    try {
      const imagesResponse = await axios.get(
        `${BASE_URL}/api/food/images/${testBillId}`,
        {
          headers: { 
            Authorization: `Bearer ${authToken}`,
            "x-session-id": authToken,
          },
        }
      );

      const images = imagesResponse.data.images || [];
      results.push({
        name: "獲取食物圖片",
        success: true,
        message: `找到 ${images.length} 張圖片`,
        data: { imageCount: images.length },
      });
      console.log(`   ✅ 找到 ${images.length} 張圖片\n`);

      if (images.length > 0) {
        testImageId = images[0].id;
        console.log(`   📸 使用圖片 ID: ${testImageId}\n`);

        // 檢查識別狀態
        const image = images[0];
        console.log("   📊 識別狀態:");
        console.log(`      - 識別狀態: ${image.recognitionStatus}`);
        console.log(`      - API 識別: ${image.recognitionResult ? "✅" : "❌"}`);
        console.log(
          `      - 模型識別: ${image.modelRecognitionResult ? "✅" : "❌"}`
        );
        if (image.modelRecognitionConfidence) {
          console.log(
            `      - 模型置信度: ${(image.modelRecognitionConfidence * 100).toFixed(1)}%`
          );
        }
        console.log();
      } else {
        console.log("   ⚠️  沒有食物圖片，跳過識別測試\n");
        console.log("   💡 提示: 請先上傳食物圖片到訂單\n");
      }
    } catch (error: any) {
      results.push({
        name: "獲取食物圖片",
        success: false,
        message: error.response?.data?.error || error.message,
      });
      console.log("   ❌ 失敗:", error.response?.data?.error || error.message);
    }

    // 4. 測試推薦 API
    if (testBillId) {
      console.log("4️⃣  測試推薦 API...");
      try {
        const recommendationsResponse = await axios.get(
          `${BASE_URL}/api/bills/${testBillId}/food-recommendations`,
          {
            headers: { 
              Authorization: `Bearer ${authToken}`,
              "x-session-id": authToken,
            },
          }
        );

        const { recommendations, formatted, imageCount } =
          recommendationsResponse.data;

        results.push({
          name: "獲取推薦",
          success: true,
          message: `找到 ${recommendations.length} 個推薦`,
          data: { recommendations, imageCount },
        });

        console.log(`   ✅ 找到 ${recommendations.length} 個推薦（來自 ${imageCount} 張圖片）\n`);

        if (recommendations.length > 0) {
          console.log("   📋 推薦列表:");
          recommendations.slice(0, 5).forEach((rec: any, index: number) => {
            console.log(
              `      ${index + 1}. [${rec.source}] ${rec.name} (置信度: ${(rec.confidence * 100).toFixed(1)}%)`
            );
            if (rec.calories) {
              console.log(`         卡路里: ${rec.calories}`);
            }
            if (rec.country) {
              console.log(`         國家: ${rec.country}`);
            }
          });
          console.log();

          if (formatted) {
            console.log("   📝 格式化輸出:");
            console.log(`   ${formatted.split("\n").join("\n   ")}\n`);
          }
        } else {
          console.log("   ⚠️  沒有推薦結果\n");
          console.log("   💡 可能原因:");
          console.log("      - 圖片尚未識別");
          console.log("      - 識別結果置信度太低");
          console.log("      - 識別失敗\n");
        }
      } catch (error: any) {
        results.push({
          name: "獲取推薦",
          success: false,
          message: error.response?.data?.error || error.message,
        });
        console.log("   ❌ 失敗:", error.response?.data?.error || error.message);
      }
    }

    // 5. 測試單張圖片推薦
    if (testImageId) {
      console.log("5️⃣  測試單張圖片推薦...");
      try {
        const imageRecommendationsResponse = await axios.get(
          `${BASE_URL}/api/food-images/${testImageId}/recommendations`,
          {
            headers: { 
              Authorization: `Bearer ${authToken}`,
              "x-session-id": authToken,
            },
          }
        );

        const { recommendations } = imageRecommendationsResponse.data;

        results.push({
          name: "獲取單張圖片推薦",
          success: true,
          message: `找到 ${recommendations.length} 個推薦`,
        });

        console.log(`   ✅ 找到 ${recommendations.length} 個推薦\n`);
      } catch (error: any) {
        results.push({
          name: "獲取單張圖片推薦",
          success: false,
          message: error.response?.data?.error || error.message,
        });
        console.log("   ❌ 失敗:", error.response?.data?.error || error.message);
      }
    }

    // 6. 檢查模型狀態
    console.log("6️⃣  檢查模型狀態...");
    try {
      const modelsResponse = await axios.get(
        `${BASE_URL}/api/food/models/active`,
        {
          headers: { 
            Authorization: `Bearer ${authToken}`,
            "x-session-id": authToken,
          },
        }
      );

      const versions = modelsResponse.data.versions || [];
      results.push({
        name: "檢查模型狀態",
        success: true,
        message: `找到 ${versions.length} 個活動模型版本`,
        data: { versions },
      });

      console.log(`   ✅ 找到 ${versions.length} 個活動模型版本\n`);
      if (versions.length > 0) {
        versions.forEach((v: any) => {
          console.log(`      - Level ${v.level}: ${v.version} (${v.model_path})`);
        });
        console.log();
      } else {
        console.log("   ⚠️  沒有活動模型版本\n");
        console.log("   💡 提示: 模型可能未加載或未訓練\n");
      }
    } catch (error: any) {
      results.push({
        name: "檢查模型狀態",
        success: false,
        message: error.response?.data?.error || error.message,
      });
      console.log("   ❌ 失敗:", error.response?.data?.error || error.message);
    }
  } catch (error: any) {
    console.error("❌ 測試過程中發生錯誤:", error.message);
  }

  // 輸出測試總結
  console.log("\n" + "=".repeat(50));
  console.log("📊 測試總結");
  console.log("=".repeat(50) + "\n");

  const successCount = results.filter((r) => r.success).length;
  const totalCount = results.length;

  results.forEach((result) => {
    const icon = result.success ? "✅" : "❌";
    console.log(`${icon} ${result.name}: ${result.message}`);
  });

  console.log(`\n總計: ${successCount}/${totalCount} 通過\n`);

  if (successCount === totalCount) {
    console.log("🎉 所有測試通過！\n");
  } else {
    console.log("⚠️  部分測試失敗，請檢查上述錯誤信息\n");
  }
}

// 運行測試
runTests().catch(console.error);

