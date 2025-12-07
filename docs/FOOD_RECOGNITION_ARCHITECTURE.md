# 食物圖片識別系統架構設計

## 概述

本文檔描述基於 TensorFlow 的分層食物識別系統架構設計。系統採用三層級聯分類架構，從粗粒度到細粒度逐步識別食物圖像。

## 設計指導原則

**老師建議**：

> "最好能訓練一個新的模型，構建一些現有 AI 無法直接解決的問題。使用現有模型可以作為備選方案。"

**理解與總結**：

1. **優先目標**：訓練自定義模型

   - 不依賴現成的 API 或預訓練模型直接應用
   - 針對特定場景和需求，從零開始或基於遷移學習訓練專用模型
   - 解決現有通用 AI 模型無法直接解決的特定問題

2. **核心價值**：

   - **創新性**：構建能解決現有 AI 無法直接解決的問題的系統
   - **針對性**：針對本地食物、特定場景（如聚會賬單中的食物識別）進行優化
   - **教育意義**：通過實際訓練過程，深入理解深度學習和圖像識別

3. **備選方案**：

   - 現有模型（如百度 API、Google Vision API）作為備選或輔助方案
   - 在自訓練模型無法滿足需求時使用
   - 可用於數據標註、對比驗證等輔助用途

4. **實施策略**：
   - **主要路線**：使用 TensorFlow 訓練分層識別模型（本架構設計）
   - **輔助路線**：保留現有百度 API 作為對比和備選
   - **混合方案**：自訓練模型 + API 驗證，提高準確率和可靠性

## 技術庫清單與 Import 語句

### 核心依賴庫

#### 1. TensorFlow.js（深度學習框架）

```typescript
// CPU 版本（默認）
import * as tf from "@tensorflow/tfjs-node";

// GPU 版本（需要 CUDA 環境，性能提升 5-10 倍）
import * as tf from "@tensorflow/tfjs-node-gpu";
```

**安裝**：

```bash
pnpm add @tensorflow/tfjs-node
# 或 GPU 版本
pnpm add @tensorflow/tfjs-node-gpu
```

#### 2. 圖像處理庫

```typescript
// 高性能圖像處理（已安裝）
import sharp from "sharp";

// 可選：純 JavaScript 圖像處理（數據增強）
import Jimp from "jimp";
```

**安裝**：

```bash
# sharp 已安裝
pnpm add jimp
pnpm add -D @types/jimp
```

#### 3. 數據集管理

```typescript
// 圖像數據集加載和管理
import { Dataset } from "image-dataset";
```

**安裝**：

```bash
pnpm add image-dataset
```

#### 4. 文件系統與工具

```typescript
// 增強的文件系統操作
import fs from "fs-extra";
import path from "path";
```

**安裝**：

```bash
pnpm add fs-extra
pnpm add -D @types/fs-extra
```

#### 5. 緩存與隊列（可選）

```typescript
// 結果緩存
import NodeCache from "node-cache";

// 異步隊列管理
import PQueue from "p-queue";
```

**安裝**：

```bash
pnpm add node-cache p-queue
pnpm add -D @types/node-cache
```

#### 6. 模型轉換工具（開發依賴）

```typescript
// 用於將 Python 訓練的模型轉換為 TensorFlow.js 格式
// 使用命令行工具，無需 import
```

**安裝**：

```bash
pnpm add -D @tensorflow/tfjs-converter
```

### 完整 package.json 依賴示例

```json
{
  "dependencies": {
    "@tensorflow/tfjs-node": "^4.22.0",
    "@tensorflow/tfjs-node-gpu": "^4.22.0",
    "sharp": "^0.34.5",
    "jimp": "^0.22.10",
    "fs-extra": "^11.2.0",
    "image-dataset": "^1.0.0",
    "node-cache": "^5.1.2",
    "p-queue": "^8.0.1"
  },
  "devDependencies": {
    "@tensorflow/tfjs-converter": "^4.22.0",
    "@types/jimp": "^0.2.28",
    "@types/fs-extra": "^11.0.4",
    "@types/node-cache": "^4.2.5"
  }
}
```

### 典型文件結構與 Import

```typescript
// server/food-recognition/models/ModelLoader.ts
import * as tf from "@tensorflow/tfjs-node-gpu"; // 或 @tensorflow/tfjs-node
import path from "path";
import fs from "fs-extra";

// server/food-recognition/models/ImagePreprocessor.ts
import * as tf from "@tensorflow/tfjs-node";
import sharp from "sharp";

// server/food-recognition/models/RecognitionPipeline.ts
import * as tf from "@tensorflow/tfjs-node";
import { ModelLoader } from "./ModelLoader.js";
import { ImagePreprocessor } from "./ImagePreprocessor.js";
import { proxy } from "../../proxy.js";

// scripts/train/train-level1.ts
import * as tf from "@tensorflow/tfjs-node-gpu";
import { DataLoader } from "./data-loader.js";
import { buildFoodDetectionModel } from "./model-builder.js";
import path from "path";
```

### GPU 環境要求

如果使用 `@tensorflow/tfjs-node-gpu`，需要：

1. **NVIDIA GPU**（支持 CUDA）
2. **CUDA Toolkit 11.2+**
3. **cuDNN 8.1+**
4. **Node.js 16+**

檢查 GPU 是否可用：

```typescript
import * as tf from "@tensorflow/tfjs-node-gpu";

console.log("後端:", tf.getBackend()); // 應輸出 'tensorflow'
console.log("GPU 設備:", tf.engine().backend); // 應顯示 GPU 信息
```

---

## 架構設計原則

1. **分層識別**：採用級聯分類器，逐層細化識別結果
2. **遷移學習**：利用預訓練模型（如 ResNet、EfficientNet）作為特徵提取器
3. **模塊化設計**：每層模型獨立訓練和部署，便於維護和優化
4. **性能優化**：早期拒絕非食物圖像，減少計算資源消耗
5. **Node.js 優先**：所有實現基於 Node.js/TypeScript，無需 Python 微服務

---

## 三層識別架構

### 第一層：食物檢測（Food Detection）

**目標**：判斷輸入圖像是否包含食物

**任務類型**：二分類（Food / Non-Food）

**設計要點**：

- **輸入**：原始圖像（224x224 或 256x256）
- **輸出**：`{is_food: true/false, confidence: 0.0-1.0}`
- **模型架構**：輕量級 CNN（如 MobileNetV2）或 ResNet18
- **數據集要求**：
  - 正樣本：各種食物圖像（10,000+ 張）
  - 負樣本：非食物圖像（人物、風景、物品等，10,000+ 張）
- **性能目標**：準確率 > 95%，推理時間 < 50ms

**數據集來源**：

- Food-101 數據集（提取食物類別）
- ImageNet 數據集（提取非食物類別）
- 自建數據集（補充本地食物場景）

**模型選擇建議**：

```typescript
// 使用 MobileNetV2 作為基礎模型（輕量級，適合快速推理）
// 注意：TensorFlow.js 需要先轉換預訓練模型，或從頭構建

import * as tf from "@tensorflow/tfjs-node";

// 方案 1：加載預轉換的 MobileNetV2 模型
async function loadMobileNetV2() {
  // 需要先使用 tfjs-converter 將 Keras MobileNetV2 轉換為 TensorFlow.js 格式
  const model = await tf.loadLayersModel(
    "https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/feature_vector/3/default/1"
  );
  return model;
}

// 方案 2：構建類似的輕量級模型
function buildLightweightModel(): tf.Sequential {
  return tf.sequential({
    layers: [
      tf.layers.conv2d({
        inputShape: [224, 224, 3],
        filters: 32,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
      }),
      tf.layers.depthwiseConv2d({
        kernelSize: 3,
        activation: "relu",
        padding: "same",
      }),
      tf.layers.maxPooling2d({ poolSize: 2 }),
      // ... 更多層
      tf.layers.globalAveragePooling2d(),
      tf.layers.dense({ units: 1, activation: "sigmoid" }),
    ],
  });
}
```

---

### 第二層：國家/地區識別（Cuisine Classification）

**目標**：識別食物的國家或地區來源

**任務類型**：多分類（約 10-20 個主要國家/地區）

**設計要點**：

- **輸入**：通過第一層驗證的食物圖像
- **輸出**：`{country: "中國", confidence: 0.85, alternatives: [...]}`
- **分類類別**（建議）：
  - 中國（Chinese）
  - 日本（Japanese）
  - 韓國（Korean）
  - 泰國（Thai）
  - 印度（Indian）
  - 意大利（Italian）
  - 法國（French）
  - 墨西哥（Mexican）
  - 美國（American）
  - 其他（Others）
- **模型架構**：ResNet50 或 EfficientNet-B2
- **數據集要求**：每個國家/地區至少 5,000 張圖像
- **性能目標**：Top-1 準確率 > 80%，Top-3 準確率 > 90%

**數據集來源**：

- **ChineseFoodNet**：18 萬張中國菜品圖像，208 種菜品
- **Food-101**：101 類食物，可根據國家標註
- **UECFOOD-256**：256 類日本食物
- **自建數據集**：本地餐廳圖片、用戶上傳圖片

