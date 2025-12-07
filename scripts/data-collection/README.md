# 數據收集與組織

## 概述

本目錄包含數據收集和組織相關的腳本，使用免費、可靠的公開數據集（如 Food-101）來獲取訓練數據。

## 下載和組織訓練數據

### 自動下載和組織

```bash
pnpm run data:download
```

這個腳本會：

1. 下載 Food-101 數據集（101 種食物，共 101,000 張圖像）
2. **自動預處理所有圖片**：
   - 調整大小到目標尺寸（第一層/第二層：224×224，第三層：380×380）
   - 統一轉換為 JPEG 格式
   - 優化壓縮（使用 mozjpeg）
   - **處理後自動刪除原始圖片**（節省空間）
3. 組織第一層數據（食物檢測）：從 Food-101 提取食物圖像
4. 組織第二層數據（國家分類）：按國家映射 Food-101 類別
5. 組織第三層數據（細粒度分類）：按具體食物類別組織

### 數據來源

- **Food-101**: https://www.vision.ee.ethz.ch/datasets_extra/food-101/
  - 101 種食物類別
  - 每個類別 1000 張圖像（750 訓練 + 250 測試）
  - 總計 101,000 張圖像

### 手動下載（如果自動下載失敗）

如果自動下載失敗，請手動下載：

1. 訪問 https://www.vision.ee.ethz.ch/datasets_extra/food-101/
2. 下載 `food-101.tar.gz`
3. 解壓到 `data/raw/food-101/`
4. 重新運行 `pnpm run data:download`

## 數據目錄結構

下載和組織後的數據結構：

```
data/
├── raw/
│   └── food-101/          # 原始 Food-101 數據集
│       └── images/
│           ├── apple_pie/
│           ├── bibimbap/
│           └── ...
│
├── level1-food-detection/
│   ├── food/              # 食物圖像（從 Food-101）
│   └── non-food/          # 非食物圖像（需要手動收集）
│
├── level2-country-classification/
│   ├── chinese/           # 中國食物
│   ├── japanese/          # 日本食物
│   ├── korean/            # 韓國食物
│   └── ...
│
└── level3-fine-grained/
    ├── chinese/
    │   ├── chicken_curry/
    │   ├── fried_rice/
    │   └── ...
    └── japanese/
        ├── sushi/
        ├── ramen/
        └── ...
```

## 國家到 Food-101 類別映射

腳本會自動將 Food-101 的類別映射到國家：

- **chinese**: chicken_curry, chicken_wings, fried_rice, spring_rolls, wonton_soup
- **japanese**: sushi, ramen, miso_soup, tempura, teriyaki_chicken
- **korean**: bibimbap, bulgogi, kimchi
- **thai**: pad_thai, tom_yum_soup, green_curry
- **indian**: chicken_curry, naan, samosa, butter_chicken
- **italian**: pizza, pasta_carbonara, lasagna, bruschetta, ravioli
- **french**: french_toast, french_onion_soup, creme_brulee, croque_madame
- **mexican**: tacos, burrito, nachos, quesadilla
- **american**: hamburger, hot_dog, french_fries, apple_pie

## 後續步驟

### 1. 補充非食物圖像（第一層）

第一層模型需要非食物圖像作為負樣本。建議來源：

- **ImageNet 非食物類別**：人物、動物、風景、物品等
- **COCO 數據集**：包含多種非食物物體
- **其他公開數據集**

### 2. 擴展第三層數據

第三層需要更多細粒度分類。可以：

- 從 Food-101 添加更多類別
- 使用其他食物數據集（如 ChineseFoodNet、UECFOOD-256）
- 手動收集特定食物圖像

### 3. 數據驗證

運行統計腳本檢查數據質量：

```bash
pnpm run data:download  # 會顯示統計信息
```

## 圖片預處理配置

腳本會自動處理所有圖片以符合 TensorFlow 訓練要求：

| 層級   | 目標尺寸 | 格式 | 質量 | 說明                       |
| ------ | -------- | ---- | ---- | -------------------------- |
| 第一層 | 224×224  | JPEG | 85%  | 食物檢測（輕量級）         |
| 第二層 | 224×224  | JPEG | 85%  | 國家分類                   |
| 第三層 | 380×380  | JPEG | 90%  | 細粒度分類（需要更高質量） |

### 處理流程

1. **讀取原始圖片**（支持 JPEG、PNG、BMP、WebP）
2. **調整大小**：使用 `fill` 模式，保持寬高比，不足部分用白色填充
3. **格式轉換**：統一轉換為 JPEG
4. **優化壓縮**：使用 mozjpeg 編碼器（更好的壓縮率）
5. **刪除原始文件**：處理完成後自動刪除，節省磁盤空間

### 原始圖片格式

Food-101 數據集通常包含：

- **格式**：JPEG
- **尺寸**：各種尺寸（通常 200-800px）
- **文件大小**：50-500KB

處理後：

- **格式**：統一 JPEG
- **尺寸**：固定（224×224 或 380×380）
- **文件大小**：10-50KB（優化後）

## 注意事項

- Food-101 數據集約 5GB，下載需要一些時間
- 確保有足夠的磁盤空間（建議至少 10GB）
- **原始圖片會在處理後自動刪除**，節省空間
- 如果自動下載失敗，請手動下載並解壓
- 圖片處理過程會顯示進度（每 20-50 張顯示一次）

## 使用其他數據集

如果需要使用其他數據集，可以修改 `download-datasets.ts`：

1. 添加新的數據集配置
2. 實現對應的下載邏輯
3. 更新數據組織函數

常見的食物數據集：

- **ChineseFoodNet**: 208 種中國菜品
- **UECFOOD-256**: 256 類日本食物
- **Food-11**: 11 個食物類別（較小）
- **Vireo Food-172**: 172 類食物
