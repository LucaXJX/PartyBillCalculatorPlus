# Python 環境安裝指南

## 🚀 快速安裝（推薦）

### 方法 1: 最小安裝（僅測試用）

如果只想測試訓練流程，可以使用最小依賴集：

```bash
cd food-recognition-service
source venv/Scripts/activate  # Git Bash
# 或
venv\Scripts\activate  # Windows CMD

pip install -r requirements-minimal.txt
```

### 方法 2: 分步安裝（避免依賴衝突）

```bash
cd food-recognition-service
source venv/Scripts/activate  # Git Bash

# 1. 先安裝 TensorFlow（這是最重的依賴）
pip install tensorflow==2.15.0

# 2. 再安裝 TensorFlow.js 轉換器
pip install tensorflowjs==4.15.0

# 3. 安裝其他依賴
pip install Pillow>=10.0.0 numpy>=1.24.0,<2.0.0
```

### 方法 3: 完整安裝

```bash
cd food-recognition-service
source venv/Scripts/activate  # Git Bash

pip install -r requirements.txt
```

## ⚠️ 如果遇到依賴解析問題

如果 pip 安裝時間過長（超過 5 分鐘），可以：

1. **使用最小依賴集**：
   ```bash
   pip install -r requirements-minimal.txt
   ```

2. **升級 pip**：
   ```bash
   python -m pip install --upgrade pip
   ```

3. **使用 pip 的 `--no-deps` 選項**（不推薦，除非你知道自己在做什麼）

## ✅ 驗證安裝

安裝完成後，驗證是否成功：

```bash
python -c "import tensorflow as tf; print('TensorFlow:', tf.__version__)"
python -c "import tensorflowjs; print('TensorFlow.js converter installed')"
python -c "from PIL import Image; print('Pillow installed')"
```

## 📝 注意事項

- **TensorFlow 2.15.0** 是一個穩定版本，與大多數依賴兼容
- **numpy<2.0.0** 限制是為了避免與 TensorFlow 2.15.0 的兼容性問題
- 如果只需要測試訓練流程，使用 `requirements-minimal.txt` 就足夠了

