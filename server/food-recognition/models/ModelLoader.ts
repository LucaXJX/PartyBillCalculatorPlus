// 使用純 JavaScript 版本的 TensorFlow.js（不需要構建 native 模塊）
// 如果 @tensorflow/tfjs-node 構建失敗，可以使用 @tensorflow/tfjs
import * as tf from "@tensorflow/tfjs";
import path from "path";
import fs from "fs-extra";
import { fileURLToPath } from "url";

/**
 * 自定義 IOHandler：從文件系統加載模型（用於純 JavaScript 版本的 TensorFlow.js）
 */
class FileSystemIOHandler implements tf.io.IOHandler {
  private modelPath: string;
  private weightPathPrefix: string;

  constructor(modelJsonPath: string) {
    this.modelPath = modelJsonPath;
    this.weightPathPrefix = path.dirname(modelJsonPath);
  }

  async load(): Promise<tf.io.ModelArtifacts> {
    // 讀取 model.json
    const modelJson = JSON.parse(
      await fs.readFile(this.modelPath, "utf-8")
    );

    const modelFormat = modelJson.format || "layers-model";

    // 讀取權重文件
    const weightManifest = modelJson.weightsManifest || [];
    const weightData: ArrayBuffer[] = [];

    for (const manifestItem of weightManifest) {
      for (const pathItem of manifestItem.paths) {
        const weightPath = path.join(this.weightPathPrefix, pathItem);
        const weightBuffer = await fs.readFile(weightPath);
        // 確保使用正確的 ArrayBuffer（只包含實際數據）
        const arrayBuffer = weightBuffer.buffer.slice(
          weightBuffer.byteOffset,
          weightBuffer.byteOffset + weightBuffer.byteLength
        );
        weightData.push(arrayBuffer);
      }
    }

    // 構建權重映射
    const weightSpecs: tf.io.WeightsManifestEntry[] = [];

    for (const manifestItem of weightManifest) {
      for (const spec of manifestItem.weights) {
        weightSpecs.push(spec);
      }
    }

    // 處理 modelTopology：根據格式不同處理
    let modelTopology: any;
    if (modelFormat === "graph-model") {
      // Graph 格式：modelTopology 包含 node, library 等
      modelTopology = modelJson.modelTopology || modelJson;
    } else {
      // Layers 格式：modelTopology 包含 keras_version, backend, model_config, training_config
      if (modelJson.modelTopology) {
        modelTopology = modelJson.modelTopology;
        // 確保是正確的 Keras 格式
        if (!modelTopology.model_config) {
          // 如果沒有 model_config，可能是格式問題
          console.warn("⚠️  modelTopology 缺少 model_config，嘗試從根級別提取");
          const { weightsManifest, format, generatedBy, convertedBy, ...rest } = modelJson;
          if (rest.model_config) {
            modelTopology = rest;
          }
        }
      } else {
        // 如果沒有 modelTopology，嘗試從根級別提取
        const { weightsManifest, format, generatedBy, convertedBy, ...rest } = modelJson;
        modelTopology = rest;
      }
    }

    return {
      modelTopology: modelTopology,
      weightSpecs: weightSpecs,
      weightData: weightData,
      format: modelFormat,
      generatedBy: modelJson.generatedBy,
      convertedBy: modelJson.convertedBy,
      userDefinedMetadata: modelJson.userDefinedMetadata,
    };
  }
}

/**
 * 模型加載器
 * 負責加載和管理三層識別模型
 */
export class ModelLoader {
  private level1Model: tf.LayersModel | null = null;
  private level2Model: tf.LayersModel | tf.GraphModel | null = null;
  private countryModels: Map<string, tf.LayersModel | tf.GraphModel> = new Map();
  private modelsPath: string;

  constructor(modelsPath: string = "./models") {
    this.modelsPath = path.resolve(modelsPath);
  }

  /**
   * 加載第一層模型（食物檢測）
   * @param modelPath 模型路徑（相對於 modelsPath 或絕對路徑）
   */
  async loadLevel1Model(modelPath?: string): Promise<void> {
    try {
      const fullPath = modelPath
        ? path.isAbsolute(modelPath)
          ? modelPath
          : path.join(this.modelsPath, modelPath)
        : path.join(this.modelsPath, "level1");

      const modelJsonPath = path.join(fullPath, "model.json");

      if (!(await fs.pathExists(modelJsonPath))) {
        throw new Error(`模型文件不存在: ${modelJsonPath}`);
      }

      // 使用自定義 IOHandler 從文件系統加載模型
      const ioHandler = new FileSystemIOHandler(modelJsonPath);
      try {
        this.level1Model = await tf.loadLayersModel(ioHandler);
        console.log("✅ 第一層模型（食物檢測）加載成功");
      } catch (error: any) {
        console.error("❌ 第一層模型加載失敗，詳細錯誤:", error?.message || error);
        if (error?.message?.includes("className") || error?.message?.includes("config")) {
          console.error("   這可能是模型格式問題，請檢查 model.json 的結構");
        }
        throw error;
      }
    } catch (error) {
      console.error("❌ 第一層模型加載失敗:", error);
      throw error;
    }
  }

