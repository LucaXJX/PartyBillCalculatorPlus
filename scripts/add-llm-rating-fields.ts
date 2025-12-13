/**
 * 添加 LLM 評分字段到 restaurant 表
 */
import { db } from "../server/db.js";

async function addLLMRatingFields() {
  try {
    console.log("🔧 開始添加 LLM 評分字段...\n");

    // 檢查字段是否已存在
    const tableInfo = db.prepare("PRAGMA table_info(restaurant)").all() as any[];
    const existingFields = tableInfo.map((col) => col.name);

    const fieldsToAdd = [
      {
        name: "llm_rating",
        type: "decimal(3,2) NULL",
        description: "LLM 獲取的餐廳評分（0-5）",
      },
      {
        name: "llm_rating_confidence",
        type: "decimal(3,2) NULL",
        description: "LLM 評分的置信度（0-1）",
      },
      {
        name: "llm_rating_reasoning",
        type: "text NULL",
        description: "LLM 評分的理由",
      },
      {
        name: "llm_rating_updated_at",
        type: "varchar(64) NULL",
        description: "LLM 評分更新時間",
      },
    ];

    for (const field of fieldsToAdd) {
      if (existingFields.includes(field.name)) {
        console.log(`  ⏭️  字段 ${field.name} 已存在，跳過`);
      } else {
        const sql = `ALTER TABLE restaurant ADD COLUMN ${field.name} ${field.type}`;
        db.prepare(sql).run();
        console.log(`  ✅ 已添加字段: ${field.name} (${field.description})`);
      }
    }

    console.log("\n✅ 字段添加完成！");
  } catch (error: any) {
    console.error("❌ 添加字段失敗:", error?.message || String(error));
    if (error?.stack) {
      console.error("錯誤堆棧:", error.stack);
    }
    process.exit(1);
  }
}

addLLMRatingFields().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("❌ 執行失敗:", error);
  process.exit(1);
});

