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
  recognitionResult?: string; // JSON
  recognitionError?: string;
  recognitionAt?: string;
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
    const billExists = bills.some((b: any) => b.id === billId);
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
          const existingCreatorByEmail = existingCreatorById
            ? null
            : users.find((u: any) => {
                // 需要先獲取 creator 的 email 才能檢查
                return false; // 暫時返回 false，下面會處理
              });

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
      bills.push(proxyBill);
      console.log(
        `bill ${billId} 已同步到 proxy.bill，當前 proxy.bill 長度: ${bills.length}`
      );
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
 * 識別食物圖片（異步）
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

  // 檢查 API 使用限制
  const usageCheck = await checkUsageLimit(1000);
  if (!usageCheck.allowed) {
    throw new Error(`已超過 API 使用限制（${usageCheck.used}/1000）`);
  }

  // 更新狀態為識別中
  image.recognition_status = 1;
  image.updated_at = new Date().toISOString();

  try {
    // 調用識別 API
    const results = await recognizeFood(
      image.stored_path,
      image.user_id,
      foodImageId
    );

    // 更新識別結果
    image.recognition_status = 2;
    image.recognition_result = JSON.stringify(results);
    image.recognition_at = new Date().toISOString();
    image.updated_at = new Date().toISOString();

    // 刪除原始圖片（如果存在）
    if (image.original_path && image.original_path !== image.stored_path) {
      await safeDeleteFile(image.original_path);
      image.original_path = null;
    }
  } catch (error) {
    // 識別失敗
    image.recognition_status = 3;
    image.recognition_error =
      error instanceof Error ? error.message : String(error);
    image.updated_at = new Date().toISOString();
    throw error;
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
