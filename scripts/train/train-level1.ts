/**
 * 第一層模型訓練腳本
 * 訓練食物檢測模型（Food / Non-Food 二分類）
 */

import * as tf from "@tensorflow/tfjs-node-gpu"; // 或 @tensorflow/tfjs-node
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import {
  DataLoader,
  buildFoodDetectionModel,
  compileModel,
  TensorAugmentation,
} from "../../server/food-recognition/training/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 訓練配置
const config = {
  dataPath: path.join(__dirname, "../../data/level1-food-detection"),
  batchSize: 32,
  imageSize: [224, 224] as [number, number],
  epochs: 20,
  learningRate: 0.001,
  validationSplit: 0.15,
  testSplit: 0.15,
  modelSavePath: path.join(__dirname, "../../models/level1"),
  earlyStoppingPatience: 5,
};

async function trainLevel1() {
  console.log("🚀 開始訓練第一層模型（食物檢測）...");
  console.log("配置:", config);

  try {
    // 1. 檢查數據目錄
    if (!(await fs.pathExists(config.dataPath))) {
      throw new Error(`數據目錄不存在: ${config.dataPath}`);
    }

    // 2. 加載數據
    console.log("\n📂 加載數據集...");
    const dataLoader = new DataLoader();
    const { trainDataset, valDataset, testDataset, classNames, numClasses } =
      await dataLoader.loadBinaryDataset({
        dataPath: config.dataPath,
        batchSize: config.batchSize,
        imageSize: config.imageSize,
        validationSplit: config.validationSplit,
        testSplit: config.testSplit,
        shuffle: true,
      });

    console.log(`✅ 數據加載完成`);
    console.log(`   類別: ${classNames.join(", ")}`);
    console.log(`   類別數: ${numClasses}`);

    // 3. 應用數據增強
    console.log("\n🔄 應用數據增強...");
    const augmentation = new TensorAugmentation();
    const augmentedTrainDataset = augmentation.augmentDataset(trainDataset, {
      flipHorizontal: true,
      rotate: true,
      brightness: true,
      contrast: true,
    });
    console.log("✅ 數據增強完成");

    // 4. 構建模型
    console.log("\n🏗️  構建模型...");
    const model = buildFoodDetectionModel(config.imageSize);
    compileModel(model, "binary", config.learningRate);
    console.log("✅ 模型構建完成");
    model.summary();

    // 5. 訓練配置
    let bestValLoss = Infinity;
    let patienceCounter = 0;
    let bestWeights: tf.WeightsManifestEntry[] | null = null;

    // 6. 訓練模型
    console.log("\n🎯 開始訓練...");
    const history: {
      epoch: number;
      loss: number;
      acc: number;
      valLoss: number;
      valAcc: number;
    }[] = [];

    for (let epoch = 0; epoch < config.epochs; epoch++) {
      console.log(`\nEpoch ${epoch + 1}/${config.epochs}`);

      // 訓練一個 epoch
      const epochHistory = await model.fitDataset(augmentedTrainDataset, {
        epochs: 1,
        validationData: valDataset,
        callbacks: {
          onEpochEnd: async (epochNum, logs) => {
            const loss = logs?.loss as number;
            const acc = logs?.acc as number;
            const valLoss = logs?.val_loss as number;
            const valAcc = logs?.val_acc as number;

            console.log(
              `  Loss: ${loss?.toFixed(4)}, Acc: ${acc?.toFixed(4)}, ` +
                `Val Loss: ${valLoss?.toFixed(4)}, Val Acc: ${valAcc?.toFixed(4)}`
            );

            history.push({
              epoch: epochNum + 1,
              loss: loss || 0,
              acc: acc || 0,
              valLoss: valLoss || 0,
              valAcc: valAcc || 0,
            });

            // Early stopping
            if (valLoss < bestValLoss) {
              bestValLoss = valLoss;
              patienceCounter = 0;
              // 保存最佳權重
              bestWeights = await model.getWeights();
              console.log("  ✅ 找到更好的模型，保存權重");
            } else {
              patienceCounter++;
              if (patienceCounter >= config.earlyStoppingPatience) {
                console.log(
                  `  ⏹️  早停觸發（${patienceCounter} 個 epoch 無改善）`
                );
                return;
              }
            }
          },
        },
      });

      // 檢查是否應該早停
      if (patienceCounter >= config.earlyStoppingPatience) {
        break;
      }
    }

    // 7. 恢復最佳權重
    if (bestWeights) {
      console.log("\n📥 恢復最佳權重...");
      model.setWeights(bestWeights);
    }

    // 8. 評估模型
    console.log("\n📊 評估模型...");
    const testResults = await model.evaluateDataset(testDataset);
    const testLoss = (await (testResults[0] as tf.Scalar).data())[0];
    const testAcc = (await (testResults[1] as tf.Scalar).data())[0];
    console.log(`測試集 Loss: ${testLoss.toFixed(4)}`);
    console.log(`測試集 Acc: ${testAcc.toFixed(4)}`);

    // 清理評估張量
    testResults.forEach((tensor) => tensor.dispose());

    // 9. 保存模型
    console.log("\n💾 保存模型...");
    await fs.ensureDir(config.modelSavePath);
    await model.save(`file://${config.modelSavePath}`);
    console.log(`✅ 模型已保存到: ${config.modelSavePath}`);

    // 10. 保存訓練歷史
    const historyPath = path.join(config.modelSavePath, "training-history.json");
    await fs.writeJSON(historyPath, history, { spaces: 2 });
    console.log(`✅ 訓練歷史已保存到: ${historyPath}`);

    console.log("\n🎉 訓練完成！");
  } catch (error) {
    console.error("\n❌ 訓練失敗:", error);
    process.exit(1);
  }
}

// 執行訓練
trainLevel1();