**模型選擇建議**：

```typescript
// 使用 ResNet50 進行遷移學習
// 需要先轉換預訓練模型，或構建類似架構

import * as tf from "@tensorflow/tfjs-node";

// 方案 1：加載預轉換的 ResNet50 模型
async function loadResNet50() {
  // 從 TensorFlow Hub 或轉換後的模型加載
  const baseModel = await tf.loadLayersModel("path/to/resnet50/model.json");

  // 添加自定義分類頭
  const x = baseModel.getLayer("global_average_pooling2d").output;
  const dense1 = tf.layers.dense({ units: 512, activation: "relu" }).apply(x);
  const dropout = tf.layers.dropout({ rate: 0.5 }).apply(dense1);
  const predictions = tf.layers
    .dense({
      units: 10, // 10 個國家
      activation: "softmax",
    })
    .apply(dropout);

  return tf.model({ inputs: baseModel.input, outputs: predictions });
}

// 方案 2：構建 ResNet 風格的模型
function buildResNetStyleModel(numCountries: number): tf.Sequential {
  return tf.sequential({
    layers: [
      // ResNet 風格的殘差塊
      tf.layers.conv2d({
        inputShape: [224, 224, 3],
        filters: 64,
        kernelSize: 7,
        strides: 2,
        activation: "relu",
        padding: "same",
      }),
      tf.layers.maxPooling2d({ poolSize: 3, strides: 2 }),
      // ... 更多殘差塊
      tf.layers.globalAveragePooling2d(),
      tf.layers.dense({ units: 512, activation: "relu" }),
      tf.layers.dropout({ rate: 0.5 }),
      tf.layers.dense({ units: numCountries, activation: "softmax" }),
    ],
  });
}
```

---

### 第三層：細粒度食物識別（Fine-grained Food Classification）

**目標**：識別具體的食物種類

**任務類型**：細粒度多分類（100-500 類）

**設計要點**：

- **輸入**：通過前兩層驗證的食物圖像 + 國家/地區信息
- **輸出**：`{food_name: "宮保雞丁", country: "中國", confidence: 0.92, calories: 280, ...}`
- **分類策略**：
  - **方案 A（推薦）**：為每個國家/地區訓練專用模型
    - 中國食物模型：識別 200+ 種中國菜品
    - 日本食物模型：識別 100+ 種日本料理
    - 其他國家模型：依數據量決定
  - **方案 B**：單一大型模型，包含所有食物類別（500+ 類）
- **模型架構**：ResNet101、EfficientNet-B4 或 Vision Transformer
- **數據集要求**：每種食物至少 500 張圖像
- **性能目標**：Top-1 準確率 > 75%，Top-5 準確率 > 90%

**數據集來源**：

- **ChineseFoodNet**：208 種中國菜品（18 萬張圖像）
- **Food-101**：101 類國際食物
- **UECFOOD-256**：256 類日本食物
- **自建數據集**：本地特色菜品

**模型選擇建議**：

```typescript
// 針對中國食物的專用模型
// 使用 EfficientNet-B4 風格或類似架構

import * as tf from "@tensorflow/tfjs-node";

// 方案 1：加載預轉換的 EfficientNet-B4 模型
async function loadEfficientNetB4() {
  // 需要先轉換預訓練模型
  const baseModel = await tf.loadLayersModel(
    "path/to/efficientnet-b4/model.json"
  );

  // 添加細粒度分類頭
  const x = baseModel.getLayer("global_average_pooling2d").output;
  const dense1 = tf.layers.dense({ units: 1024, activation: "relu" }).apply(x);
  const bn1 = tf.layers.batchNormalization().apply(dense1);
  const dropout1 = tf.layers.dropout({ rate: 0.5 }).apply(bn1);
  const dense2 = tf.layers
    .dense({ units: 512, activation: "relu" })
    .apply(dropout1);
  const predictions = tf.layers
    .dense({
      units: 208, // 208 種中國菜品
      activation: "softmax",
    })
    .apply(dense2);

  return tf.model({ inputs: baseModel.input, outputs: predictions });
}

// 方案 2：構建 EfficientNet 風格的模型（已在 model-builder.ts 中實現）
function buildEfficientNetStyleModel(numClasses: number): tf.Sequential {
  // 參見 buildFineGrainedModel 函數實現
  // 使用深度可分離卷積和注意力機制
}
```

---

## 數據集設計

### 數據集結構

```
food-recognition-dataset/
├── level1-food-detection/
│   ├── food/
│   │   ├── class1/
│   │   ├── class2/
│   │   └── ...
│   └── non-food/
│       ├── people/
│       ├── scenery/
│       └── objects/
│
├── level2-country-classification/
│   ├── chinese/
│   ├── japanese/
│   ├── korean/
│   ├── thai/
│   └── ...
│
└── level3-fine-grained/
    ├── chinese/
    │   ├── 宮保雞丁/
    │   ├── 麻婆豆腐/
    │   └── ...
    ├── japanese/
    │   ├── 壽司/
    │   ├── 拉麵/
    │   └── ...
    └── ...
```

### 數據集統計建議

| 層級   | 類別數  | 每類樣本數 | 總樣本數 | 訓練/驗證/測試比例 |
| ------ | ------- | ---------- | -------- | ------------------ |
| 第一層 | 2       | 10,000+    | 20,000+  | 70/15/15           |
| 第二層 | 10-20   | 5,000+     | 50,000+  | 70/15/15           |
| 第三層 | 200-500 | 500+       | 100,000+ | 70/15/15           |

### 數據增強策略（Node.js）

#### 使用 sharp 進行圖像增強

```typescript
// scripts/train/augmentation.ts
import sharp from "sharp";

export class DataAugmentation {
  /**
   * 應用完整的數據增強管道
   */
  async augmentImage(
    buffer: Buffer,
    options?: {
      rotation?: number; // 旋轉角度範圍（±30度）
      flip?: boolean; // 是否水平翻轉
      brightness?: [number, number]; // 亮度範圍 [0.8, 1.2]
      zoom?: [number, number]; // 縮放範圍 [0.8, 1.2]
    }
  ): Promise<Buffer> {
    let augmented = buffer;

    // 隨機旋轉（±30度）
    if (options?.rotation !== undefined) {
      const angle = (Math.random() - 0.5) * (options.rotation * 2);
      augmented = await sharp(augmented).rotate(angle).toBuffer();
    }

    // 隨機水平翻轉（50% 概率）
    if (options?.flip && Math.random() > 0.5) {
      augmented = await sharp(augmented).flip().toBuffer();
    }

    // 隨機亮度調整
    if (options?.brightness) {
      const [min, max] = options.brightness;
      const brightness = min + Math.random() * (max - min);
      augmented = await sharp(augmented).modulate({ brightness }).toBuffer();
    }

    // 隨機縮放（通過裁剪和調整大小實現）
    if (options?.zoom) {
      const [minZoom, maxZoom] = options.zoom;
      const zoom = minZoom + Math.random() * (maxZoom - minZoom);
      const metadata = await sharp(augmented).metadata();
      const newWidth = Math.floor((metadata.width || 224) * zoom);
      const newHeight = Math.floor((metadata.height || 224) * zoom);
      augmented = await sharp(augmented)
        .resize(newWidth, newHeight)
        .resize(metadata.width || 224, metadata.height || 224, { fit: "fill" })
        .toBuffer();
    }

    return augmented;
  }

  /**
   * 批量增強圖像
   */
  async augmentBatch(
    images: Buffer[],
    augmentationFactor: number = 2
  ): Promise<Buffer[]> {
    const augmented: Buffer[] = [];

    for (const image of images) {
      // 原始圖像
      augmented.push(image);

      // 生成增強版本
      for (let i = 0; i < augmentationFactor; i++) {
        const aug = await this.augmentImage(image, {
          rotation: 30,
          flip: true,
          brightness: [0.8, 1.2],
          zoom: [0.8, 1.2],
        });
        augmented.push(aug);
      }
    }

    return augmented;
  }
}
```

#### 使用 TensorFlow.js 進行張量級增強

```typescript
import * as tf from '@tensorflow/tfjs-node';

/**
 * 在張量層面進行數據增強（更高效）
 */
export function augmentTensor(imageTensor: tf.Tensor4D): tf.Tensor4D {
  let augmented = imageTensor;

  // 隨機水平翻轉
  if (Math.random() > 0.5) {
    augmented = tf.image.flipLeftRight(augmented);
  }

  // 隨機旋轉（通過轉置和翻轉實現）
  if (Math.random() > 0.5) {
    const k = Math.floor(Math.random() * 4);
    augmented = tf.image.rot90(augmented, k);
  }

  // 隨機亮度調整
  if (Math.random() > 0.5) {
    const delta = (Math.random() - 0.5) * 0.2; // ±0.1
    augmented = tf.image.adjustBrightness(augmented, delta);
  }

  // 隨機對比度調整
  if (Math.random() > 0.5) {
    const factor = 0.8 + Math.random() * 0.4; // 0.8 到 1.2
    augmented = tf.image.adjustContrast(augmented, factor);
  }

  return augmented;
}

/**
 * 在數據管道中應用增強
 */
export function createAugmentedDataset(
  baseDataset: tf.data.Dataset<{ xs: tf.Tensor4D; ys: tf.Tensor }
): tf.data.Dataset<{ xs: tf.Tensor4D; ys: tf.Tensor }> {
  return baseDataset.map((item) => ({
    xs: augmentTensor(item.xs),
    ys: item.ys,
  }));
}
```

