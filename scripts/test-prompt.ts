/**
 * Prompt 測試腳本
 * 用於快速測試不同 prompt 版本的效果
 * 
 * 使用方法：
 *   node --loader ts-node/esm scripts/test-prompt.ts <prompt-version> <ocr-text-file>
 * 
 * 例如：
 *   node --loader ts-node/esm scripts/test-prompt.ts v2 test-ocr.txt
 */

import { readFileSync } from "fs";
import { getAllPrompts, promptV1, promptV2, promptV3 } from "../server/llm/prompts.js";
import { BillResponseFormat } from "../server/llm/types.js";
import { mistral } from "../server/llm/mistral.js";
import { waitForRateLimit } from "../server/llm/rateLimit.js";
import { parse } from "best-effort-json-parser";
import { BillParser } from "../server/llm/types.js";

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log(`
用法：
  node --loader ts-node/esm scripts/test-prompt.ts <prompt-version> [ocr-text-file]

可用的 prompt 版本：
${getAllPrompts().map(p => `  - ${p.name}: ${p.description}`).join("\n")}

示例：
  node --loader ts-node/esm scripts/test-prompt.ts v2 test-ocr.txt
  node --loader ts-node/esm scripts/test-prompt.ts v1
    `);
    process.exit(1);
  }

  const promptVersion = args[0];
  const ocrTextFile = args[1];

  // 讀取 OCR 文本
  let ocrText: string;
  if (ocrTextFile) {
    try {
      ocrText = readFileSync(ocrTextFile, "utf-8");
    } catch (error) {
      console.error(`無法讀取文件: ${ocrTextFile}`);
      process.exit(1);
    }
  } else {
    // 使用示例文本
    ocrText = `蒔蘿大湖
結賬單（客戶聯）2
號：W靠窗區-W3
号號：11
品名
数量
單價
金额
%饭鲜松饭反
1份
250.0
250.0
%I汁新鲜蔬果汁（單）
1份
90.0
90.0
%昆義式蔬菜汤
1份
150.0
150.0
%D
鲜果奶酪
1份
0.0
0.0
%四季四季香草茶
1份
0.0
0.0
服務费
49.0
總金额
539.0`;
  }

  // 選擇 prompt 版本
  const prompts = getAllPrompts();
  let selectedPrompt = prompts.find(p => p.name.includes(promptVersion));
  
  if (!selectedPrompt) {
    console.error(`找不到 prompt 版本: ${promptVersion}`);
    console.log(`可用的版本: ${prompts.map(p => p.name).join(", ")}`);
    process.exit(1);
  }

  // 臨時切換 prompt（通過修改 prompts.ts 的 CURRENT_PROMPT）
  console.log(`\n📝 使用 Prompt: ${selectedPrompt.name}`);
  console.log(`📄 描述: ${selectedPrompt.description}\n`);
  console.log("─".repeat(60));
  console.log("📋 OCR 文本:");
  console.log("─".repeat(60));
  console.log(ocrText);
  console.log("─".repeat(60));
  console.log("\n🤖 調用 LLM 解析...\n");

  try {
    // 直接使用選定的 prompt，不依賴 CURRENT_PROMPT
    const prompt = selectedPrompt.template(ocrText, BillResponseFormat);
    
    console.log("─".repeat(60));
    console.log("📝 實際發送的 Prompt:");
    console.log("─".repeat(60));
    console.log(prompt);
    console.log("─".repeat(60));
    console.log("\n");

    // 調用 LLM
    await waitForRateLimit("test-prompt");
    const response = await mistral.chat.complete({
      model: "mistral-tiny",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // 解析響應
    let content = response.choices[0].message.content;
    if (typeof content !== "string") {
      throw new Error("預期 content 為字符串");
    }

    let startIndex = content.indexOf("{");
    if (startIndex === -1) {
      throw new Error("預期 content 包含 JSON 對象");
    }

    let text = content.slice(startIndex);
    let json = parse(text);
    let result = BillParser.parse(json);
    
    console.log("✅ 解析成功！\n");
    console.log("─".repeat(60));
    console.log("📊 解析結果:");
    console.log("─".repeat(60));
    console.log(JSON.stringify(result, null, 2));
    console.log("─".repeat(60));
    console.log("\n📈 Token 使用量:", response.usage?.totalTokens ?? "未知");
  } catch (error) {
    console.error("\n❌ 解析失敗:");
    console.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("\n堆棧:", error.stack);
    }
    process.exit(1);
  }
}

main();

