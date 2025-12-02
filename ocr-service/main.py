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
from typing import Dict, List, Any, Optional, Tuple
import logging
import cv2
import numpy as np
from PIL import Image

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


# 暫時禁用透視矯正功能（因為發現結果更差）
# TODO: 未來可以改進算法或提供開關選項
def detect_and_correct_perspective(image_path: str) -> Optional[str]:
    """
    檢測圖像四角並進行透視矯正
    
    【暫時禁用】此功能已暫時禁用，因為發現結果更差。
    未來可以改進算法或提供開關選項。
    
    Args:
        image_path: 輸入圖像路徑
        
    Returns:
        矯正後的圖像路徑（臨時文件），如果無法檢測到四角則返回 None
    """
    # 暫時直接返回 None，不進行透視矯正
    return None
    
    # 以下是原始實現（已註釋）
    """
    try:
        # 讀取圖像
        image = cv2.imread(image_path)
        if image is None:
            logger.warning("無法讀取圖像文件")
            return None
        
        # 轉換為灰度圖
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 高斯模糊，減少噪聲
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # 邊緣檢測
        edges = cv2.Canny(blurred, 50, 150, apertureSize=3)
        
        # 膨脹操作，連接斷開的邊緣
        dilated = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=2)
        
        # 查找輪廓
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            logger.info("未找到輪廓，跳過透視矯正")
            return None
        
        # 按面積排序輪廓
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        
        # 尋找最大的矩形輪廓（四角）
        screen_cnt = None
        for contour in contours[:10]:  # 只檢查前10個最大的輪廓
            # 計算輪廓周長
            peri = cv2.arcLength(contour, True)
            # 近似多邊形
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
            
            # 如果近似多邊形有四個頂點，認為找到了目標區域
            if len(approx) == 4:
                screen_cnt = approx
                break
        
        if screen_cnt is None:
            logger.info("未檢測到四角，跳過透視矯正")
            return None
        
        # 重新排序四個頂點：左上、右上、右下、左下
        pts = screen_cnt.reshape(4, 2)
        rect = np.zeros((4, 2), dtype="float32")
        
        # 計算頂點和
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]  # 左上（x+y 最小）
        rect[2] = pts[np.argmax(s)]  # 右下（x+y 最大）
        
        # 計算頂點差
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]  # 右上（y-x 最小）
        rect[3] = pts[np.argmax(diff)]  # 左下（y-x 最大）
        
        # 計算目標矩形的寬度和高度
        (tl, tr, br, bl) = rect
        widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
        widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
        maxWidth = max(int(widthA), int(widthB))
        
        heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
        heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
        maxHeight = max(int(heightA), int(heightB))
        
        # 定義目標矩形的四個頂點
        dst = np.array([
            [0, 0],
            [maxWidth - 1, 0],
            [maxWidth - 1, maxHeight - 1],
            [0, maxHeight - 1]
        ], dtype="float32")
        
        # 計算透視變換矩陣
        M = cv2.getPerspectiveTransform(rect, dst)
        
        # 執行透視變換
        warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
        
        # 保存矯正後的圖像到臨時文件
        output_path = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg').name
        cv2.imwrite(output_path, warped)
        
        logger.info(f"透視矯正完成，輸出: {output_path}")
        return output_path
        
    except Exception as e:
        logger.warning(f"透視矯正失敗: {str(e)}，將使用原始圖像")
        return None
    """