#### 完整的數據增強配置

```typescript
// 訓練時的數據增強配置
const augmentationConfig = {
  rotation: 30, // 旋轉 ±30 度
  flip: true, // 水平翻轉
  brightness: [0.8, 1.2], // 亮度調整範圍
  zoom: [0.8, 1.2], // 縮放範圍
  contrast: [0.8, 1.2], // 對比度範圍
  saturation: [0.8, 1.2], // 飽和度範圍
};

// 在數據加載時應用
const augmentedDataset = createAugmentedDataset(trainDataset);
```

---

## 模型訓練流程

### 訓練環境設置

#### 使用 GPU 訓練（推薦）

```bash
# 安裝 GPU 版本
pnpm add @tensorflow/tfjs-node-gpu

# 檢查 GPU 是否可用
node -e "require('@tensorflow/tfjs-node-gpu'); console.log('GPU 可用')"
```

#### 訓練腳本結構

```
scripts/
├── train/
│   ├── train-level1.ts      # 第一層模型訓練
│   ├── train-level2.ts      # 第二層模型訓練
│   ├── train-level3.ts      # 第三層模型訓練
│   ├── data-loader.ts       # 數據加載工具
│   └── model-builder.ts     # 模型構建工具
```

### 階段 1：第一層模型訓練（Node.js/TypeScript）

```typescript
// scripts/train/train-level1.ts
import * as tf from "@tensorflow/tfjs-node-gpu"; // 或 @tensorflow/tfjs-node
import { DataLoader } from "./data-loader.js";
import { buildFoodDetectionModel } from "./model-builder.js";
import path from "path";

async function trainLevel1() {
  console.log("🚀 開始訓練第一層模型（食物檢測）...");

  // 1. 準備數據
  const dataLoader = new DataLoader();
  const { trainDataset, valDataset } = await dataLoader.loadFoodDetectionData({
    dataPath: "./data/level1-food-detection",
    batchSize: 32,
    imageSize: [224, 224],
  });

  // 2. 構建模型
  const model = buildFoodDetectionModel();
  console.log("✅ 模型構建完成");

  // 3. 編譯模型
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: "binaryCrossentropy",
    metrics: ["accuracy", "precision", "recall"],
  });

  // 4. 訓練模型
  const history = await model.fitDataset(trainDataset, {
    epochs: 20,
    validationData: valDataset,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(
          `Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(
            4
          )}, acc=${logs?.acc?.toFixed(4)}`
        );
      },
    },
  });

  // 5. 保存模型
  const savePath = path.resolve("./models/level1");
  await model.save(`file://${savePath}`);
  console.log(`✅ 模型已保存到: ${savePath}`);

  return model;
}

// 執行訓練
trainLevel1().catch(console.error);
```

```typescript
// scripts/train/model-builder.ts
import * as tf from "@tensorflow/tfjs-node";

/**
 * 構建第一層模型（食物檢測）
 */
export function buildFoodDetectionModel(): tf.Sequential {
  // 使用 MobileNetV2 作為基礎模型（遷移學習）
  const baseModel = tf.sequential({
    layers: [
      // 這裡需要加載預訓練的 MobileNetV2 權重
      // 或使用 tf.loadLayersModel() 加載預訓練模型
      tf.layers.dense({ units: 1, activation: "sigmoid" }),
    ],
  });

  // 或者構建自定義模型
  const model = tf.sequential({
    layers: [
      tf.layers.conv2d({
        inputShape: [224, 224, 3],
        filters: 32,
        kernelSize: 3,
        activation: "relu",
      }),
      tf.layers.maxPooling2d({ poolSize: 2 }),
      tf.layers.conv2d({ filters: 64, kernelSize: 3, activation: "relu" }),
      tf.layers.maxPooling2d({ poolSize: 2 }),
      tf.layers.conv2d({ filters: 128, kernelSize: 3, activation: "relu" }),
      tf.layers.maxPooling2d({ poolSize: 2 }),
      tf.layers.flatten(),
      tf.layers.dense({ units: 512, activation: "relu" }),
      tf.layers.dropout({ rate: 0.5 }),
      tf.layers.dense({ units: 1, activation: "sigmoid" }),
    ],
  });

  return model;
}

/**
 * 構建第二層模型（國家分類）
 */
export function buildCountryClassificationModel(
  numCountries: number
): tf.Sequential {
  const model = tf.sequential({
    layers: [
      tf.layers.conv2d({
        inputShape: [224, 224, 3],
        filters: 64,
        kernelSize: 3,
        activation: "relu",
      }),
      tf.layers.maxPooling2d({ poolSize: 2 }),
      tf.layers.conv2d({ filters: 128, kernelSize: 3, activation: "relu" }),
      tf.layers.maxPooling2d({ poolSize: 2 }),
      tf.layers.conv2d({ filters: 256, kernelSize: 3, activation: "relu" }),
      tf.layers.maxPooling2d({ poolSize: 2 }),
      tf.layers.flatten(),
      tf.layers.dense({ units: 512, activation: "relu" }),
      tf.layers.dropout({ rate: 0.5 }),
      tf.layers.dense({ units: numCountries, activation: "softmax" }),
    ],
  });

  return model;
}
```

```typescript
// scripts/train/data-loader.ts
import * as tf from "@tensorflow/tfjs-node";
import { Dataset } from "image-dataset";
import sharp from "sharp";
import fs from "fs-extra";
import path from "path";

export class DataLoader {
  /**
   * 加載食物檢測數據集
   */
  async loadFoodDetectionData(options: {
    dataPath: string;
    batchSize: number;
    imageSize: [number, number];
  }): Promise<{ trainDataset: tf.data.Dataset; valDataset: tf.data.Dataset }> {
    const { dataPath, batchSize, imageSize } = options;

    // 使用 image-dataset 加載數據
    const dataset = new Dataset({
      path: dataPath,
      imageSize,
    });

    // 劃分訓練集和驗證集
    const trainData = await this.loadImagesFromDirectory(
      path.join(dataPath, "train"),
      imageSize
    );
    const valData = await this.loadImagesFromDirectory(
      path.join(dataPath, "val"),
      imageSize
    );

    // 轉換為 TensorFlow.js Dataset
    const trainDataset = tf.data
      .array(trainData)
      .map((item: any) => ({
        xs: item.image,
        ys: item.label,
      }))
      .batch(batchSize);

    const valDataset = tf.data
      .array(valData)
      .map((item: any) => ({
        xs: item.image,
        ys: item.label,
      }))
      .batch(batchSize);

    return { trainDataset, valDataset };
  }

  /**
   * 從目錄加載圖像
   */
  private async loadImagesFromDirectory(
    dirPath: string,
    imageSize: [number, number]
  ): Promise<any[]> {
    const files = await fs.readdir(dirPath);
    const images = [];

    for (const file of files) {
      if (!/\.(jpg|jpeg|png)$/i.test(file)) continue;

      const filePath = path.join(dirPath, file);
      const buffer = await fs.readFile(filePath);
      const resized = await sharp(buffer)
        .resize(imageSize[0], imageSize[1])
        .raw()
        .toBuffer();

      // 轉換為張量
      const tensor = tf.node.decodeImage(buffer);
      const normalized = tensor.div(255.0);

      images.push({
        image: normalized,
        label: this.getLabelFromPath(filePath),
      });
    }

    return images;
  }

  private getLabelFromPath(filePath: string): number {
    // 根據文件路徑確定標籤
    // food/ -> 1, non-food/ -> 0
    return filePath.includes("food") ? 1 : 0;
  }
}
```

### 階段 2：第二層模型訓練

```typescript
// scripts/train/train-level2.ts
import * as tf from "@tensorflow/tfjs-node-gpu";
import { DataLoader } from "./data-loader.js";
import { buildCountryClassificationModel } from "./model-builder.js";

async function trainLevel2() {
  console.log("🚀 開始訓練第二層模型（國家分類）...");

  const dataLoader = new DataLoader();
  const { trainDataset, valDataset } = await dataLoader.loadCountryData({
    dataPath: "./data/level2-country-classification",
    batchSize: 32,
    imageSize: [224, 224],
  });

  const model = buildCountryClassificationModel(10); // 10 個國家

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });

  await model.fitDataset(trainDataset, {
    epochs: 30,
    validationData: valDataset,
  });

  await model.save("file://./models/level2");
  console.log("✅ 第二層模型訓練完成");
}
```

### 階段 3：第三層模型訓練（按國家分別訓練）

```typescript
// scripts/train/train-level3.ts
import * as tf from "@tensorflow/tfjs-node-gpu";
import { DataLoader } from "./data-loader.js";
import { buildFineGrainedModel } from "./model-builder.js";

