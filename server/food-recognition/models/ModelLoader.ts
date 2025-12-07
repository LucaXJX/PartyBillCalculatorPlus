// 使用純 JavaScript 版本的 TensorFlow.js（不需要構建 native 模塊）
// 如果 @tensorflow/tfjs-node 構建失敗，可以使用 @tensorflow/tfjs
import * as tf from "@tensorflow/tfjs";
import path from "path";
import fs from "fs-extra";

/**
 * 模型加載器
 * 負責加載和管理三層識別模型
 */
export class ModelLoader {
  private level1Model: tf.LayersModel | null = null;
  private level2Model: tf.LayersModel | null = null;
  private countryModels: Map<string, tf.LayersModel> = new Map();
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

      this.level1Model = await tf.loadLayersModel(`file://${modelJsonPath}`);
      console.log("✅ 第一層模型（食物檢測）加載成功");
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

      this.level2Model = await tf.loadLayersModel(`file://${modelJsonPath}`);
      console.log("✅ 第二層模型（國家分類）加載成功");
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

      const model = await tf.loadLayersModel(`file://${modelJsonPath}`);
      this.countryModels.set(country, model);
      console.log(`✅ ${country} 國家模型加載成功`);
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
   * 獲取第二層模型
   */
  getLevel2Model(): tf.LayersModel {
    if (!this.level2Model) {
      throw new Error("第二層模型未加載，請先調用 loadLevel2Model()");
    }
    return this.level2Model;
  }

  /**
   * 獲取指定國家的第三層模型
   */
  getCountryModel(country: string): tf.LayersModel {
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



