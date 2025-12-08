/**
 * 食物圖片管理器
 * 處理食物圖片的存儲、識別和記錄
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { proxy } from "../proxy.js";
import {
  compressImage,
  getImageInfo,
  safeDeleteFile,
} from "./imageProcessor.js";
import { recognizeFood } from "./baiduClient.js";
import { checkUsageLimit } from "./usageTracker.js";
import { dataStorage } from "../storage.js";

// 模型識別管道（可選，如果 TensorFlow.js 可用）
let recognitionPipeline: any = null;

/**
 * 設置模型識別管道（從 server.ts 調用）
 */
export function setRecognitionPipeline(pipeline: any): void {
  recognitionPipeline = pipeline;
}

/**
 * 檢查模型識別是否可用
 */
export function isModelRecognitionAvailable(): boolean {
  return recognitionPipeline !== null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 食物圖片存儲目錄
const FOOD_IMAGES_DIR = path.join(__dirname, "../../data/food_images");

// 確保目錄存在
if (!fs.existsSync(FOOD_IMAGES_DIR)) {
  fs.mkdirSync(FOOD_IMAGES_DIR, { recursive: true });
}

export interface FoodImageRecord {
  id?: number;
  billId: string;
  userId?: string;
  originalFilename: string;
  storedPath: string;
  originalPath?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  recognitionStatus: 0 | 1 | 2 | 3; // 0=未識別, 1=識別中, 2=已識別, 3=識別失敗
  recognitionResult?: string; // JSON - API識別結果
  recognitionError?: string;
  recognitionAt?: string;
  // 模型識別結果
  modelRecognitionResult?: string; // JSON - 模型識別結果
  modelRecognitionConfidence?: number; // 模型識別置信度
  modelRecognitionAt?: string;
  modelRecognitionError?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 保存食物圖片
 * @param originalPath 原始圖片路徑
 * @param billId 訂單 ID
 * @param userId 用戶 ID
 * @param originalFilename 原始文件名
 */
export async function saveFoodImage(
  originalPath: string,
  billId: string,
  userId?: string,
  originalFilename?: string
): Promise<FoodImageRecord> {
  if (!fs.existsSync(originalPath)) {
    throw new Error(`原始圖片不存在: ${originalPath}`);
  }

  // 驗證 billId 是否存在於數據庫中
  const bill = await dataStorage.getBillById(billId);
  if (!bill) {
    throw new Error(`訂單不存在: ${billId}。請先保存訂單再上傳圖片。`);
  }

  // 確保 bill 記錄存在於 proxy 中（better-sqlite3-proxy 需要這個來檢查外鍵約束）
  // 因為 storage.ts 使用 JSON 文件存儲，需要手動同步到 proxy.bill
  if ("bill" in proxy) {
    const bills = (proxy as any).bill;
    // 過濾掉 undefined 或 null 元素
    const validBills = bills.filter((b: any) => b != null);
    const billExists = validBills.some((b: any) => b && b.id === billId);
    
    if (!billExists) {
      console.log(`同步 bill ${billId} 到 proxy.bill...`);

      // 確保 bill 的 payer_id 和 created_by 對應的用戶也存在於 proxy.user
      if ("user" in proxy) {
        const users = (proxy as any).user;
        // 過濾掉 undefined 或 null 元素
        const validUsers = users.filter((u: any) => u != null);

        // 同步 payer_id 對應的用戶
        // 注意：payer_id 使用 bill.createdBy（創建者/登錄用戶的 ID），不再使用 bill.payerId（參與者 ID）
        // 因為 payer_id 和 created_by 是同一個用戶，所以只需要同步 created_by 即可

        // 同步 created_by 對應的用戶
        if (bill.createdBy) {
          // 檢查用戶是否已存在（通過 id 或 email）
          const existingCreatorById = validUsers.find(
            (u: any) => u && u.id === bill.createdBy
          );

          if (!existingCreatorById) {
            console.log(`同步 creator ${bill.createdBy} 到 proxy.user...`);
            const creator = await dataStorage.getUserById(bill.createdBy);
            if (creator) {
              // 檢查 email 是否已存在
              const existingCreatorByEmail = validUsers.find(
                (u: any) => u && u.email === creator.email
              );

              if (existingCreatorByEmail) {
                console.log(
                  `creator ${bill.createdBy} 的 email ${creator.email} 已存在於 proxy.user，使用已存在的用戶記錄`
                );
              } else {
                // 用戶不存在，插入新記錄
                try {
                  const proxyCreator: any = {
                    id: creator.id,
                    username: creator.username,
                    email: creator.email,
                    password: creator.password,
                    created_at: creator.createdAt || new Date().toISOString(),
                  };
                  users.push(proxyCreator);
                  console.log(`creator ${bill.createdBy} 已同步到 proxy.user`);
                } catch (error: any) {
                  // 如果插入失敗（可能是並發插入），檢查是否已存在
                  const checkAgain = validUsers.some(
                    (u: any) =>
                      u && (u.id === creator.id || u.email === creator.email)
                  );
                  if (checkAgain) {
                    console.log(
                      `creator ${bill.createdBy} 插入失敗但已存在，跳過`
                    );
                  } else {
                    throw error; // 重新拋出其他錯誤
                  }
                }
              }
            }
          } else {
            console.log(`creator ${bill.createdBy} 已存在於 proxy.user`);
          }
        }
      }

      // 再次檢查賬單是否存在（防止並發插入）
      const checkAgain = validBills.some((b: any) => b && b.id === billId);
      if (checkAgain) {
        console.log(`bill ${billId} 已存在於 proxy.bill，跳過插入`);
      } else {
        // 將 bill 記錄轉換為 proxy 格式並添加到 proxy.bill
        // 注意：payer_id 使用 bill.createdBy（創建者/登錄用戶的 ID），而不是 bill.payerId（參與者 ID）
        const proxyBill: any = {
          id: bill.id,
          name: bill.name,
          date: bill.date,
          location: bill.location || null,
          tip_percentage: bill.tipPercentage || 0,
          payer_id: bill.createdBy, // 使用創建者/登錄用戶的 ID
          created_by: bill.createdBy,
          payer_receipt_url: bill.payerReceiptUrl || null,
          created_at: bill.createdAt || new Date().toISOString(),
          updated_at: bill.updatedAt || new Date().toISOString(),
        };
        console.log(
          `準備添加 bill 到 proxy:`,
          JSON.stringify(proxyBill, null, 2)
        );
        
        try {
          bills.push(proxyBill);
          console.log(
            `bill ${billId} 已同步到 proxy.bill，當前 proxy.bill 長度: ${bills.length}`
          );
        } catch (error: any) {
          // 如果插入失敗（可能是並發插入導致 UNIQUE constraint），檢查是否已存在
          const finalCheck = validBills.some((b: any) => b && b.id === billId);
          if (finalCheck) {
            console.log(`bill ${billId} 插入失敗但已存在，跳過`);
          } else {
            throw error; // 重新拋出其他錯誤
          }
        }
      }
    } else {
      console.log(`bill ${billId} 已存在於 proxy.bill，跳過同步`);
    }
  }

  // 確保 user 記錄存在於 proxy 中（如果提供了 userId）
  // 因為 user_id 有外鍵約束，需要確保用戶存在
  if (userId && "user" in proxy) {
    const users = (proxy as any).user;
    // 過濾掉 undefined 或 null 元素
    const validUsers = users.filter((u: any) => u != null);
    // 檢查用戶是否已存在（通過 id 或 email）
    const userExistsById = validUsers.some((u: any) => u && u.id === userId);
    if (!userExistsById) {
      console.log(`同步 user ${userId} 到 proxy.user...`);
      // 從 storage 加載用戶信息
      const user = await dataStorage.getUserById(userId);
      if (user) {
        // 檢查 email 是否已存在（避免重複插入）
        const existingUserByEmail = validUsers.find(
          (u: any) => u && u.email === user.email
        );

        if (existingUserByEmail) {
          console.log(
            `user ${userId} 的 email ${user.email} 已存在於 proxy.user，使用已存在的用戶記錄`
          );
        } else {
          // 用戶不存在，插入新記錄
          try {
            const proxyUser: any = {
              id: user.id,
              username: user.username,
              email: user.email,
              password: user.password,
              created_at: user.createdAt || new Date().toISOString(),
            };
            users.push(proxyUser);
            console.log(`user ${userId} 已同步到 proxy.user`);
          } catch (error: any) {
            // 如果插入失敗（可能是並發插入），檢查是否已存在
            const checkAgain = validUsers.some(
              (u: any) => u && (u.id === user.id || u.email === user.email)
            );
            if (checkAgain) {
              console.log(`user ${userId} 插入失敗但已存在，跳過`);
            } else {
              throw error; // 重新拋出其他錯誤
            }
          }
        }
      } else {
        console.warn(
          `警告: user ${userId} 在數據庫中不存在，將設置 user_id 為 null`
        );
        // 如果用戶不存在，設置為 null 以避免外鍵約束錯誤
        userId = undefined;
      }
    } else {
      console.log(`user ${userId} 已存在於 proxy.user`);
    }
  }

  // 生成存儲文件名
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const ext = path.extname(originalPath) || ".jpg";
  const storedFilename = `food_${uniqueSuffix}${ext}`;
  const storedPath = path.join(FOOD_IMAGES_DIR, storedFilename);

  // 壓縮圖片
  const imageInfo = await compressImage(originalPath, storedPath, {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 85,
  });

  // 保存到數據庫
  const now = new Date().toISOString();
  console.log(
    `準備保存 food_image，bill_id: ${billId}, user_id: ${userId || null}`
  );
  const record: any = {
    bill_id: billId,
    user_id: userId || null,
    original_filename: originalFilename || path.basename(originalPath),
    stored_path: storedPath,
    original_path: originalPath,
    file_size: imageInfo.size,
    width: imageInfo.width || null,
    height: imageInfo.height || null,
    recognition_status: 0, // 未識別
    created_at: now,
    updated_at: now,
  };

  if ("food_images" in proxy) {
    try {
      (proxy as any).food_images.push(record);
      // 獲取插入後的 ID（better-sqlite3-proxy 會自動分配）
      const foodImages = (proxy as any).food_images;
      const insertedRecord = foodImages[foodImages.length - 1];
      if (insertedRecord && insertedRecord.id) {
        record.id = insertedRecord.id;
        console.log(`food_image 已成功插入，ID: ${record.id}`);
      } else {
        // 如果插入失敗，記錄錯誤
        console.error(
          "插入 food_image 失敗，無法獲取 ID，insertedRecord:",
          insertedRecord
        );
        throw new Error("插入 food_image 失敗，無法獲取 ID");
      }
    } catch (error: any) {
      console.error("插入 food_image 時發生錯誤:", error);
      throw error;
    }
  } else {
    throw new Error("food_images 表尚未創建，請先運行 migration");
  }

  return {
    id: record.id as number,
    billId: record.bill_id,
    userId: record.user_id,
    originalFilename: record.original_filename,
    storedPath: record.stored_path,
    originalPath: record.original_path,
    fileSize: record.file_size,
    width: record.width,
    height: record.height,
    recognitionStatus: 0,
    createdAt: record.created_at,
  };
}

/**
 * 根據 ID 獲取單張食物圖片
 */
export async function getFoodImageById(
  foodImageId: number
): Promise<FoodImageRecord | null> {
  if (!("food_images" in proxy)) {
    return null;
  }

  const images = (proxy as any).food_images;
  const validImages = images.filter((img: any) => img != null);
  const image = validImages.find((img: any) => img && img.id === foodImageId);

  if (!image) {
    return null;
  }

  return {
    id: image.id,
    billId: image.bill_id,
    userId: image.user_id,
    originalFilename: image.original_filename,
    storedPath: image.stored_path,
    originalPath: image.original_path,
    fileSize: image.file_size,
    width: image.width,
    height: image.height,
    recognitionStatus: image.recognition_status,
    recognitionResult: image.recognition_result,
    recognitionError: image.recognition_error,
    recognitionAt: image.recognition_at,
    modelRecognitionResult: image.model_recognition_result,
    modelRecognitionConfidence: image.model_recognition_confidence,
    modelRecognitionAt: image.model_recognition_at,
    modelRecognitionError: image.model_recognition_error,
    createdAt: image.created_at,
    updatedAt: image.updated_at,
  };
}

/**
 * 獲取訂單的食物圖片列表
 */
export async function getFoodImagesByBillId(
  billId: string
): Promise<FoodImageRecord[]> {
  if (!("food_images" in proxy)) {
    return [];
  }

  const images = (proxy as any).food_images.filter(
    (img: any) => img != null && img.bill_id === billId
  );
  return images.map((img: any) => ({
    id: img.id,
    billId: img.bill_id,
    userId: img.user_id,
    originalFilename: img.original_filename,
    storedPath: img.stored_path,
    originalPath: img.original_path,
    fileSize: img.file_size,
    width: img.width,
    height: img.height,
    recognitionStatus: img.recognition_status,
    recognitionResult: img.recognition_result,
    recognitionError: img.recognition_error,
    recognitionAt: img.recognition_at,
    createdAt: img.created_at,
    updatedAt: img.updated_at,
  }));
}

/**
 * 檢查訂單是否已達到圖片上傳限制（最多 2 張）
 */
export async function checkImageLimit(
  billId: string,
  limit: number = 2
): Promise<{
  allowed: boolean;
  current: number;
  remaining: number;
}> {
  const images = await getFoodImagesByBillId(billId);
  return {
    allowed: images.length < limit,
    current: images.length,
    remaining: Math.max(0, limit - images.length),
  };
}

/**
 * 使用模型識別食物圖片
 * @param imagePath 圖片路徑
 * @returns 模型識別結果
 */
async function recognizeFoodWithModel(imagePath: string): Promise<{
  result: any;
  confidence: number;
} | null> {
  if (!recognitionPipeline) {
    console.warn("⚠️  識別管道不可用（recognitionPipeline 為 null）");
    return null;
  }
  
  if (!fs.existsSync(imagePath)) {
    console.warn(`⚠️  圖片文件不存在: ${imagePath}`);
    return null;
  }

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    console.log(`📸 讀取圖片: ${imagePath}, 大小: ${imageBuffer.length} bytes`);
    
    const modelResult = await recognitionPipeline.recognizeFoodImage(imageBuffer);
    console.log(`🔍 模型識別原始結果:`, JSON.stringify(modelResult).substring(0, 200));

    if (!modelResult.is_food) {
      console.log("ℹ️  模型判斷不是食物");
      return null;
    }

    const confidence = modelResult.overall_confidence || modelResult.confidence || 0;
    console.log(`✅ 模型識別成功: is_food=true, confidence=${confidence}, food_name=${modelResult.food_name || 'unknown'}`);
    
    return {
      result: modelResult,
      confidence: confidence,
    };
  } catch (error) {
    console.error("❌ 模型識別失敗:", error);
    return null;
  }
}

/**
 * 識別食物圖片（異步）- 同時調用 API 和模型識別
 * @param foodImageId 食物圖片 ID
 */
export async function recognizeFoodImage(foodImageId: number): Promise<void> {
  if (!("food_images" in proxy)) {
    throw new Error("food_images 表尚未創建");
  }

  const images = (proxy as any).food_images;
  // 過濾掉 undefined 或 null 元素
  const validImages = images.filter((img: any) => img != null);
  const image = validImages.find((img: any) => img && img.id === foodImageId);

  if (!image) {
    throw new Error(`食物圖片不存在: ${foodImageId}`);
  }

  // 檢查是否已識別
  if (image.recognition_status === 2) {
    return; // 已識別，跳過
  }

  // 更新狀態為識別中
  image.recognition_status = 1;
  image.updated_at = new Date().toISOString();

  // 並行調用 API 和模型識別
  const apiPromise = (async () => {
    try {
      // 檢查 API 使用限制
      const usageCheck = await checkUsageLimit(1000);
      if (!usageCheck.allowed) {
        throw new Error(`已超過 API 使用限制（${usageCheck.used}/1000）`);
      }

      // 調用識別 API
      const results = await recognizeFood(
        image.stored_path,
        image.user_id,
        foodImageId
      );
      return { success: true, results };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })();

  const modelPromise = (async () => {
    try {
      console.log(`🔍 開始模型識別: ${image.stored_path}`);
      const modelResult = await recognizeFoodWithModel(image.stored_path);
      if (modelResult) {
        console.log(`✅ 模型識別成功: confidence=${modelResult.confidence}`);
        return { success: true, result: modelResult };
      } else {
        console.log("ℹ️  模型識別返回 null（可能不是食物）");
        return { success: true, result: null };
      }
    } catch (error) {
      console.error("❌ 模型識別異常:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })();

  // 等待兩個識別完成
  const [apiResult, modelResult] = await Promise.all([apiPromise, modelPromise]);

  // 更新 API 識別結果
  if (apiResult.success) {
    image.recognition_result = JSON.stringify(apiResult.results);
    image.recognition_at = new Date().toISOString();
  } else {
    image.recognition_error = apiResult.error;
  }

  // 更新模型識別結果
  if (modelResult.success && modelResult.result) {
    // modelResult.result 的結構是 { result: RecognitionResult, confidence: number }
    // 所以需要訪問 modelResult.result.result 來獲取實際的識別結果
    image.model_recognition_result = JSON.stringify(modelResult.result.result);
    image.model_recognition_confidence = modelResult.result.confidence;
    image.model_recognition_at = new Date().toISOString();
    console.log(`✅ 模型識別結果已保存到數據庫: confidence=${modelResult.result.confidence}, result=${JSON.stringify(modelResult.result.result).substring(0, 100)}...`);
  } else if (!modelResult.success) {
    image.model_recognition_error = modelResult.error;
    console.warn(`⚠️  模型識別失敗: ${modelResult.error}`);
  } else {
    console.log("ℹ️  模型識別未返回結果（可能不是食物或識別管道不可用）");
  }

  // 如果至少有一個識別成功，標記為已識別
  if (apiResult.success || (modelResult.success && modelResult.result)) {
    image.recognition_status = 2;
  } else {
    // 兩個都失敗
    image.recognition_status = 3;
    if (!image.recognition_error) {
      image.recognition_error = "API 和模型識別都失敗";
    }
  }

  image.updated_at = new Date().toISOString();

  // 刪除原始圖片（如果存在）
  if (image.original_path && image.original_path !== image.stored_path) {
    await safeDeleteFile(image.original_path);
    image.original_path = null;
  }

  // 如果兩個都失敗，拋出錯誤
  if (!apiResult.success && (!modelResult.success || !modelResult.result)) {
    throw new Error(
      `識別失敗: API=${apiResult.error || "未知錯誤"}, Model=${modelResult.error || "未知錯誤"}`
    );
  }
}

/**
 * 獲取未識別的圖片列表（用於自檢）
 */
export async function getUnrecognizedImages(): Promise<FoodImageRecord[]> {
  if (!("food_images" in proxy)) {
    return [];
  }

  const images = (proxy as any).food_images.filter(
    (img: any) => img.recognition_status === 0 || img.recognition_status === 3
  );

  return images.map((img: any) => ({
    id: img.id,
    billId: img.bill_id,
    userId: img.user_id,
    originalFilename: img.original_filename,
    storedPath: img.stored_path,
    originalPath: img.original_path,
    fileSize: img.file_size,
    width: img.width,
    height: img.height,
    recognitionStatus: img.recognition_status,
    recognitionResult: img.recognition_result,
    recognitionError: img.recognition_error,
    recognitionAt: img.recognition_at,
    modelRecognitionResult: img.model_recognition_result,
    modelRecognitionConfidence: img.model_recognition_confidence,
    modelRecognitionAt: img.model_recognition_at,
    modelRecognitionError: img.model_recognition_error,
    createdAt: img.created_at,
    updatedAt: img.updated_at,
  }));
}

/**
 * 刪除食物圖片（包括文件）
 */
export async function deleteFoodImage(foodImageId: number): Promise<void> {
  if (!("food_images" in proxy)) {
    throw new Error("food_images 表尚未創建");
  }

  const images = (proxy as any).food_images;
  // 過濾掉 undefined 或 null 元素
  const validImages = images.filter((img: any) => img != null);
  const image = validImages.find((img: any) => img && img.id === foodImageId);

  if (!image) {
    throw new Error(`食物圖片不存在: ${foodImageId}`);
  }

  // 在原始數組中找到索引（用於刪除）
  const index = images.findIndex((img: any) => img && img.id === foodImageId);

  // 刪除文件
  if (image.stored_path) {
    await safeDeleteFile(image.stored_path);
  }
  if (image.original_path && image.original_path !== image.stored_path) {
    await safeDeleteFile(image.original_path);
  }

  // 從數據庫中刪除
  images.splice(index, 1);
}
