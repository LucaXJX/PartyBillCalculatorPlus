# OCR Service

基於 PaddleOCR 的賬單圖片文字識別服務，為 PartyBillCalculator 提供 OCR 功能。

## 功能

- 支持中英文混合識別
- 支持圖片角度自動校正（PaddleOCR 內建）
- ~~**自動透視矯正**~~（暫時禁用：檢測賬單四角並進行透視變換，矯正扭曲的圖像）
- 返回結構化的識別結果（文字、置信度、邊界框）
- RESTful API 接口

## 安裝

### 1. 確保 Python 環境

```bash
python --version  # 需要 Python 3.8+
```

### 2. 安裝依賴

```bash
pip install -r requirements.txt
```

**注意**：首次運行時，PaddleOCR 會自動下載模型文件（約 8.6MB），請確保網絡連接正常。

## 運行

### 開發模式

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Docker 運行

```bash
# 構建鏡像
docker build -t ocr-service .

# 運行容器
docker run -p 8000:8000 ocr-service
```

## API 文檔

服務啟動後，訪問：
- API 文檔：http://localhost:8000/docs
- 健康檢查：http://localhost:8000/health

## API 端點

### POST /ocr

上傳圖片進行 OCR 識別。

**請求**：
- Content-Type: `multipart/form-data`
- Body: 圖片文件（file）

**響應**：
```json
{
  "text": "識別出的完整文字\n按行分隔",
  "lines": [
    {
      "text": "文字內容",
      "confidence": 0.95,
      "bbox": [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
    }
  ],
  "raw_result": [...]
}
```

## 環境變數

- `OCR_SERVICE_HOST`: 服務監聽地址（默認：0.0.0.0）
- `OCR_SERVICE_PORT`: 服務端口（默認：8000）

## 注意事項

1. **首次運行**：PaddleOCR 會下載模型文件，需要一些時間
2. **內存需求**：模型加載後約需 500MB-1GB 內存
3. **處理速度**：單張圖片處理時間約 1-3 秒（取決於圖片大小和複雜度）
4. **圖片格式**：支持常見圖片格式（jpg, png, bmp 等）

## 與 Node.js 後端整合

Node.js 後端通過 HTTP 請求調用此服務：

```typescript
// server/ocrClient.ts
const response = await fetch('http://localhost:8000/ocr', {
  method: 'POST',
  body: formData
});
```