def auto_rotate_image(image_path: str) -> Optional[str]:
    """
    自動檢測並矯正圖像旋轉（水平/垂直）
    使用 PaddleOCR 的方向檢測功能，或使用 OpenCV 的文本方向檢測
    
    Args:
        image_path: 輸入圖像路徑
        
    Returns:
        矯正後的圖像路徑（臨時文件），如果不需要矯正則返回 None
    """
    try:
        # 讀取圖像
        image = cv2.imread(image_path)
        if image is None:
            return None
        
        # 使用 PaddleOCR 的方向檢測（如果可用）
        # 這裡先實現簡單的基於文本方向的檢測
        # 注意：PaddleOCR 本身已經有 use_textline_orientation=True，這裡主要是備用
        
        # 簡單的旋轉檢測：檢查圖像寬高比
        height, width = image.shape[:2]
        
        # 如果圖像是橫向的（寬 > 高），但應該是縱向的，可能需要旋轉
        # 但這個判斷比較複雜，暫時跳過，依賴 PaddleOCR 的自動方向檢測
        
        return None  # 暫時不進行額外旋轉，依賴 PaddleOCR
        
    except Exception as e:
        logger.warning(f"自動旋轉失敗: {str(e)}")
        return None


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
    tmp_file_path = None
    corrected_path = None
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp_file:
        try:
            # 讀取上傳的文件內容
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
            
            logger.info(f"開始 OCR 識別: {file.filename}")

            # 圖像預處理：透視矯正（暫時禁用，因為發現結果更差）
            # TODO: 未來可以改進透視矯正算法或提供開關選項
            # processed_image_path = tmp_file_path
            # corrected_path = detect_and_correct_perspective(tmp_file_path)
            # if corrected_path:
            #     processed_image_path = corrected_path
            #     logger.info("已應用透視矯正")
            processed_image_path = tmp_file_path
            corrected_path = None  # 暫時不使用透視矯正

            # 執行 OCR（新版 PaddleOCR 的 predict 不再接受 cls 參數，方向處理已在初始化中啟用）
            result = ocr.ocr(processed_image_path)
            
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

            # 如果沒有成功提取到行文字，嘗試更詳細的調試
            if not all_text:
                logger.warning("未能從標準格式提取文字，嘗試調試...")
                logger.warning(f"Result type: {type(result)}")
                logger.warning(f"Result length: {len(result) if isinstance(result, (list, tuple)) else 'N/A'}")
                if isinstance(result, list) and len(result) > 0:
                    logger.warning(f"First element type: {type(result[0])}")
                    logger.warning(f"First element: {str(result[0])[:200]}")  # 只顯示前200字符
                # 嘗試從原始結果中提取文字
                try:
                    # 如果 result 是列表，嘗試遞歸提取所有字符串
                    def extract_texts(obj, texts_list):
                        if isinstance(obj, str):
                            if obj.strip():  # 只添加非空字符串
                                texts_list.append(obj)
                        elif isinstance(obj, (list, tuple)):
                            for item in obj:
                                extract_texts(item, texts_list)
                        elif isinstance(obj, dict):
                            for value in obj.values():
                                extract_texts(value, texts_list)
                    
                    fallback_texts = []
                    extract_texts(result, fallback_texts)
                    if fallback_texts:
                        full_text = "\n".join(fallback_texts)
                        logger.info(f"從回退方案提取到 {len(fallback_texts)} 段文字")
                    else:
                        full_text = str(result)
                        logger.warning("回退方案也無法提取文字，返回原始結果字符串")
                except Exception as e:
                    logger.error(f"回退方案提取失敗: {e}")
                    full_text = str(result)
            else:
                full_text = "\n".join(all_text)

            logger.info(f"OCR 識別完成: {len(lines)} 行文字，總文字長度: {len(full_text)} 字符")

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
                if tmp_file_path and os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)
                if corrected_path and corrected_path != tmp_file_path and os.path.exists(corrected_path):
                    os.unlink(corrected_path)
            except (PermissionError, OSError) as e:
                logger.warning(f"無法刪除臨時文件（可能仍被佔用）: {e}")


if __name__ == "__main__":
    # 從環境變數讀取配置
    host = os.getenv("OCR_SERVICE_HOST", "0.0.0.0")
    port = int(os.getenv("OCR_SERVICE_PORT", "8000"))
    
    logger.info(f"啟動 OCR 服務: http://{host}:{port}")
    uvicorn.run(app, host=host, port=port)