const countries = ["chinese", "japanese", "korean", "thai", "indian"];

async function trainLevel3() {
  for (const country of countries) {
    console.log(`🚀 開始訓練 ${country} 國家模型...`);

    const dataLoader = new DataLoader();
    const { trainDataset, valDataset } = await dataLoader.loadFineGrainedData({
      dataPath: `./data/level3-fine-grained/${country}`,
      batchSize: 16,
      imageSize: [380, 380],
    });

    // 獲取該國家的食物類別數量
    const numClasses = await dataLoader.getNumClasses(country);
    const model = buildFineGrainedModel(numClasses);

    model.compile({
      optimizer: tf.train.adam(0.0001),
      loss: "categoricalCrossentropy",
      metrics: ["accuracy", "top5Accuracy"],
    });

    await model.fitDataset(trainDataset, {
      epochs: 50,
      validationData: valDataset,
    });

    await model.save(`file://./models/level3/${country}`);
    console.log(`✅ ${country} 國家模型訓練完成`);
  }
}
```

---

## 推理流程設計

### 級聯推理流程（Node.js/TypeScript）

完整的推理流程已在「部署架構」部分的 `RecognitionPipeline.ts` 中實現。以下是關鍵要點：

#### 推理流程圖

```
輸入圖像 (Buffer)
    ↓
圖像預處理 (sharp + tf.node.decodeImage)
    ↓
第一層：食物檢測 (MobileNetV2)
    ├─ 非食物 → 返回 {is_food: false}
    └─ 是食物 → 繼續
    ↓
第二層：國家分類 (ResNet50)
    ├─ 置信度 < 0.3 → 返回 {country: 'unknown'}
    └─ 置信度 ≥ 0.3 → 繼續
    ↓
第三層：細粒度識別 (EfficientNet-B4, 按國家)
    ↓
查詢數據庫獲取食物信息
    ↓
返回完整識別結果
```

#### 關鍵實現細節

```typescript
// server/food-recognition/models/RecognitionPipeline.ts (關鍵部分)

async recognizeFoodImage(imageBuffer: Buffer): Promise<RecognitionResult> {
  // 1. 預處理圖像
  const imageTensor = await this.preprocessor.preprocessImage(imageBuffer, [224, 224]);

  // 2. 第一層：食物檢測
  const level1Model = this.modelLoader.getLevel1Model();
  const level1Prediction = level1Model.predict(imageTensor) as tf.Tensor;
  const foodProbability = (await level1Prediction.data())[0];

  // 早期拒絕：非食物圖像直接返回
  if (foodProbability <= 0.5) {
    imageTensor.dispose();
    level1Prediction.dispose();
    return { is_food: false, confidence: 1 - foodProbability };
  }

  // 3. 第二層：國家識別
  const level2Model = this.modelLoader.getLevel2Model();
  const level2Prediction = level2Model.predict(imageTensor) as tf.Tensor;
  // ... 處理國家分類結果

  // 4. 第三層：細粒度識別
  const countryModel = this.modelLoader.getCountryModel(country);
  const level3Prediction = countryModel.predict(imageTensor) as tf.Tensor;
  // ... 處理食物分類結果

  // 5. 清理張量（重要：避免內存洩漏）
  imageTensor.dispose();
  level1Prediction.dispose();
  level2Prediction.dispose();
  level3Prediction.dispose();

  return result;
}
```

### 性能優化策略

#### 1. 早期拒絕（Early Rejection）

第一層模型快速過濾非食物圖像，減少後續計算：

```typescript
// 如果第一層置信度低於閾值，立即返回
if (foodProbability < 0.5) {
  return { is_food: false, message: "未檢測到食物" };
}
```

#### 2. 模型量化（Model Quantization）

使用 TensorFlow.js 的量化工具減少模型大小和推理時間：

```typescript
// scripts/quantize-model.ts
import * as tf from "@tensorflow/tfjs-node";

async function quantizeModel(modelPath: string, outputPath: string) {
  // 加載模型
  const model = await tf.loadLayersModel(`file://${modelPath}/model.json`);

  // 量化模型（INT8）
  // 注意：TensorFlow.js 的量化需要在訓練時設置，或使用轉換工具
  // 可以使用 tfjs-converter 進行量化轉換

  // 保存量化模型
  await model.save(`file://${outputPath}`);
}
```

#### 3. 批量推理（Batch Inference）

對多張圖片進行批量處理，提高 GPU 利用率：

```typescript
async recognizeBatch(imageBuffers: Buffer[]): Promise<RecognitionResult[]> {
  // 批量預處理
  const imageTensors = await this.preprocessor.preprocessBatch(
    imageBuffers,
    [224, 224]
  );

  // 批量推理
  const predictions = await this.model.predict(imageTensors);

  // 處理結果
  const results = await this.processBatchResults(predictions);

  // 清理
  imageTensors.dispose();
  predictions.dispose();

  return results;
}
```

#### 4. 緩存機制（Caching）

對常見食物進行結果緩存：

```typescript
import NodeCache from "node-cache";

export class RecognitionCache {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({ stdTTL: 3600 }); // 1 小時過期
  }

  async getCachedResult(imageHash: string): Promise<RecognitionResult | null> {
    return this.cache.get(imageHash) || null;
  }

  setCachedResult(imageHash: string, result: RecognitionResult): void {
    this.cache.set(imageHash, result);
  }

  // 使用圖像哈希作為緩存鍵
  private async hashImage(buffer: Buffer): Promise<string> {
    const crypto = await import("crypto");
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }
}
```

#### 5. GPU 加速

使用 `@tensorflow/tfjs-node-gpu` 進行 GPU 推理：

```typescript
// 在模型加載時使用 GPU 版本
import * as tf from "@tensorflow/tfjs-node-gpu";

// 檢查 GPU 是否可用
console.log("GPU 後端:", tf.getBackend());
// 輸出: 'tensorflow' (GPU) 或 'cpu' (CPU)
```

#### 6. 異步推理隊列

使用隊列處理大量並發請求：

```typescript
import PQueue from "p-queue";

export class RecognitionQueue {
  private queue: PQueue;

  constructor() {
    // 限制並發數，避免 GPU 內存溢出
    this.queue = new PQueue({ concurrency: 2 });
  }

  async add(imageBuffer: Buffer): Promise<RecognitionResult> {
    return this.queue.add(() =>
      this.recognitionPipeline.recognizeFoodImage(imageBuffer)
    );
  }
}
```

### 性能監控

```typescript
import { performance } from 'perf_hooks';

async recognizeWithMetrics(imageBuffer: Buffer): Promise<RecognitionResult & { metrics: any }> {
  const start = performance.now();

  // 第一層推理時間
  const level1Start = performance.now();
  const level1Result = await this.level1Inference(imageBuffer);
  const level1Time = performance.now() - level1Start;

  // 第二層推理時間
  const level2Start = performance.now();
  const level2Result = await this.level2Inference(imageBuffer);
  const level2Time = performance.now() - level2Start;

  // 第三層推理時間
  const level3Start = performance.now();
  const level3Result = await this.level3Inference(imageBuffer);
  const level3Time = performance.now() - level3Start;

  const totalTime = performance.now() - start;

  return {
    ...level3Result,
    metrics: {
      total_time_ms: totalTime,
      level1_time_ms: level1Time,
      level2_time_ms: level2Time,
      level3_time_ms: level3Time,
    },
  };
}
```

---

## 技術棧選擇

### 核心技術路線：Node.js + TensorFlow.js

本項目採用 **Node.js 生態系統**，使用 **TensorFlow.js for Node.js** 進行模型訓練和推理，支持 GPU 加速。

### 深度學習框架（Node.js）

#### 主要框架

- **`@tensorflow/tfjs-node`**：TensorFlow.js 的 Node.js 版本，支持 CPU 推理
- **`@tensorflow/tfjs-node-gpu`**：TensorFlow.js 的 Node.js GPU 版本（需要 CUDA 和 cuDNN）
  - **GPU 要求**：NVIDIA GPU + CUDA 11.2+ + cuDNN 8.1+
  - **性能提升**：相比 CPU 版本，推理速度可提升 5-10 倍

#### 模型格式與轉換

- **模型格式**：TensorFlow.js 模型（`.json` + `.bin` 文件）或 TensorFlow SavedModel
- **模型轉換**：使用 `tfjs-converter` 將 Python 訓練的 Keras 模型轉換為 TensorFlow.js 格式
- **模型加載**：使用 `tf.loadLayersModel()` 或 `tf.loadGraphModel()` 加載模型

#### 安裝依賴

```bash
# CPU 版本（默認）
pnpm add @tensorflow/tfjs-node

# GPU 版本（需要 CUDA 環境）
pnpm add @tensorflow/tfjs-node-gpu

