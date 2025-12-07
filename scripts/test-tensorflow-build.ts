// 測試 TensorFlow.js 構建狀態
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, "..");
const tfjsNodePath = path.join(
  projectRoot,
  "node_modules",
  "@tensorflow",
  "tfjs-node"
);

console.log("🔍 檢查 TensorFlow.js 構建狀態...\n");

// 檢查目錄結構
console.log("📁 目錄結構:");
console.log(`   項目根目錄: ${projectRoot}`);
console.log(`   TensorFlow.js 路徑: ${tfjsNodePath}`);
console.log(`   目錄存在: ${fs.existsSync(tfjsNodePath) ? "✅" : "❌"}\n`);

// 檢查 napi-v8 目錄
const napiV8Path = path.join(tfjsNodePath, "lib", "napi-v8");
console.log("📦 napi-v8 目錄:");
console.log(`   路徑: ${napiV8Path}`);
console.log(`   存在: ${fs.existsSync(napiV8Path) ? "✅" : "❌"}`);

if (fs.existsSync(napiV8Path)) {
  const files = fs.readdirSync(napiV8Path);
  console.log(`   文件列表:`);
  files.forEach((file) => {
    const filePath = path.join(napiV8Path, file);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`     - ${file} (${size} MB)`);
  });
}

// 檢查 tfjs_binding.node
const bindingPath = path.join(napiV8Path, "tfjs_binding.node");
console.log(`\n🔌 tfjs_binding.node:`);
console.log(`   路徑: ${bindingPath}`);
console.log(`   存在: ${fs.existsSync(bindingPath) ? "✅" : "❌"}`);

if (fs.existsSync(bindingPath)) {
  const stats = fs.statSync(bindingPath);
  const size = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`   大小: ${size} MB`);
  console.log(`   修改時間: ${stats.mtime.toLocaleString()}`);
}

// 嘗試加載模塊
console.log(`\n🧪 嘗試加載 TensorFlow.js 模塊...`);
try {
  const tf = await import("@tensorflow/tfjs-node");
  console.log("✅ 模塊導入成功");
  
  // 嘗試創建一個簡單的張量來測試
  const tensor = tf.tensor2d([[1, 2], [3, 4]]);
  console.log("✅ 張量創建成功");
  console.log(`   張量形狀: [${tensor.shape.join(", ")}]`);
  tensor.dispose();
  
  console.log("\n✅ TensorFlow.js 可以正常使用！");
} catch (error) {
  console.log("❌ 模塊加載失敗:");
  if (error instanceof Error) {
    console.log(`   錯誤類型: ${error.constructor.name}`);
    console.log(`   錯誤消息: ${error.message}`);
    if (error.stack) {
      console.log(`   堆棧追蹤:\n${error.stack.split("\n").slice(0, 5).join("\n")}`);
    }
  } else {
    console.log(`   錯誤: ${String(error)}`);
  }
  
  console.log("\n💡 建議:");
  console.log("   1. 確保已安裝 Visual Studio Build Tools");
  console.log("   2. 使用 Developer Command Prompt 運行構建");
  console.log("   3. 運行: pnpm rebuild @tensorflow/tfjs-node");
  console.log("   4. 或運行: npm run build:tensorflow");
}

