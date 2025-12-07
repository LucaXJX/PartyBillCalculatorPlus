/**
 * 解壓 Food-101 數據集
 * 使用 Node.js 的 tar 庫或系統命令
 */

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_BASE = path.resolve(__dirname, "../../data");
const food101Dir = path.join(DATA_BASE, "raw", "food-101");
const tarPath = path.join(food101Dir, "food-101.tar.gz");

async function extractFood101() {
  console.log("📦 開始解壓 Food-101 數據集...");
  console.log(`   文件: ${tarPath}`);

  // 檢查文件是否存在
  if (!(await fs.pathExists(tarPath))) {
    console.error("❌ tar.gz 文件不存在");
    process.exit(1);
  }

  // 檢查文件大小
  const stats = await fs.stat(tarPath);
  const sizeGB = stats.size / 1024 / 1024 / 1024;
  console.log(`   文件大小: ${sizeGB.toFixed(2)} GB`);

  if (sizeGB < 4.5) {
    console.warn("⚠️  文件大小可能不完整（預期約 4.7-5GB）");
    console.warn("   建議重新下載完整文件");
  }

  // 檢查是否已解壓（可能解壓到 food-101/food-101/images 或 food-101/images）
  const imagesDir1 = path.join(food101Dir, "images");
  const imagesDir2 = path.join(food101Dir, "food-101", "images");
  const imagesDir = (await fs.pathExists(imagesDir1)) ? imagesDir1 : 
                   (await fs.pathExists(imagesDir2)) ? imagesDir2 : null;
  
  if (imagesDir) {
    console.log("✅ 數據集已解壓，跳過");
    const categories = await fs.readdir(imagesDir);
    console.log(`   找到 ${categories.length} 個食物類別`);
    return;
  }

  try {
    console.log("\n⏳ 正在解壓（這可能需要幾分鐘）...");

    // 嘗試使用系統 tar 命令
    const command = `cd "${food101Dir}" && tar -xzf food-101.tar.gz`;
    
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    if (stderr && !stderr.includes("Removing leading")) {
      console.warn("⚠️  解壓警告:", stderr);
    }

    // 驗證解壓結果（檢查兩種可能的目錄結構）
    const imagesDir1 = path.join(food101Dir, "images");
    const imagesDir2 = path.join(food101Dir, "food-101", "images");
    const finalImagesDir = (await fs.pathExists(imagesDir1)) ? imagesDir1 : 
                           (await fs.pathExists(imagesDir2)) ? imagesDir2 : null;
    
    if (finalImagesDir) {
      const categories = await fs.readdir(finalImagesDir);
      console.log(`\n✅ 解壓完成！`);
      console.log(`   找到 ${categories.length} 個食物類別`);
      console.log(`   目錄: ${finalImagesDir}`);
    } else {
      console.error("❌ 解壓失敗：images 目錄不存在");
      console.error("   請檢查解壓後的目錄結構");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ 解壓失敗:", error);
    if (error instanceof Error) {
      console.error("   錯誤詳情:", error.message);
    }
    console.log("\n💡 如果系統 tar 命令失敗，可以嘗試：");
    console.log("   1. 使用 7-Zip 或其他解壓工具手動解壓");
    console.log("   2. 或安裝 Node.js tar 庫：pnpm add tar");
    process.exit(1);
  }
}

extractFood101().catch(console.error);