  /**
   * 加載第二層模型（國家分類）
   * @param modelPath 模型路徑
   */
  async loadLevel2Model(modelPath?: string): Promise<void> {
    try {
      const fullPath = modelPath
        ? path.isAbsolute(modelPath)
          ? modelPath
          : path.join(this.modelsPath, modelPath)
        : path.join(this.modelsPath, "level2");

      const modelJsonPath = path.join(fullPath, "model.json");

      if (!(await fs.pathExists(modelJsonPath))) {
        throw new Error(`模型文件不存在: ${modelJsonPath}`);
      }

      // 檢查模型格式
      const modelJson = JSON.parse(await fs.readFile(modelJsonPath, "utf-8"));
      const modelFormat = modelJson.format || "layers-model";
      
      // 使用自定義 IOHandler 從文件系統加載模型
      const ioHandler = new FileSystemIOHandler(modelJsonPath);
      try {
        if (modelFormat === "graph-model") {
          // Graph 格式使用 loadGraphModel
          this.level2Model = await tf.loadGraphModel(ioHandler) as any;
          console.log("✅ 第二層模型（國家分類）加載成功（Graph 格式）");
        } else {
          // Layers 格式使用 loadLayersModel
          this.level2Model = await tf.loadLayersModel(ioHandler);
          console.log("✅ 第二層模型（國家分類）加載成功（Layers 格式）");
        }
      } catch (error: any) {
        console.error("❌ 第二層模型加載失敗，詳細錯誤:", error?.message || error);
        throw error;
      }
    } catch (error) {
      console.error("❌ 第二層模型加載失敗:", error);
      throw error;
    }
  }

  /**
   * 加載第三層模型（按國家）
   * @param country 國家代碼（如 'chinese', 'japanese'）
   * @param modelPath 模型路徑
   */
  async loadCountryModel(
    country: string,
    modelPath?: string
  ): Promise<void> {
    try {
      const fullPath = modelPath
        ? path.isAbsolute(modelPath)
          ? modelPath
          : path.join(this.modelsPath, modelPath)
        : path.join(this.modelsPath, "level3", country);

      const modelJsonPath = path.join(fullPath, "model.json");

      if (!(await fs.pathExists(modelJsonPath))) {
        throw new Error(`模型文件不存在: ${modelJsonPath}`);
      }

      // 檢查模型格式
      const modelJson = JSON.parse(await fs.readFile(modelJsonPath, "utf-8"));
      const modelFormat = modelJson.format || "layers-model";
      
      // 使用自定義 IOHandler 從文件系統加載模型
      const ioHandler = new FileSystemIOHandler(modelJsonPath);
      try {
        let model: tf.LayersModel | tf.GraphModel;
        if (modelFormat === "graph-model") {
          // Graph 格式使用 loadGraphModel
          model = await tf.loadGraphModel(ioHandler) as any;
          console.log(`✅ ${country} 國家模型加載成功（Graph 格式）`);
        } else {
          // Layers 格式使用 loadLayersModel
          model = await tf.loadLayersModel(ioHandler);
          console.log(`✅ ${country} 國家模型加載成功（Layers 格式）`);
        }
        this.countryModels.set(country, model);
      } catch (error: any) {
        console.error(`❌ ${country} 國家模型加載失敗，詳細錯誤:`, error?.message || error);
        throw error;
      }
    } catch (error) {
      console.error(`❌ ${country} 國家模型加載失敗:`, error);
      throw error;
    }
  }

  /**
   * 獲取第一層模型
   */
  getLevel1Model(): tf.LayersModel {
    if (!this.level1Model) {
      throw new Error("第一層模型未加載，請先調用 loadLevel1Model()");
    }
    return this.level1Model;
  }

  /**
   * 獲取第二層模型（可能是 LayersModel 或 GraphModel）
   */
  getLevel2Model(): tf.LayersModel | tf.GraphModel {
    if (!this.level2Model) {
      throw new Error("第二層模型未加載，請先調用 loadLevel2Model()");
    }
    return this.level2Model;
  }

  /**
   * 獲取指定國家的第三層模型（可能是 LayersModel 或 GraphModel）
   */
  getCountryModel(country: string): tf.LayersModel | tf.GraphModel {
    const model = this.countryModels.get(country);
    if (!model) {
      throw new Error(
        `${country} 國家模型未加載，請先調用 loadCountryModel('${country}')`
      );
    }
    return model;
  }

  /**
   * 檢查模型是否已加載
   */
  isLevel1Loaded(): boolean {
    return this.level1Model !== null;
  }

  isLevel2Loaded(): boolean {
    return this.level2Model !== null;
  }

  isCountryLoaded(country: string): boolean {
    return this.countryModels.has(country);
  }

  /**
   * 獲取已加載的國家列表
   */
  getLoadedCountries(): string[] {
    return Array.from(this.countryModels.keys());
  }

  /**
   * 卸載所有模型（釋放內存）
   */
  dispose(): void {
    if (this.level1Model) {
      this.level1Model.dispose();
      this.level1Model = null;
    }
    if (this.level2Model) {
      this.level2Model.dispose();
      this.level2Model = null;
    }
    this.countryModels.forEach((model) => model.dispose());
    this.countryModels.clear();
    console.log("✅ 所有模型已卸載");
  }
}



