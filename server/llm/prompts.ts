/**
 * 賬單解析 Prompt 模板
 * 用於快速迭代和測試不同的 prompt 版本
 */

export interface PromptConfig {
  name: string;
  description: string;
  template: (ocrText: string, format: string) => string;
}

/**
 * Prompt 版本 1：溫和版本（當前使用）
 * 特點：簡單直接，依賴 LLM 的推理能力
 */
export const promptV1: PromptConfig = {
  name: "v1-溫和版本",
  description: "簡單直接的 prompt，依賴 LLM 推理",
  template: (ocrText: string, format: string) => `
請從以下賬單 OCR 文本中提取結構化信息：

${ocrText}

請以 JSON 格式返回，格式如下：
${format}

只返回 JSON，不要其他文字。**重要：所有文字內容（如餐廳名稱、菜品名稱等）必須使用繁體中文返回。**如果某些信息無法確定，請使用合理的默認值（例如：currency 默認為 "HKD"，tip 如果沒有明確標示則為 0）。

關於服務費 / 小費（tip）的處理，請遵守以下規則：
1. 如果賬單中有明確標註百分比（例如「服務費 10%」「Service Charge 10%」），請直接使用該百分比，並根據小計 subtotal * 百分比 計算 tip 金額。
2. 如果只有服務費金額，沒有標出百分比，且同時存在「小計」「總金額 / 合計」等欄位，請根據： total - subtotal 的差額 來推算 tip，並使用該金額作為 tip；如果無法明確區分，仍可將該差額視為 tip。
3. 如果賬單中既沒有明確的服務費金額，也沒有明確的小計 / 總額關係，則將 tip 設為 0。
`.trim(),
};

/**
 * Prompt 版本 2：嚴格版本（推薦用於測試）
 * 特點：明確規則，減少歧義，要求嚴格遵循格式
 */
export const promptV2: PromptConfig = {
  name: "v2-嚴格版本",
  description: "明確規則，減少歧義，嚴格遵循格式",
  template: (ocrText: string, format: string) => `
你是一個專業的賬單解析系統。請嚴格按照以下規則從 OCR 文本中提取信息：

【OCR 文本】
${ocrText}

【輸出格式要求】
${format}

【嚴格規則】
1. **餐廳名稱**：從文本開頭或明顯的餐廳標識中提取，如果找不到則返回空字符串 ""，不要編造。
2. **日期**：只提取明確的日期信息（格式：YYYY-MM-DD 或 ISO 8601），如果找不到則返回空字符串 ""，不要編造日期。
3. **菜品列表（items）**：
   - 只提取實際的菜品項目，排除表頭（如「品名」「数量」「單價」「金额」）
   - 排除總計行（如「總金额」「小計」「合計」）
   - 菜品名稱：去除開頭的亂碼符號（如 %、#、@ 等），只保留實際的菜品名稱
   - 價格（price）：必須是數字，如果識別為 0.0 或無法確定，則設為 0
   - 數量（quantity）：如果文本中有明確數量（如「1份」「2個」），提取數字；否則可選
4. **小計（subtotal）**：從文本中明確標示的「小計」「合計」「總金额」等欄位提取，如果找不到則計算所有 items 的 price 總和。
5. **服務費/小費（tip）**：從「服務费」「小費」「服務費」等欄位提取，如果找不到則設為 0。
6. **總額（total）**：從「總金额」「合計」「總計」等欄位提取，如果找不到則計算 subtotal + tip。
7. **貨幣（currency）**：從文本中推斷（如「HKD」「USD」「CNY」），如果無法確定則默認為 "HKD"。

【輸出要求】
- 只返回 JSON 對象，不要任何其他文字、說明或註釋
- JSON 必須嚴格符合上述格式
- 所有數字必須是 number 類型，不是字符串
- **重要：所有文字內容（如餐廳名稱、菜品名稱等）必須使用繁體中文返回**
- 如果某個欄位無法確定，使用空字符串 "" 或 0，不要編造數據

請開始解析：
`.trim(),
};

/**
 * Prompt 版本 3：極簡版本（用於對比）
 * 特點：最簡潔的指令，測試 LLM 的基礎能力
 */
export const promptV3: PromptConfig = {
  name: "v3-極簡版本",
  description: "最簡潔的指令，測試 LLM 基礎能力",
  template: (ocrText: string, format: string) => `
解析以下賬單文本為 JSON：

${ocrText}

格式：
${format}

只返回 JSON。**重要：所有文字內容必須使用繁體中文返回。**
`.trim(),
};

/**
 * 當前使用的 prompt 版本
 * 修改這裡來切換不同的 prompt 版本
 */
export const CURRENT_PROMPT = promptV1; // 默認使用溫和版本（正式解析）

/**
 * 獲取當前 prompt
 */
export function getCurrentPrompt(ocrText: string, format: string): string {
  return CURRENT_PROMPT.template(ocrText, format);
}

/**
 * 獲取所有可用的 prompt 版本
 */
export function getAllPrompts(): PromptConfig[] {
  return [promptV1, promptV2, promptV3];
}

