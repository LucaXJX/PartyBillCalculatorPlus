# 食物識別系統實作 TODO 總結

## 📊 整體進度

**已完成**：12/17 個 TODO（70.6%）  
**待完成**：5 個 TODO（29.4%）

---

## ✅ 已完成的工作

### Phase 1: 基礎設施搭建
- ✅ **TODO-1**: 安裝必要的依賴包
- ✅ **TODO-2**: 創建基礎目錄結構

### Phase 2: 核心模塊實現
- ✅ **TODO-3**: 實現 `ImagePreprocessor.ts`
- ✅ **TODO-4**: 實現 `ModelLoader.ts`
- ✅ **TODO-5**: 實現 `RecognitionPipeline.ts`

### Phase 3: API 集成
- ✅ **TODO-6**: 在 `server.ts` 中集成食物識別 API

### Phase 4: 訓練基礎設施
- ✅ **TODO-7**: 實現 `DataLoader.ts`
- ✅ **TODO-8**: 實現 `model-builder.ts`
- ✅ **TODO-9**: 實現 `augmentation.ts`

### Phase 5: 訓練腳本
- ✅ **TODO-10**: 創建訓練腳本（train-level1/2/3.ts）

### 數據收集
- ✅ **TODO-11**: 實現數據收集腳本（download-datasets.ts）
- ✅ **TODO-12**: 實現圖片預處理（調整大小、格式轉換、刪除原始）

---

## ✅ 新增完成

### 測試頁面
- ✅ **測試頁面**: 創建 `food-recognition-test.html`
  - API 連接測試
  - 模型狀態查詢
  - 圖像預處理測試
  - 推理流程測試
  - 數據統計（只讀）
  - 系統健康檢查
  - 訪問地址：`http://localhost:3000/food-recognition-test.html`

---

## ⏳ 待完成的工作

### Phase 6: 數據庫與模型管理

#### TODO-13: 更新數據庫 Schema ⚠️ **優先級 1**

**目標**：創建數據庫表來存儲食物信息和模型版本

**需要實作**：

1. **food_info 表**
   - 存儲食物詳細信息（名稱、卡路里、營養成分等）
   - 與識別結果關聯
   - 支持多語言（中文、英文）

2. **model_versions 表**
   - 追蹤模型版本信息
   - 記錄訓練日期、準確率等指標
   - 支持模型切換

3. **數據遷移**
   - 更新 `erd.txt`
   - 創建 knex 遷移文件
   - 更新 `proxy.ts`

**文件位置**：
- `erd.txt` - 添加新表定義
- `migrations/` - 創建遷移文件
- `server/proxy.ts` - 自動生成（通過 erd-to-proxy）

#### TODO-14: 實現模型版本管理 ⚠️ **優先級 2**

**目標**：實現模型版本追蹤和管理功能

**需要實作**：

1. **ModelVersionManager 類**
   - `server/food-recognition/models/ModelVersionManager.ts`
   - 記錄模型版本信息
   - 切換活動模型
   - 查詢版本歷史

2. **API 端點**
   - `GET /api/food/models/versions` - 獲取所有版本
   - `POST /api/food/models/switch` - 切換模型版本
   - `GET /api/food/models/current` - 獲取當前活動模型

3. **與 ModelLoader 集成**
   - 根據數據庫中的活動模型加載
   - 支持版本切換

### Phase 7: 測試與優化

#### TODO-15: 單元測試 ⚠️ **優先級 4**

**目標**：確保系統穩定性

**需要實作**：

1. **測試文件結構**
   ```
   tests/
   ├── food-recognition/
   │   ├── ImagePreprocessor.test.ts
   │   ├── ModelLoader.test.ts
   │   └── RecognitionPipeline.test.ts
   ```

2. **測試內容**
   - 圖像預處理測試（尺寸、格式轉換）
   - 模型加載測試（錯誤處理、緩存）
   - 推理流程測試（三層級聯）

#### TODO-16: 性能優化 ⚠️ **優先級 3**

**目標**：優化推理性能

**需要實作**：

1. **緩存機制**
   - 使用 `node-cache` 緩存識別結果
   - 基於圖片哈希的緩存鍵
   - 在 `RecognitionPipeline.ts` 中集成

2. **批量推理優化**
   - 改進批量處理邏輯
   - GPU 加速驗證和配置

3. **異步隊列**
   - 使用 `p-queue` 管理並發推理
   - 避免 GPU 內存溢出

#### TODO-17: 文檔完善 ⚠️ **優先級 5**

**目標**：完善使用文檔

**需要實作**：

1. **API 文檔**
   - 所有端點的詳細說明
   - 請求/響應示例
   - 錯誤碼說明

