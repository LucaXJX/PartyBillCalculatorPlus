/**
 * 賬單解析器
 * 使用 Mistral AI 將 OCR 文本解析為結構化賬單數據
 * 參考 01-mc-system/generate.ts
 */
import { parse } from "best-effort-json-parser";
import { waitForRateLimit } from "./rateLimit.js";
import { mistral } from "./mistral.js";
import { recordApiUsage } from "./usageTracker.js";
import { BillParser, BillResponseFormat, type ParsedBill } from "./types.js";
import { getCurrentPrompt } from "./prompts.js";

parse.onExtraToken = (text, data, reminding) => {
  // 忽略額外的 token
};

/**
 * 處理 LLM 響應，提取和驗證 JSON
 */
function handleResponse(response: any): ParsedBill {
  if (response.choices[0].finishReason !== "stop") {
    throw new Error(
      `預期 finishReason 為 'stop'，但得到 ${response.choices[0].finishReason}`
    );
  }

  let content = response.choices[0].message.content;
  if (typeof content !== "string") {
    throw new Error("預期 content 為字符串");
  }

  // 提取 JSON 部分（可能包含其他文字）
  let startIndex = content.indexOf("{");
  if (startIndex === -1) {
    throw new Error("預期 content 包含 JSON 對象");
  }

  let text = content.slice(startIndex);
  let json = parse(text);
  let bill = BillParser.parse(json);

  return bill;
}

/**
 * 從 OCR 文本解析賬單
 * @param ocrText OCR 識別出的文字
 * @param userId 可選的用戶 ID（用於記錄使用量）
 * @returns 解析後的賬單數據
 */
export async function parseBillFromOCR(
  ocrText: string,
  userId?: number
): Promise<ParsedBill> {
  // 使用配置的 prompt 模板
  const prompt = getCurrentPrompt(ocrText, BillResponseFormat);

  const model = "mistral-tiny"; // 使用免費模型

  try {
    // 第一次嘗試
    await waitForRateLimit("parseBillFromOCR (initial prompt)");

    let response = await mistral.chat.complete({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    let result: ParsedBill;
    try {
      result = handleResponse(response);

      // 記錄成功的使用量
      await recordApiUsage({
        userId,
        requestType: "bill_parse",
        tokensUsed: response.usage?.totalTokens ?? undefined,
        success: true,
      });
    } catch (error) {
      // 如果 JSON 解析失敗，嘗試修復
      console.warn("JSON 解析失敗，嘗試修復:", error);

      await waitForRateLimit("parseBillFromOCR (fix json)");

      const fixResponse = await mistral.chat.complete({
        model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
          {
            role: "assistant",
            content: response.choices[0].message.content || "",
          },
          {
            role: "user",
            content: `
${error}

請修復 JSON 並返回正確的格式：
${BillResponseFormat}
`,
          },
        ],
      });

      result = handleResponse(fixResponse);

      // 記錄成功的使用量（包含重試）
      await recordApiUsage({
        userId,
        requestType: "bill_parse",
        tokensUsed:
          (response.usage?.totalTokens ?? 0) +
          (fixResponse.usage?.totalTokens ?? 0),
        success: true,
      });
    }

    return result;
  } catch (error) {
    // 記錄失敗的使用量
    await recordApiUsage({
      userId,
      requestType: "bill_parse",
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}