# 模型轉換工具（用於將 Python 訓練的模型轉換為 TensorFlow.js）
pnpm add -D @tensorflow/tfjs-converter
```

### 圖像處理庫（Node.js）

#### 核心圖像處理

- **`sharp`**：高性能圖像處理庫（已安裝）
  - 圖像縮放、裁剪、格式轉換
  - 支持 JPEG、PNG、WebP 等格式
  - 性能優異，使用 libvips

#### 圖像數據增強（可選）

- **`jimp`**：純 JavaScript 圖像處理庫
  - 旋轉、翻轉、亮度調整等
  - 適合數據增強操作

#### 安裝依賴

```bash
# sharp 已安裝，如需數據增強可添加
pnpm add jimp
pnpm add -D @types/jimp
```

### 數據處理與工具庫

#### 數據集管理

- **`image-dataset`**：圖像數據集管理工具（已安裝）
  - 數據集加載、預處理、批處理
  - 支持數據增強管道

#### 文件系統與路徑

- **`fs-extra`**：增強的文件系統操作
  - 遞歸目錄操作、文件複製等

#### 安裝依賴

```bash
pnpm add fs-extra
pnpm add -D @types/fs-extra
```

### 預訓練模型選擇

| 層級   | 推薦模型        | 輸入尺寸 | 參數量 | 推理時間（CPU） | 推理時間（GPU） |
| ------ | --------------- | -------- | ------ | --------------- | --------------- |
| 第一層 | MobileNetV2     | 224x224  | 3.4M   | ~20ms           | ~5ms            |
| 第二層 | ResNet50        | 224x224  | 25.6M  | ~80ms           | ~15ms           |
| 第三層 | EfficientNet-B4 | 380x380  | 19M    | ~150ms          | ~30ms           |

### 開發與調試工具

- **數據可視化**：`chart.js` 或 `plotly.js`（用於訓練曲線可視化）
- **日誌記錄**：`winston` 或 `pino`（結構化日誌）
- **性能監控**：Node.js 內建 `perf_hooks` 或 `clinic.js`
- **模型管理**：自定義版本管理系統（基於文件系統或數據庫）

### 完整依賴列表

```json
{
  "dependencies": {
    "@tensorflow/tfjs-node": "^4.22.0",
    "@tensorflow/tfjs-node-gpu": "^4.22.0", // 可選，需要 GPU
    "sharp": "^0.34.5", // 已安裝
    "jimp": "^0.22.10", // 可選，數據增強
    "fs-extra": "^11.2.0",
    "image-dataset": "^1.0.0" // 已安裝
  },
  "devDependencies": {
    "@tensorflow/tfjs-converter": "^4.22.0", // 模型轉換工具
    "@types/jimp": "^0.2.28",
    "@types/fs-extra": "^11.0.4"
  }
}
```

---

## 數據庫設計

### 食物信息表（food_info）

```sql
CREATE TABLE food_info (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    country VARCHAR(50) NOT NULL,
    category VARCHAR(100),           -- 菜品類別（主菜、湯品、甜品等）
    calories INTEGER,                -- 卡路里（每100g）
    protein DECIMAL(5,2),            -- 蛋白質（g）
    fat DECIMAL(5,2),                -- 脂肪（g）
    carbs DECIMAL(5,2),              -- 碳水化合物（g）
    ingredients TEXT,                -- 主要食材（JSON）
    description TEXT,                -- 描述
    image_url VARCHAR(512),          -- 示例圖片URL
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_food_country ON food_info(country);
CREATE INDEX idx_food_name ON food_info(name);
```

### 模型版本管理表（model_versions）

```sql
CREATE TABLE model_versions (
    id INTEGER PRIMARY KEY,
    level INTEGER NOT NULL,          -- 1, 2, 3
    country VARCHAR(50),             -- 第三層模型需要
    version VARCHAR(50) NOT NULL,
    model_path VARCHAR(512) NOT NULL,
    accuracy DECIMAL(5,2),           -- 驗證集準確率
    training_date DATE,
    is_active BOOLEAN DEFAULT 0,
    created_at TIMESTAMP
);
```

---

## 部署架構

### 服務架構（Node.js 統一架構）

```
┌─────────────┐
│  前端應用   │
└──────┬──────┘
       │ HTTP/HTTPS
       ▼
┌─────────────────────────────────┐
│      Node.js 後端服務           │
│  (Express API + TensorFlow.js)  │
│                                 │
│  ┌───────────────────────────┐ │
│  │   Express 路由層          │ │
│  │   - /api/food/recognize   │ │
│  │   - /api/food/images      │ │
│  └───────────┬───────────────┘ │
│              │                  │
│  ┌───────────▼───────────────┐ │
│  │   TensorFlow.js 推理層    │ │
│  │   - 模型加載與管理        │ │
│  │   - 圖像預處理            │ │
│  │   - 三層級聯推理          │ │
│  └───────────┬───────────────┘ │
│              │                  │
│  ┌───────────▼───────────────┐ │
│  │   數據庫層                │ │
│  │   - 食物信息查詢          │ │
│  │   - 識別結果存儲          │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
       │
       ▼
┌─────────────────┐
│   模型存儲      │
│  (文件系統)     │
│  - models/      │
│    - level1/    │
│    - level2/    │
│    - level3/    │
└─────────────────┘
```

### Node.js 推理服務實現

#### 核心模塊結構

```
server/
├── food-recognition/
│   ├── models/
│   │   ├── ModelLoader.ts      # 模型加載器
│   │   ├── ImagePreprocessor.ts # 圖像預處理
│   │   └── RecognitionPipeline.ts # 三層推理管道
│   ├── training/
│   │   ├── DataLoader.ts       # 數據加載
│   │   ├── Trainer.ts          # 模型訓練
│   │   └── Augmentation.ts    # 數據增強
│   └── index.ts                  # 導出接口
```

#### TypeScript 實現示例

```typescript
// server/food-recognition/models/ModelLoader.ts
import * as tf from "@tensorflow/tfjs-node";
// 或使用 GPU 版本：
// import * as tf from '@tensorflow/tfjs-node-gpu';
import path from "path";
import fs from "fs-extra";

export class ModelLoader {
  private level1Model: tf.LayersModel | null = null;
  private level2Model: tf.LayersModel | null = null;
  private countryModels: Map<string, tf.LayersModel> = new Map();

  /**
   * 加載第一層模型（食物檢測）
   */
  async loadLevel1Model(modelPath: string): Promise<void> {
    const fullPath = path.resolve(modelPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`模型文件不存在: ${fullPath}`);
    }
    this.level1Model = await tf.loadLayersModel(
      `file://${fullPath}/model.json`
    );
    console.log("✅ 第一層模型加載成功");
  }

  /**
   * 加載第二層模型（國家分類）
   */
  async loadLevel2Model(modelPath: string): Promise<void> {
    const fullPath = path.resolve(modelPath);
    this.level2Model = await tf.loadLayersModel(
      `file://${fullPath}/model.json`
    );
    console.log("✅ 第二層模型加載成功");
  }

  /**
   * 加載第三層模型（按國家）
   */
  async loadCountryModel(country: string, modelPath: string): Promise<void> {
    const fullPath = path.resolve(modelPath);
    const model = await tf.loadLayersModel(`file://${fullPath}/model.json`);
    this.countryModels.set(country, model);
    console.log(`✅ ${country} 國家模型加載成功`);
  }

  getLevel1Model(): tf.LayersModel {
    if (!this.level1Model) {
      throw new Error("第一層模型未加載");
    }
    return this.level1Model;
  }

  getLevel2Model(): tf.LayersModel {
    if (!this.level2Model) {
      throw new Error("第二層模型未加載");
    }
    return this.level2Model;
  }

  getCountryModel(country: string): tf.LayersModel {
    const model = this.countryModels.get(country);
    if (!model) {
      throw new Error(`${country} 國家模型未加載`);
    }
    return model;
  }
}
```

```typescript
// server/food-recognition/models/ImagePreprocessor.ts
import * as tf from "@tensorflow/tfjs-node";
import sharp from "sharp";
import { Readable } from "stream";

export class ImagePreprocessor {
  /**
   * 將圖像預處理為模型輸入格式
   * @param imageBuffer 圖像緩衝區
   * @param targetSize 目標尺寸 [width, height]
   * @returns 預處理後的張量
   */
  async preprocessImage(
    imageBuffer: Buffer,
    targetSize: [number, number] = [224, 224]
  ): Promise<tf.Tensor4D> {
    // 使用 sharp 進行圖像處理
    const resizedBuffer = await sharp(imageBuffer)
      .resize(targetSize[0], targetSize[1], {
        fit: "fill",
        background: { r: 0, g: 0, b: 0 },
      })
      .toFormat("raw")
      .toBuffer();

    // 轉換為張量
    const imageTensor = tf.node.decodeImage(imageBuffer);
    const resized = tf.image.resizeBilinear(imageTensor, targetSize);
    const normalized = resized.div(255.0); // 歸一化到 [0, 1]
    const batched = normalized.expandDims(0); // 添加批次維度

    // 清理中間張量
    imageTensor.dispose();
    resized.dispose();
    normalized.dispose();

    return batched as tf.Tensor4D;
  }

