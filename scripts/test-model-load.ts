/**
 * 測試 TensorFlow.js 模型加載
 * 驗證轉換後的模型是否可以被 Node.js 正確加載
 * 不影響數據庫
 */

import * as tf from "@tensorflow/tfjs";
import path from "path";
import fs from "fs-extra";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testModelLoad() {
  console.log("=".repeat(60));
  console.log("🧪 測試 TensorFlow.js 模型加載");
  console.log("=".repeat(60));

  // 測試模型路徑
  const testModelPath = path.join(
    __dirname,
    "../../food-recognition-service/test_models_tfjs/level1"
  );

  const modelJsonPath = path.join(testModelPath, "model.json");

  // 檢查模型文件
  if (!(await fs.pathExists(modelJsonPath))) {
    console.error(`❌ 模型文件不存在: ${modelJsonPath}`);
    console.log("\n💡 請先運行 Python 測試腳本生成模型：");
    console.log("   cd food-recognition-service");
    console.log("   python test_training.py");
    return false;
  }

  console.log(`\n📦 加載模型: ${modelJsonPath}`);

  try {
    // 加載模型
    const model = await tf.loadLayersModel(`file://${modelJsonPath}`);
    console.log("✅ 模型加載成功");

    // 顯示模型信息
    console.log("\n📊 模型信息：");
    console.log(`   輸入形狀: ${JSON.stringify(model.inputs[0].shape)}`);
    console.log(`   輸出形狀: ${JSON.stringify(model.outputs[0].shape)}`);
    console.log(`   層數: ${model.layers.length}`);

    // 測試推理
    console.log("\n🎯 測試推理...");
    const testInput = tf.randomNormal([1, 224, 224, 3]);
    const startTime = Date.now();
    const prediction = model.predict(testInput) as tf.Tensor;
    const endTime = Date.now();

    const predictionValue = await prediction.data();
    console.log(`✅ 推理成功（耗時: ${endTime - startTime}ms）`);
    console.log(`   預測值: ${predictionValue[0].toFixed(4)}`);

    // 清理
    testInput.dispose();
    prediction.dispose();
    model.dispose();

    console.log("\n✅ 所有測試通過！模型可以正常加載和推理。");
    return true;
  } catch (error) {
    console.error("❌ 模型加載失敗:", error);
    if (error instanceof Error) {
      console.error("   錯誤信息:", error.message);
      console.error("   堆棧:", error.stack);
    }
    return false;
  }
}

// 運行測試
testModelLoad()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("❌ 測試過程出錯:", error);
    process.exit(1);
  });

