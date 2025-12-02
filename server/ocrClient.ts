/**
 * OCR Client
 * 呼叫本地 PaddleOCR 服務（FastAPI）進行圖片文字識別
 */

import FormData from "form-data";
import fs from "fs";
import path from "path";
import axios from "axios";

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "http://localhost:8000";

export interface OCRLine {
  text: string;
  confidence: number;
  bbox: number[][];
}

export interface OCRResult {
  text: string;
  lines: OCRLine[];
  raw_result: any;
}

/**
 * 呼叫 OCR 服務識別圖片
 * @param imagePath 圖片文件路徑
 * @returns OCR 識別結果
 */
export async function ocrImage(imagePath: string): Promise<OCRResult> {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`圖片文件不存在: ${imagePath}`);
  }

  const form = new FormData();
  const fileStream = fs.createReadStream(imagePath);
  const filename = path.basename(imagePath);

  form.append("file", fileStream, filename);

  try {
    const response = await axios.post(`${OCR_SERVICE_URL}/ocr`, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
    });

    return response.data as OCRResult;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`OCR 調用失敗: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 檢查 OCR 服務是否可用
 * @returns 服務是否健康
 */
export async function checkOCRService(): Promise<boolean> {
  try {
    const response = await fetch(`${OCR_SERVICE_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      return data.status === "healthy";
    }
    return false;
  } catch (error) {
    return false;
  }
}
