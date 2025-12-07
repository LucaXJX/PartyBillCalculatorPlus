# 食物識別 Python 訓練服務

## 概述

使用 Python 進行模型訓練，然後轉換為 TensorFlow.js 格式，避免 Node.js 中的 native 模塊構建問題。

## 設置

### 1. 創建虛擬環境

```bash
cd food-recognition-service
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 2. 安裝依賴

```bash
pip install -r requirements.txt
```

### 3. 訓練模型

```bash
# 訓練第一層：食物檢測
python train/train_level1.py

# 訓練第二層：菜系分類
python train/train_level2.py

# 訓練第三層：細粒度分類
python train/train_level3.py
```

### 4. 轉換為 TensorFlow.js

```bash
python convert/convert_to_tfjs.py
```

轉換後的模型會保存在 `models_tfjs/` 目錄中。

## 目錄結構

```
food-recognition-service/
├── requirements.txt          # Python 依賴
├── train/
│   ├── train_level1.py      # 第一層訓練
│   ├── train_level2.py      # 第二層訓練
│   ├── train_level3.py      # 第三層訓練
│   └── utils/
│       ├── data_loader.py   # 數據加載
│       ├── augmentation.py  # 數據增強
│       └── model_builder.py # 模型構建
├── convert/
│   └── convert_to_tfjs.py   # 轉換腳本
├── models/                  # 訓練好的模型（TensorFlow SavedModel）
└── models_tfjs/             # 轉換後的 TensorFlow.js 模型
```

## 使用流程

1. **準備數據**：將訓練數據放在 `data/` 目錄中
2. **訓練模型**：運行訓練腳本
3. **轉換模型**：將模型轉換為 TensorFlow.js 格式
4. **在 Node.js 中使用**：加載轉換後的模型

## 優勢

- ✅ 不需要構建 native 模塊
- ✅ Python 訓練環境成熟穩定
- ✅ 支持 GPU 訓練
- ✅ 可以轉換為 TensorFlow.js 在 Node.js 中使用