2. **使用示例**
   - 訓練流程示例
   - 推理使用示例
   - 數據收集示例

3. **部署指南**
   - 環境配置
   - GPU 設置（可選）
   - 生產環境部署

---

## 🎯 下一步實作順序

### 第一步：數據庫 Schema（TODO-13）

**為什麼優先**：
- 識別結果需要存儲食物詳細信息（卡路里、營養成分等）
- 模型版本管理需要數據庫支持
- 是其他功能的基礎

**實作步驟**：
1. 更新 `erd.txt` 添加 `food_info` 和 `model_versions` 表
2. 運行 `npm run db:update` 生成遷移和 proxy
3. 驗證數據庫結構

### 第二步：模型版本管理（TODO-14）

**為什麼優先**：
- 支持模型迭代和 A/B 測試
- 記錄性能指標，便於優化
- 支持模型回滾

**實作步驟**：
1. 創建 `ModelVersionManager.ts`
2. 在訓練腳本中記錄版本信息
3. 實現 API 端點
4. 與 `ModelLoader` 集成

### 第三步：性能優化（TODO-16）

**為什麼優先**：
- 提升用戶體驗（響應速度）
- 減少服務器負載
- 支持更高並發

**實作步驟**：
1. 實現緩存機制
2. 優化批量推理
3. 添加 GPU 支持驗證

### 第四步：單元測試（TODO-15）

**為什麼後做**：
- 確保核心功能穩定後再測試
- 測試需要穩定的 API

### 第五步：文檔完善（TODO-17）

**為什麼最後**：
- 所有功能完成後再完善文檔
- 確保文檔與實際實現一致

---

## 📝 詳細實作計劃

### TODO-13: 數據庫 Schema 詳細計劃

#### 1. 更新 erd.txt

```txt
food_info
--------
id varchar(64) PK
name varchar(255) NOT NULL
name_en varchar(255) NULL
country varchar(50) NOT NULL
category varchar(100) NULL
calories integer NULL
protein decimal(5,2) NULL
fat decimal(5,2) NULL
carbs decimal(5,2) NULL
ingredients text NULL
description text NULL
image_url varchar(512) NULL
created_at varchar(64)
updated_at varchar(64)

model_versions
--------------
id varchar(64) PK
level integer NOT NULL
country varchar(50) NULL
version varchar(50) NOT NULL
model_path varchar(512) NOT NULL
accuracy decimal(5,2) NULL
training_date varchar(64) NULL
is_active integer DEFAULT 0
created_at varchar(64)
```

#### 2. 創建數據遷移

運行 `npm run db:update` 自動生成遷移文件

#### 3. 驗證

- 檢查數據庫表是否創建成功
- 測試插入和查詢操作

### TODO-14: 模型版本管理詳細計劃

#### 1. 創建 ModelVersionManager

**文件**：`server/food-recognition/models/ModelVersionManager.ts`

**功能**：
- `recordVersion()` - 記錄新版本
- `getActiveVersion()` - 獲取活動版本
- `switchVersion()` - 切換版本
- `getVersionHistory()` - 獲取版本歷史

#### 2. 更新訓練腳本

在訓練完成後自動記錄版本信息

#### 3. 更新 ModelLoader

根據數據庫中的活動版本加載模型

#### 4. 添加 API 端點

在 `server.ts` 中添加版本管理 API

### TODO-16: 性能優化詳細計劃

#### 1. 緩存機制

**文件**：`server/food-recognition/models/RecognitionCache.ts`

**功能**：
- 基於圖片哈希的緩存鍵
- TTL 設置（1 小時）
- 緩存命中率統計

#### 2. 批量推理優化

**改進**：
- 使用 `tf.concat` 批量處理
- 減少張量創建和銷毀
- 優化內存使用

#### 3. GPU 支持

**驗證**：
- 檢查 CUDA 環境
- 測試 GPU 加速效果
- 提供 CPU 降級方案

---

## 🔍 檢查清單

在開始實作前，確認：

- [ ] 所有已完成的功能都已測試
- [ ] 數據收集腳本可以正常運行
- [ ] 訓練腳本可以正常運行
- [ ] API 端點可以正常訪問
- [ ] 沒有編譯錯誤

---

## 📌 當前狀態

**核心功能**：✅ 完成  
**訓練系統**：✅ 完成  
**數據收集**：✅ 完成  
**數據庫集成**：⏳ 待實作  
**性能優化**：⏳ 待實作  
**測試覆蓋**：⏳ 待實作  

**建議**：優先完成數據庫 Schema，這樣系統才能完整存儲和查詢食物信息。

