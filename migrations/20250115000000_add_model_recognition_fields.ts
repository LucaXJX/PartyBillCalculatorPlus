import { Knex } from "knex";

// prettier-ignore
export async function up(knex: Knex): Promise<void> {
  // 為 food_images 表添加模型識別結果字段
  if (await knex.schema.hasTable("food_images")) {
    const hasModelResult = await knex.schema.hasColumn("food_images", "model_recognition_result");
    
    if (!hasModelResult) {
      await knex.schema.alterTable("food_images", (table) => {
        // 模型識別結果（JSON格式）
        table.text("model_recognition_result").nullable();
        // 模型識別置信度（總體）
        table.float("model_recognition_confidence").nullable();
        // 模型識別時間
        table.string("model_recognition_at", 64).nullable();
        // 模型識別錯誤信息
        table.text("model_recognition_error").nullable();
      });
      
      console.log("✅ 已添加模型識別結果字段到 food_images 表");
    } else {
      console.log("ℹ️  模型識別結果字段已存在，跳過");
    }
  } else {
    console.warn("⚠️  food_images 表不存在，跳過添加字段");
  }
}

// prettier-ignore
export async function down(knex: Knex): Promise<void> {
  // 移除模型識別結果字段
  if (await knex.schema.hasTable("food_images")) {
    const hasModelResult = await knex.schema.hasColumn("food_images", "model_recognition_result");
    
    if (hasModelResult) {
      await knex.schema.alterTable("food_images", (table) => {
        table.dropColumn("model_recognition_result");
        table.dropColumn("model_recognition_confidence");
        table.dropColumn("model_recognition_at");
        table.dropColumn("model_recognition_error");
      });
      
      console.log("✅ 已移除模型識別結果字段");
    }
  }
}


