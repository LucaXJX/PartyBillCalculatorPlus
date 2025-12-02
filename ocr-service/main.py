"""
OCR Service for PartyBillCalculator
使用 PaddleOCR 進行賬單圖片文字識別
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR
import uvicorn
import os
import tempfile
from typing import Dict, List, Any
import logging

# 配置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="OCR Service",
    description="PaddleOCR-based OCR service for bill recognition",
    version="1.0.0"
)

# 配置 CORS（允許 Node.js 後端調用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生產環境應限制為特定域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化 PaddleOCR（支持中英文）
# 注意：新版 PaddleOCR 已棄用 use_angle_cls、show_log 等參數
# 這裡使用推薦的參數配置：lang='ch'（中英文）、use_textline_orientation=True（自動處理文字方向）
logger.info("正在初始化 PaddleOCR...")
ocr = PaddleOCR(lang="ch", use_textline_orientation=True)
logger.info("PaddleOCR 初始化完成")


@app.get("/")
async def root():
    """健康檢查端點"""
    return {
        "service": "OCR Service",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    """健康檢查"""
    return {"status": "healthy"}


@app.post("/ocr")
async def ocr_image(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    接收圖片文件，進行 OCR 識別
    
    Args:
        file: 上傳的圖片文件
        
    Returns:
        {
            "text": "識別出的完整文字",
            "lines": [
                {"text": "文字內容", "confidence": 0.95, "bbox": [...]}
            ],
            "raw_result": [...]  # PaddleOCR 原始結果
        }
    """
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=400,
            detail="文件必須是圖片格式"
        )
    
    # 創建臨時文件保存上傳的圖片
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp_file:
        try:
            # 讀取上傳的文件內容
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
            
            logger.info(f"開始 OCR 識別: {file.filename}")

            # 執行 OCR（新版 PaddleOCR 的 predict 不再接受 cls 參數，方向處理已在初始化中啟用）
            result = ocr.ocr(tmp_file_path)
            
            # 處理結果
            if not result:
                return {
                    "text": "",
                    "lines": [],
                    "raw_result": None
                }

            # 提取文字和置信度（兼容不同 PaddleOCR 返回格式）
            lines = []
            all_text = []

            try:
                first_page = result[0]
            except Exception:
                first_page = None

            # 新格式：result[0] 是字典，包含 'rec_texts' 等字段
            if isinstance(first_page, dict) and 'rec_texts' in first_page:
                rec_texts = first_page.get('rec_texts', [])
                rec_scores = first_page.get('rec_scores', [])
                rec_polys = first_page.get('rec_polys', [])
                
                for i, text in enumerate(rec_texts):
                    if text and isinstance(text, str):
                        confidence = rec_scores[i] if i < len(rec_scores) else 0.0
                        
                        # 處理 bbox（rec_polys）
                        bbox_list = []
                        if i < len(rec_polys):
                            poly = rec_polys[i]
                            if hasattr(poly, 'tolist'):
                                bbox_list = poly.tolist()
                            elif isinstance(poly, (list, tuple)):
                                bbox_list = list(poly)
                        
                        lines.append({
                            "text": text,
                            "confidence": float(confidence),
                            "bbox": bbox_list
                        })
                        all_text.append(text)
            
            # 傳統格式：result[0] 為若干行，每行形如 [bbox, (text, score)]
            elif isinstance(first_page, list):
                for line in first_page:
                    if len(line) >= 2:
                        bbox = line[0]  # 邊界框座標（可能是 numpy.ndarray）
                        text_info = line[1]  # (文字, 置信度)

                        if isinstance(text_info, tuple) and len(text_info) >= 2:
                            text = text_info[0]
                            confidence = text_info[1]

                            # 將 numpy.ndarray 轉換為 Python 列表，確保可以序列化
                            if hasattr(bbox, 'tolist'):
                                bbox_list = bbox.tolist()
                            elif isinstance(bbox, (list, tuple)):
                                bbox_list = list(bbox)
                            else:
                                bbox_list = []

                            lines.append({
                                "text": text,
                                "confidence": float(confidence),
                                "bbox": bbox_list
                            })
                            all_text.append(text)

            # 如果沒有成功提取到行文字，回退為直接將整個結果轉為字符串
            if not all_text:
                logger.warning("未能從標準格式提取文字，使用回退方案")
                full_text = str(result)
            else:
                full_text = "\n".join(all_text)

            logger.info(f"OCR 識別完成: {len(lines)} 行文字")

            return {
                "text": full_text,
                "lines": lines,
                "raw_result": None  # 暫時不返回 raw_result，避免序列化問題
            }
            
        except Exception as e:
            logger.error(f"OCR 處理錯誤: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"OCR 處理失敗: {str(e)}"
            )
        finally:
            # 清理臨時文件（Windows 上文件可能仍被佔用，忽略刪除失敗）
            try:
                if "tmp_file_path" in locals() and os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)
            except PermissionError:
                logger.warning(f"無法刪除臨時文件（可能仍被佔用）: {tmp_file_path}")


if __name__ == "__main__":
    # 從環境變數讀取配置
    host = os.getenv("OCR_SERVICE_HOST", "0.0.0.0")
    port = int(os.getenv("OCR_SERVICE_PORT", "8000"))
    
    logger.info(f"啟動 OCR 服務: http://{host}:{port}")
    uvicorn.run(app, host=host, port=port)