  /**
   * 批量預處理圖像
   */
  async preprocessBatch(
    imageBuffers: Buffer[],
    targetSize: [number, number] = [224, 224]
  ): Promise<tf.Tensor4D> {
    const preprocessed = await Promise.all(
      imageBuffers.map((buf) => this.preprocessImage(buf, targetSize))
    );
    return tf.concat(preprocessed, 0);
  }
}
```

```typescript
// server/food-recognition/models/RecognitionPipeline.ts
import * as tf from "@tensorflow/tfjs-node";
import { ModelLoader } from "./ModelLoader.js";
import { ImagePreprocessor } from "./ImagePreprocessor.js";
import { proxy } from "../../proxy.js";

export interface RecognitionResult {
  is_food: boolean;
  confidence?: number;
  country?: string;
  country_confidence?: number;
  food_name?: string;
  food_confidence?: number;
  calories?: number;
  ingredients?: string[];
  overall_confidence?: number;
  message?: string;
}

export class RecognitionPipeline {
  private modelLoader: ModelLoader;
  private preprocessor: ImagePreprocessor;

  constructor(modelLoader: ModelLoader, preprocessor: ImagePreprocessor) {
    this.modelLoader = modelLoader;
    this.preprocessor = preprocessor;
  }

  /**
   * 三層級聯識別流程
   */
  async recognizeFoodImage(imageBuffer: Buffer): Promise<RecognitionResult> {
    try {
      // 預處理圖像
      const imageTensor = await this.preprocessor.preprocessImage(
        imageBuffer,
        [224, 224]
      );

      // 第一層：食物檢測
      const level1Model = this.modelLoader.getLevel1Model();
      const level1Prediction = level1Model.predict(imageTensor) as tf.Tensor;
      const foodProbability = (await level1Prediction.data())[0];
      const isFood = foodProbability > 0.5;

      level1Prediction.dispose();

      if (!isFood) {
        imageTensor.dispose();
        return {
          is_food: false,
          confidence: 1 - foodProbability,
          message: "圖像中未檢測到食物",
        };
      }

      // 第二層：國家識別
      const level2Model = this.modelLoader.getLevel2Model();
      const level2Prediction = level2Model.predict(imageTensor) as tf.Tensor;
      const countryProbabilities = await level2Prediction.data();
      const countryIndex = Array.from(countryProbabilities).indexOf(
        Math.max(...Array.from(countryProbabilities))
      );
      const countryConfidence = countryProbabilities[countryIndex];

      const countries = [
        "chinese",
        "japanese",
        "korean",
        "thai",
        "indian",
        "italian",
        "french",
        "mexican",
        "american",
        "others",
      ];
      const country = countries[countryIndex] || "unknown";

      level2Prediction.dispose();

      if (countryConfidence < 0.3) {
        imageTensor.dispose();
        return {
          is_food: true,
          country: "unknown",
          confidence: countryConfidence,
          message: "無法識別食物來源國家",
        };
      }

      // 第三層：細粒度識別（根據國家選擇對應模型）
      const countryModel = this.modelLoader.getCountryModel(country);
      const level3Prediction = countryModel.predict(imageTensor) as tf.Tensor;
      const foodProbabilities = await level3Prediction.data();
      const foodIndex = Array.from(foodProbabilities).indexOf(
        Math.max(...Array.from(foodProbabilities))
      );
      const foodConfidence = foodProbabilities[foodIndex];

      level3Prediction.dispose();
      imageTensor.dispose();

      // 從數據庫獲取食物詳細信息
      const foodInfo = await this.getFoodInfo(country, foodIndex);

      return {
        is_food: true,
        country,
        country_confidence: countryConfidence,
        food_name: foodInfo?.name,
        food_confidence: foodConfidence,
        calories: foodInfo?.calories,
        ingredients: foodInfo?.ingredients,
        overall_confidence: foodConfidence * countryConfidence,
      };
    } catch (error) {
      console.error("識別過程出錯:", error);
      throw error;
    }
  }

  /**
   * 從數據庫獲取食物信息
   */
  private async getFoodInfo(country: string, foodIndex: number): Promise<any> {
    // 這裡需要根據實際的數據庫結構查詢
    // 假設有 food_info 表
    const foods = proxy.food_info?.filter((f) => f.country === country) || [];
    if (foods.length > foodIndex) {
      return foods[foodIndex];
    }
    return null;
  }
}
```

#### Express API 路由集成

```typescript
// server/server.ts (部分代碼)
import { ModelLoader } from "./food-recognition/models/ModelLoader.js";
import { ImagePreprocessor } from "./food-recognition/models/ImagePreprocessor.js";
import { RecognitionPipeline } from "./food-recognition/models/RecognitionPipeline.js";

// 初始化模型加載器和推理管道
const modelLoader = new ModelLoader();
const preprocessor = new ImagePreprocessor();
const recognitionPipeline = new RecognitionPipeline(modelLoader, preprocessor);

// 啟動時加載模型
async function initializeModels() {
  try {
    await modelLoader.loadLevel1Model("./models/level1");
    await modelLoader.loadLevel2Model("./models/level2");
    await modelLoader.loadCountryModel("chinese", "./models/level3/chinese");
    await modelLoader.loadCountryModel("japanese", "./models/level3/japanese");
    // ... 加載其他國家模型
    console.log("✅ 所有模型加載完成");
  } catch (error) {
    console.error("❌ 模型加載失敗:", error);
  }
}

// API 路由：食物識別
app.post(
  "/api/food/recognize",
  authenticateUser,
  upload.single("image"),
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "未提供圖像文件" });
      }

      const imageBuffer = req.file.buffer;
      const result = await recognitionPipeline.recognizeFoodImage(imageBuffer);

      res.json(result);
    } catch (error) {
      console.error("識別錯誤:", error);
      res.status(500).json({ error: "識別失敗" });
    }
  }
);

// 啟動服務器時初始化模型
initializeModels();
```

---

## 訓練計劃

### Phase 1：數據準備（2-3 週）

1. **數據收集**

   - 下載公開數據集（Food-101、ChineseFoodNet 等）
   - 收集本地餐廳圖片
   - 用戶上傳圖片標註

2. **數據清洗**

   - 去除重複圖片
   - 質量檢查（模糊、過暗等）
   - 標註驗證

3. **數據劃分**
   - 訓練集（70%）
   - 驗證集（15%）
   - 測試集（15%）

### Phase 2：第一層模型訓練（1-2 週）

1. 構建食物檢測模型
2. 訓練和調優
3. 評估和部署

### Phase 3：第二層模型訓練（2-3 週）

1. 構建國家分類模型
2. 訓練和調優
3. 評估和部署

### Phase 4：第三層模型訓練（4-6 週）

1. 為主要國家（中國、日本）訓練模型
2. 逐步擴展到其他國家
3. 持續優化和迭代

### Phase 5：集成與優化（2-3 週）

1. 三層模型集成
2. 性能優化
3. 生產環境部署

---

## 評估指標

### 第一層（二分類）

- **準確率（Accuracy）**：> 95%
- **精確率（Precision）**：> 95%
- **召回率（Recall）**：> 95%
- **F1 分數**：> 0.95
- **推理時間**：< 50ms（CPU）

### 第二層（多分類）

- **Top-1 準確率**：> 80%
- **Top-3 準確率**：> 90%
- **混淆矩陣分析**：識別易混淆的國家
- **推理時間**：< 100ms（CPU）

### 第三層（細粒度分類）

- **Top-1 準確率**：> 75%
- **Top-5 準確率**：> 90%
- **每類平均準確率**：> 70%
- **推理時間**：< 200ms（CPU）

---

## 挑戰與解決方案

### 挑戰 1：數據不平衡

**問題**：某些食物類別樣本數量遠少於其他類別

**解決方案**：

- 數據增強（針對少樣本類別）
- 類別權重調整
- 過採樣（SMOTE）或欠採樣
- 焦點損失（Focal Loss）

### 挑戰 2：細粒度分類難度

**問題**：相似食物難以區分（如不同種類的壽司）

**解決方案**：

- 使用更深的網絡（ResNet101、EfficientNet-B4）
- 注意力機制（Attention）
- 多尺度特徵融合
- 集成學習

### 挑戰 3：計算資源限制

**問題**：模型推理需要較多計算資源

**解決方案**：

- 模型量化（INT8）
- 模型剪枝
- 知識蒸餾（使用小模型）
- 異步推理（隊列處理）

### 挑戰 4：新食物類別識別

**問題**：未見過的食物無法識別

**解決方案**：

- 零樣本學習（Zero-shot Learning）
- 少樣本學習（Few-shot Learning）
- 持續學習（Continual Learning）
- 用戶反饋機制（標註新食物）

---

## 參考資料

### 學術論文

1. **ChineseFoodNet**: "ChineseFoodNet: A Large-scale Image Dataset for Chinese Food Recognition" (arXiv:1705.02743)
2. **DeepFood**: "DeepFood: Deep Learning-Based Food Image Recognition for Computer-Aided Dietary Assessment" (arXiv:1606.05675)
3. **Res-VMamba**: "Res-VMamba: Fine-grained Food Classification using Selective State Space Models" (arXiv:2402.15761)
4. **GCAM**: "Gaussian and Causal Attention Mechanism for Fine-grained Food Recognition" (arXiv:2403.12109)

### 數據集

- **Food-101**: https://www.vision.ee.ethz.ch/datasets_extra/food-101/
- **ChineseFoodNet**: https://github.com/liuziwei7/food-recognition
- **UECFOOD-256**: http://foodcam.mobi/
- **Vireo Food-172**: http://vireo.cs.cityu.edu.hk/research/food/

### 工具與框架

- **TensorFlow**: https://www.tensorflow.org/
- **Keras**: https://keras.io/
- **TensorFlow Lite**: https://www.tensorflow.org/lite
- **Albumentations**: https://albumentations.ai/ (數據增強)

---

## 附錄：代碼示例

### 完整的模型構建示例（Node.js/TypeScript）

```typescript
// scripts/train/model-builder.ts
import * as tf from "@tensorflow/tfjs-node-gpu";

