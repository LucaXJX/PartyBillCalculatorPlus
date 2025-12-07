import * as tf from "@tensorflow/tfjs-node";

/**
 * 構建第一層模型（食物檢測）
 * 二分類：Food / Non-Food
 * 使用輕量級 CNN 架構
 */
export function buildFoodDetectionModel(
  inputShape: [number, number, number] = [224, 224, 3]
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
        name: "conv1",
      }),
      tf.layers.batchNormalization({ name: "bn1" }),
      tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: "pool1" }),
      tf.layers.dropout({ rate: 0.25, name: "dropout1" }),

      // 第二組卷積塊
      tf.layers.conv2d({
        filters: 64,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
        name: "conv2",
      }),
      tf.layers.batchNormalization({ name: "bn2" }),
      tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: "pool2" }),
      tf.layers.dropout({ rate: 0.25, name: "dropout2" }),

      // 第三組卷積塊
      tf.layers.conv2d({
        filters: 128,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
        name: "conv3",
      }),
      tf.layers.batchNormalization({ name: "bn3" }),
      tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: "pool3" }),
      tf.layers.dropout({ rate: 0.25, name: "dropout3" }),

      // 展平
      tf.layers.flatten({ name: "flatten" }),

      // 全連接層
      tf.layers.dense({
        units: 512,
        activation: "relu",
        name: "dense1",
      }),
      tf.layers.batchNormalization({ name: "bn4" }),
      tf.layers.dropout({ rate: 0.5, name: "dropout4" }),

      // 輸出層（二分類）
      tf.layers.dense({
        units: 1,
        activation: "sigmoid",
        name: "output",
      }),
    ],
  });

  return model;
}

/**
 * 構建第二層模型（國家分類）
 * 多分類：識別食物的國家/地區來源
 */
export function buildCountryClassificationModel(
  numCountries: number,
  inputShape: [number, number, number] = [224, 224, 3]
): tf.Sequential {
  const model = tf.sequential({
    layers: [
      // 第一組卷積塊
      tf.layers.conv2d({
        inputShape,
        filters: 64,
        kernelSize: 7,
        strides: 2,
        activation: "relu",
        padding: "same",
        name: "conv1",
      }),
      tf.layers.batchNormalization({ name: "bn1" }),
      tf.layers.maxPooling2d({ poolSize: 3, strides: 2, name: "pool1" }),

      // 第二組卷積塊
      tf.layers.conv2d({
        filters: 128,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
        name: "conv2",
      }),
      tf.layers.batchNormalization({ name: "bn2" }),
      tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: "pool2" }),

      // 第三組卷積塊
      tf.layers.conv2d({
        filters: 256,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
        name: "conv3",
      }),
      tf.layers.batchNormalization({ name: "bn3" }),
      tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: "pool3" }),

      // 第四組卷積塊
      tf.layers.conv2d({
        filters: 512,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
        name: "conv4",
      }),
      tf.layers.batchNormalization({ name: "bn4" }),
      tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: "pool4" }),

      // 全局平均池化
      tf.layers.globalAveragePooling2d({ name: "global_avg_pool" }),

      // 全連接層
      tf.layers.dense({
        units: 512,
        activation: "relu",
        name: "dense1",
      }),
      tf.layers.batchNormalization({ name: "bn5" }),
      tf.layers.dropout({ rate: 0.5, name: "dropout1" }),

      // 輸出層（多分類）
      tf.layers.dense({
        units: numCountries,
        activation: "softmax",
        name: "output",
      }),
    ],
  });

  return model;
}

/**
 * 構建第三層模型（細粒度食物分類）
 * 多分類：識別具體的食物種類
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
        filters: 64,
        kernelSize: 7,
        strides: 2,
        activation: "relu",
        padding: "same",
        name: "conv1",
      }),
      tf.layers.batchNormalization({ name: "bn1" }),
      tf.layers.maxPooling2d({ poolSize: 3, strides: 2, name: "pool1" }),

      // 第二組卷積塊
      tf.layers.conv2d({
        filters: 128,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
        name: "conv2",
      }),
      tf.layers.batchNormalization({ name: "bn2" }),
      tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: "pool2" }),

      // 第三組卷積塊
      tf.layers.conv2d({
        filters: 256,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
        name: "conv3",
      }),
      tf.layers.batchNormalization({ name: "bn3" }),
      tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: "pool3" }),

      // 第四組卷積塊
      tf.layers.conv2d({
        filters: 512,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
        name: "conv4",
      }),
      tf.layers.batchNormalization({ name: "bn4" }),
      tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: "pool4" }),

      // 第五組卷積塊
      tf.layers.conv2d({
        filters: 512,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
        name: "conv5",
      }),
      tf.layers.batchNormalization({ name: "bn5" }),
      tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: "pool5" }),

      // 全局平均池化
      tf.layers.globalAveragePooling2d({ name: "global_avg_pool" }),

      // 全連接層
      tf.layers.dense({
        units: 1024,
        activation: "relu",
        name: "dense1",
      }),
      tf.layers.batchNormalization({ name: "bn6" }),
      tf.layers.dropout({ rate: 0.5, name: "dropout1" }),

      tf.layers.dense({
        units: 512,
        activation: "relu",
        name: "dense2",
      }),
      tf.layers.batchNormalization({ name: "bn7" }),
      tf.layers.dropout({ rate: 0.3, name: "dropout2" }),

      // 輸出層（多分類）
      tf.layers.dense({
        units: numClasses,
        activation: "softmax",
        name: "output",
      }),
    ],
  });

  return model;
}

/**
 * 編譯模型
 */
export function compileModel(
  model: tf.LayersModel,
  type: "binary" | "multiclass",
  learningRate: number = 0.001
): void {
  if (type === "binary") {
    model.compile({
      optimizer: tf.train.adam(learningRate),
      loss: "binaryCrossentropy",
      metrics: ["accuracy", "precision", "recall"],
    });
  } else {
    model.compile({
      optimizer: tf.train.adam(learningRate),
      loss: "categoricalCrossentropy",
      metrics: ["accuracy"],
    });
  }
}



