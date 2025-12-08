# OCR Service 設置指南

## Python 版本要求

本服務需要 **Python 3.8-3.11**（推薦 3.10），因為 PaddlePaddle 目前不支持 Python 3.14。

## 設置步驟

### 1. 安裝 Python 3.10

如果系統中還沒有 Python 3.10：

- **Windows**: 從 [Python 官網](https://www.python.org/downloads/) 下載 Python 3.10.x
- 安裝時勾選「Add Python to PATH」
- 或使用 `py -3.10` 命令（如果已安裝 Python Launcher）

### 2. 創建虛擬環境

在 `ocr-service` 目錄下執行：

```bash
# 使用 Python 3.10 創建虛擬環境
py -3.10 -m venv venv

# 或在 Git Bash 中：
python3.10 -m venv venv
```

### 3. 激活虛擬環境

**Windows (PowerShell/CMD)**:
```bash
venv\Scripts\activate
```

**Windows (Git Bash)**:
```bash
source venv/Scripts/activate
```

激活成功後，命令提示符前會顯示 `(venv)`。

### 4. 安裝依賴

```bash
# 升級 pip
python -m pip install --upgrade pip

# 安裝 PaddlePaddle（CPU 版本，與 PaddleOCR 3.3.2 兼容）
python -m pip install paddlepaddle==3.2.1 -i https://pypi.tuna.tsinghua.edu.cn/simple

# 安裝其他依賴
pip install -r requirements.txt
```

### 5. 啟動服務

```bash
python main.py
```

服務將在 `http://localhost:8000` 啟動。

## 日常使用

每次使用 OCR 服務前：

1. 進入 `ocr-service` 目錄
2. 激活虛擬環境：
   ```bash
   # Git Bash
   source venv/Scripts/activate
   
   # PowerShell/CMD
   venv\Scripts\activate
   ```
3. 啟動服務：
   ```bash
   python main.py
   ```

## 注意事項

- 首次運行時，PaddleOCR 會自動下載模型文件（約 8.6MB），需要網絡連接
- 虛擬環境已添加到 `.gitignore`，不會被提交到 Git
- 如果遇到依賴問題，可以刪除 `venv` 目錄重新創建

## 故障排除

### 問題：`py -3.10` 命令不存在

**解決方案**：
- 確保已安裝 Python 3.10
- 或直接使用完整路徑：`C:\Python310\python.exe -m venv venv`

### 問題：PaddlePaddle 安裝失敗

**解決方案**：
- 嘗試使用官方源：`pip install paddlepaddle==2.6.1`
- 或使用清華源：`pip install paddlepaddle==2.6.1 -i https://pypi.tuna.tsinghua.edu.cn/simple`

### 問題：虛擬環境激活失敗

**解決方案**：
- 確保在 `ocr-service` 目錄下執行激活命令
- 檢查 `venv` 目錄是否存在
- 如果問題持續，刪除 `venv` 目錄重新創建


