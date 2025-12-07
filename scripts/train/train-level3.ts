/**
 * 第三層模型訓練腳本
 * 訓練細粒度食物分類模型（按國家分別訓練）
 * 
 * 使用方法：
 *   node --loader ts-node/esm scripts/train/train-level3.ts chinese
 *   node --loader ts-node/esm scripts/train/train-level3.ts japanese
 */

import * as tf from "@tensorflow/tfjs-node-gpu"; // 或 @tensorflow/tfjs-node
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import {
  DataLoader,
  buildFineGrainedModel,
  compileModel,
  TensorAugmentation,
} from "../../server/food-recognition/training/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 從命令行參數獲取國家
const country = process.argv[2] || "chinese";

// 訓練配置
const config = {
  dataPath: path.join(
    __dirname,
    "../../data/level3-fine-grained",
    country
  ),
  batchSize: 16, // 細粒度分類使用較小的批次
  imageSize: [380, 380] as [number, number], // 更大的輸入尺寸
  epochs: 50,
  learningRate: 0.0001, // 更小的學習率
  validationSplit: 0.15,
  testSplit: 0.15,
  modelSavePath: path.join(__dirname, "../../models/level3", country),
  earlyStoppingPatience: 10,
};

async function trainLevel3() {
  console.log(`🚀 開始訓練第三層模型（${country} 國家細粒度分類）...`);
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
      await dataLoader.loadClassificationDataset({
        dataPath: config.dataPath,
        batchSize: config.batchSize,
        imageSize: config.imageSize,
        validationSplit: config.validationSplit,
        testSplit: config.testSplit,
        shuffle: true,
      });

    console.log(`✅ 數據加載完成`);
    console.log(`   類別數: ${numClasses}`);
    console.log(`   前 10 個類別: ${classNames.slice(0, 10).join(", ")}`);

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
    const model = buildFineGrainedModel(numClasses, [
      ...config.imageSize,
      3,
    ] as [number, number, number]);
    compileModel(model, "multiclass", config.learningRate);
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

    testResults.forEach((tensor) => tensor.dispose());

    // 9. 保存模型
    console.log("\n💾 保存模型...");
    await fs.ensureDir(config.modelSavePath);
    await model.save(`file://${config.modelSavePath}`);
    console.log(`✅ 模型已保存到: ${config.modelSavePath}`);

    // 10. 保存類別映射和訓練歷史
    const classMapPath = path.join(config.modelSavePath, "class-names.json");
    await fs.writeJSON(classMapPath, classNames, { spaces: 2 });
    console.log(`✅ 類別映射已保存到: ${classMapPath}`);

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
trainLevel3();