/**
 * 構建細粒度食物分類模型（第三層）
 * 使用類似 EfficientNet 的架構
 */
export function buildFineGrainedModel(
  numClasses: number,
  inputShape: [number, number, number] = [380, 380, 3]
): tf.Sequential {
  const model = tf.sequential({
    layers: [
      // 第一組卷積塊
      tf.layers.conv2d({
        inputShape,
        filters: 32,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
      }),
      tf.layers.batchNormalization(),
      tf.layers.maxPooling2d({ poolSize: 2 }),

      // 第二組卷積塊
      tf.layers.conv2d({
        filters: 64,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
      }),
      tf.layers.batchNormalization(),
      tf.layers.maxPooling2d({ poolSize: 2 }),

      // 第三組卷積塊
      tf.layers.conv2d({
        filters: 128,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
      }),
      tf.layers.batchNormalization(),
      tf.layers.maxPooling2d({ poolSize: 2 }),

      // 第四組卷積塊
      tf.layers.conv2d({
        filters: 256,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
      }),
      tf.layers.batchNormalization(),
      tf.layers.maxPooling2d({ poolSize: 2 }),

      // 全局平均池化
      tf.layers.globalAveragePooling2d(),

      // 分類頭
      tf.layers.dense({ units: 1024, activation: "relu" }),
      tf.layers.batchNormalization(),
      tf.layers.dropout({ rate: 0.5 }),
      tf.layers.dense({ units: 512, activation: "relu" }),
      tf.layers.batchNormalization(),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({ units: numClasses, activation: "softmax" }),
    ],
  });

  return model;
}

// 編譯模型
const model = buildFineGrainedModel(208); // 208 種中國菜品
model.compile({
  optimizer: tf.train.adam(0.0001),
  loss: "categoricalCrossentropy",
  metrics: ["accuracy"],
});

// 自定義 Top-5 準確率指標
const top5Accuracy = {
  f: (yTrue: tf.Tensor, yPred: tf.Tensor) => {
    const top5 = tf.topk(yPred, 5);
    const indices = top5.indices;
    const values = top5.values;
    // 計算 Top-5 準確率邏輯
    return tf.mean(tf.cast(tf.greater(values, 0.5), "float32"));
  },
  n: "top5Accuracy",
};
```

### 數據增強實現（Node.js）

```typescript
// scripts/train/augmentation.ts
import * as tf from "@tensorflow/tfjs-node";
import sharp from "sharp";

export class ImageAugmentation {
  /**
   * 隨機旋轉圖像
   */
  async rotateImage(buffer: Buffer, angle: number): Promise<Buffer> {
    return await sharp(buffer).rotate(angle).toBuffer();
  }

  /**
   * 隨機水平翻轉
   */
  async flipHorizontal(buffer: Buffer): Promise<Buffer> {
    return await sharp(buffer).flip().toBuffer();
  }

  /**
   * 調整亮度
   */
  async adjustBrightness(buffer: Buffer, factor: number): Promise<Buffer> {
    return await sharp(buffer).modulate({ brightness: factor }).toBuffer();
  }

  /**
   * 隨機裁剪和縮放
   */
  async randomCropAndResize(
    buffer: Buffer,
    targetSize: [number, number]
  ): Promise<Buffer> {
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 224;
    const height = metadata.height || 224;

    // 隨機裁剪區域
    const cropSize = Math.min(width, height);
    const x = Math.floor(Math.random() * (width - cropSize));
    const y = Math.floor(Math.random() * (height - cropSize));

    return await sharp(buffer)
      .extract({ left: x, top: y, width: cropSize, height: cropSize })
      .resize(targetSize[0], targetSize[1])
      .toBuffer();
  }

  /**
   * 應用隨機增強
   */
  async applyRandomAugmentation(buffer: Buffer): Promise<Buffer> {
    let augmented = buffer;

    // 50% 概率水平翻轉
    if (Math.random() > 0.5) {
      augmented = await this.flipHorizontal(augmented);
    }

    // 隨機旋轉 ±30 度
    if (Math.random() > 0.5) {
      const angle = (Math.random() - 0.5) * 60; // -30 到 +30 度
      augmented = await this.rotateImage(augmented, angle);
    }

    // 隨機亮度調整
    if (Math.random() > 0.5) {
      const brightness = 0.8 + Math.random() * 0.4; // 0.8 到 1.2
      augmented = await this.adjustBrightness(augmented, brightness);
    }

    return augmented;
  }
}

// 在數據加載時應用增強
export async function augmentDataset(
  images: Buffer[],
  labels: number[]
): Promise<{ images: Buffer[]; labels: number[] }> {
  const augmentation = new ImageAugmentation();
  const augmentedImages: Buffer[] = [];
  const augmentedLabels: number[] = [];

  for (let i = 0; i < images.length; i++) {
    // 原始圖像
    augmentedImages.push(images[i]);
    augmentedLabels.push(labels[i]);

    // 增強後的圖像
    const augmented = await augmentation.applyRandomAugmentation(images[i]);
    augmentedImages.push(augmented);
    augmentedLabels.push(labels[i]);
  }

  return { images: augmentedImages, labels: augmentedLabels };
}
```

### 完整的訓練腳本示例

```typescript
// scripts/train/train-complete.ts
import * as tf from "@tensorflow/tfjs-node-gpu";
import { buildFineGrainedModel } from "./model-builder.js";
import { DataLoader } from "./data-loader.js";
import { augmentDataset } from "./augmentation.js";
import path from "path";

async function trainComplete() {
  console.log("🚀 開始完整訓練流程...");

  // 1. 準備數據
  const dataLoader = new DataLoader();
  const trainData = await dataLoader.loadFineGrainedData({
    dataPath: "./data/level3-fine-grained/chinese",
    batchSize: 16,
    imageSize: [380, 380],
  });

  // 2. 數據增強
  const augmentedData = await augmentDataset(
    trainData.images,
    trainData.labels
  );

  // 3. 構建模型
  const model = buildFineGrainedModel(208); // 208 種中國菜品

  // 4. 編譯模型
  model.compile({
    optimizer: tf.train.adam(0.0001),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });

  // 5. 訓練配置
  const epochs = 50;
  let bestValAccuracy = 0;
  let patience = 10;
  let patienceCounter = 0;

  // 6. 訓練循環
  for (let epoch = 0; epoch < epochs; epoch++) {
    console.log(`\nEpoch ${epoch + 1}/${epochs}`);

    // 訓練一個 epoch
    const history = await model.fitDataset(trainData.dataset, {
      epochs: 1,
      validationData: trainData.valDataset,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          const valAcc = logs?.val_acc as number;
          console.log(
            `  Loss: ${logs?.loss?.toFixed(4)}, Acc: ${logs?.acc?.toFixed(
              4
            )}, ` +
              `Val Loss: ${logs?.val_loss?.toFixed(
                4
              )}, Val Acc: ${valAcc?.toFixed(4)}`
          );

          // Early stopping
          if (valAcc > bestValAccuracy) {
            bestValAccuracy = valAcc;
            patienceCounter = 0;
            // 保存最佳模型
            await model.save(`file://./models/level3/chinese/best`);
          } else {
            patienceCounter++;
            if (patienceCounter >= patience) {
              console.log("⏹️  早停觸發，訓練結束");
              return;
            }
          }
        },
      },
    });
  }

  // 7. 保存最終模型
  await model.save(`file://./models/level3/chinese/final`);
  console.log("✅ 訓練完成！");
}

// 執行訓練
trainComplete().catch(console.error);
```

### 模型轉換工具（Python → TensorFlow.js）

如果需要使用 Python 訓練模型，然後轉換為 TensorFlow.js 格式：

```bash
# 安裝轉換工具
pnpm add -D @tensorflow/tfjs-converter

# 轉換 Keras 模型
tensorflowjs_converter \
  --input_format=keras \
  --output_format=tfjs_layers_model \
  ./models/level1_food_detection.h5 \
  ./models/level1/

# 轉換 SavedModel
tensorflowjs_converter \
  --input_format=tf_saved_model \
  --output_format=tfjs_graph_model \
  ./models/saved_model \
  ./models/tfjs_model/
```

```typescript
// 在 Node.js 中加載轉換後的模型
import * as tf from "@tensorflow/tfjs-node";

const model = await tf.loadLayersModel("file://./models/level1/model.json");
```

---

## 總結

本架構設計採用三層級聯分類策略，從粗粒度到細粒度逐步識別食物圖像。通過合理的模型選擇、數據集設計和訓練策略，可以構建一個高效、準確的食物識別系統。

**關鍵成功因素**：

1. 高質量的數據集（數量充足、標註準確）
2. 合適的模型架構（平衡準確率和效率）
3. 充分的數據增強和正則化
4. 持續的模型優化和迭代

**下一步行動**：

1. 開始數據收集和標註工作
2. 搭建訓練環境（GPU 服務器或雲端）
3. 實現第一層模型（食物檢測）
4. 逐步擴展到第二層和第三層

---

## 實作 TODO 列表

### Phase 1: 基礎設施搭建

- [x] **TODO-1**: 安裝必要的依賴包

  - `@tensorflow/tfjs-node` 或 `@tensorflow/tfjs-node-gpu`
  - `fs-extra`
  - `image-dataset`
  - `node-cache`（可選，用於緩存）
  - `p-queue`（可選，用於隊列管理）

- [x] **TODO-2**: 創建基礎目錄結構
  - `server/food-recognition/models/` - 模型相關模塊 ✅
  - `server/food-recognition/training/` - 訓練相關模塊 ✅
  - `scripts/train/` - 訓練腳本 ✅
  - `scripts/data-collection/` - 數據收集腳本 ✅
  - `models/level1/`, `models/level2/`, `models/level3/` - 模型存儲目錄 ✅

### Phase 2: 核心模塊實現

- [x] **TODO-3**: 實現 `ImagePreprocessor.ts`

  - 圖像預處理（縮放、歸一化）✅
  - 批量預處理支持 ✅
  - 與 sharp 集成 ✅

- [x] **TODO-4**: 實現 `ModelLoader.ts`

  - 模型加載和緩存 ✅
  - 支持三層模型加載 ✅
  - 錯誤處理和日誌記錄 ✅

- [x] **TODO-5**: 實現 `RecognitionPipeline.ts`
  - 三層級聯推理流程 ✅
  - 早期拒絕機制 ✅
  - 結果整合和格式化 ✅

### Phase 3: API 集成

- [x] **TODO-6**: 在 `server.ts` 中集成食物識別 API
  - `POST /api/food/recognize-tfjs` - 單圖識別（TensorFlow.js）
  - `POST /api/food/recognize-tfjs-batch` - 批量識別
  - `GET /api/food/models/status` - 獲取模型加載狀態
  - 與現有認證系統集成
  - 模型自動初始化（服務器啟動時）

### Phase 4: 訓練基礎設施

- [x] **TODO-7**: 實現 `DataLoader.ts`

  - 從文件系統加載圖像數據集
  - 數據劃分（訓練/驗證/測試）
  - 批量數據生成
  - 支持分類和二分類數據集
  - 數據集統計信息

- [x] **TODO-8**: 實現 `model-builder.ts`

  - 第一層模型構建（食物檢測）- 輕量級 CNN
  - 第二層模型構建（國家分類）- ResNet 風格
  - 第三層模型構建（細粒度分類）- 深度 CNN
  - 模型編譯功能

- [x] **TODO-9**: 實現 `augmentation.ts`
  - 圖像增強功能（旋轉、翻轉、亮度、飽和度等）
  - 批量增強支持
  - TensorFlow.js 張量級增強（更高效）
  - 兩種增強方式：sharp（文件級）和 TensorFlow.js（張量級）

### Phase 5: 訓練腳本

- [x] **TODO-10**: 創建訓練腳本
  - `scripts/train/train-level1.ts` - 第一層模型訓練（二分類）
  - `scripts/train/train-level2.ts` - 第二層模型訓練（多分類）
  - `scripts/train/train-level3.ts` - 第三層模型訓練（細粒度，按國家）
  - 訓練配置和參數管理
  - Early stopping 機制
  - 訓練歷史記錄
  - 模型評估和保存
  - 已添加到 `package.json` 腳本：`train:level1`, `train:level2`, `train:level3`

### Phase 6: 數據庫與模型管理

- [ ] **TODO-11**: 更新數據庫 schema

  - 創建 `food_info` 表（存儲食物詳細信息：名稱、卡路里、食材等）
  - 創建 `model_versions` 表（追蹤模型版本和性能指標）
  - 數據遷移腳本
  - 與現有 `better-sqlite3-proxy` 集成

- [ ] **TODO-12**: 實現模型版本管理
  - 模型版本追蹤（版本號、訓練日期、準確率等）
  - 模型切換和回滾（支持切換到不同版本的模型）
  - 性能指標記錄（準確率、推理時間等）
  - API 端點：`GET /api/food/models/versions`, `POST /api/food/models/switch`

### Phase 7: 測試與優化

- [x] **TODO-13**: 創建測試頁面（功能測試）
  - ✅ 測試頁面：`food-recognition-test.html`
  - ✅ API 連接測試
  - ✅ 模型狀態查詢
  - ✅ 圖像預處理測試
  - ✅ 推理流程測試
  - ✅ 數據統計（只讀，不影響數據庫）
  - ✅ 系統健康檢查
  - ✅ 訪問地址：`http://localhost:3000/food-recognition-test.html`

- [ ] **TODO-14**: 單元測試（代碼級測試）

  - 圖像預處理單元測試
  - 模型加載單元測試
  - 推理流程單元測試

- [ ] **TODO-15**: 性能優化

  - GPU 加速驗證
  - 緩存機制實現
  - 批量推理優化

- [ ] **TODO-16**: 文檔完善
  - API 文檔
  - 使用示例
  - 部署指南

---

**當前進度**: Phase 5 + 數據收集完成 ✅

**已完成階段**:

- ✅ Phase 1: 基礎設施搭建
- ✅ Phase 2: 核心模塊實現
- ✅ Phase 3: API 集成
- ✅ Phase 4: 訓練基礎設施
- ✅ Phase 5: 訓練腳本
- ✅ 數據收集：下載和組織腳本、圖片預處理

**未完成階段**:

- ⏳ Phase 6: 數據庫與模型管理（2 個 TODO）
- ⏳ Phase 7: 測試與優化（3 個 TODO）

---

## 下一步實作計劃

### 優先級 1：數據庫 Schema（Phase 6 - TODO-11）

**目標**：創建數據庫表來存儲食物信息和模型版本

**需要實作**：

1. **food_info 表**
   ```sql
   CREATE TABLE food_info (
     id INTEGER PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     name_en VARCHAR(255),
     country VARCHAR(50) NOT NULL,
     category VARCHAR(100),
     calories INTEGER,
     protein DECIMAL(5,2),
     fat DECIMAL(5,2),
     carbs DECIMAL(5,2),
     ingredients TEXT,
     description TEXT,
     created_at TIMESTAMP,
     updated_at TIMESTAMP
   );
   ```

2. **model_versions 表**
   ```sql
   CREATE TABLE model_versions (
     id INTEGER PRIMARY KEY,
     level INTEGER NOT NULL,
     country VARCHAR(50),
     version VARCHAR(50) NOT NULL,
     model_path VARCHAR(512) NOT NULL,
     accuracy DECIMAL(5,2),
     training_date DATE,
     is_active BOOLEAN DEFAULT 0,
     created_at TIMESTAMP
   );
   ```

3. **數據遷移腳本**
   - 使用現有的 `knex` 遷移系統
   - 更新 `erd.txt` 和生成 proxy

### 優先級 2：模型版本管理（Phase 6 - TODO-12）

**目標**：實現模型版本追蹤和管理功能

**需要實作**：

1. **ModelVersionManager 類**
   - 記錄模型版本信息
   - 切換活動模型
   - 查詢版本歷史

2. **API 端點**
   - `GET /api/food/models/versions` - 獲取所有版本
   - `POST /api/food/models/switch` - 切換模型版本
   - `GET /api/food/models/current` - 獲取當前活動模型

### 優先級 3：性能優化（Phase 7 - TODO-14）

**目標**：優化推理性能

**需要實作**：

1. **緩存機制**
   - 使用 `node-cache` 緩存識別結果
   - 基於圖片哈希的緩存鍵

2. **批量推理優化**
   - 改進批量處理邏輯
   - GPU 加速驗證

### 優先級 4：測試（Phase 7 - TODO-13）

**目標**：確保系統穩定性

**需要實作**：

1. **單元測試**
   - 圖像預處理測試
   - 模型加載測試
   - 推理流程測試

### 優先級 5：文檔（Phase 7 - TODO-15）

**目標**：完善使用文檔

**需要實作**：

1. **API 文檔**
2. **使用示例**
3. **部署指南**

---

## 總結

**已完成**：12/17 個 TODO（70.6%）

**待完成**：5 個 TODO
- 數據庫 Schema（2 個）
- 測試與優化（3 個）

**建議下一步**：優先完成 Phase 6（數據庫與模型管理），這樣系統才能完整存儲和查詢食物信息。
