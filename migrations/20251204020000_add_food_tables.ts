import { Knex } from "knex";

// prettier-ignore
export async function up(knex: Knex): Promise<void> {
  // 創建 food_images 表：記錄用戶上傳的食物圖片
  if (!(await knex.schema.hasTable("food_images"))) {
    await knex.schema.createTable("food_images", (table) => {
      table.increments("id").primary();
      table.string("bill_id", 64).notNullable().references("bill.id");
      table.string("user_id", 64).nullable().references("user.id");
      table.string("original_filename", 255).notNullable();
      table.string("stored_path", 512).notNullable();
      table.string("original_path", 512).nullable();
      table.integer("file_size").nullable();
      table.integer("width").nullable();
      table.integer("height").nullable();
      table.integer("recognition_status").notNullable().defaultTo(0);
      table.text("recognition_result").nullable();
      table.text("recognition_error").nullable();
      table.string("recognition_at", 64).nullable();
      table.string("created_at", 64).notNullable();
      table.string("updated_at", 64).notNullable();

      // 索引
      table.index("bill_id");
      table.index("user_id");
      table.index("recognition_status");
      table.index("created_at");
    });
  }

  // 創建 food_api_usage 表：記錄百度 API 使用量
  if (!(await knex.schema.hasTable("food_api_usage"))) {
    await knex.schema.createTable("food_api_usage", (table) => {
      table.increments("id").primary();
      table.integer("food_image_id").nullable().references("food_images.id");
      table.string("user_id", 64).nullable().references("user.id");
      table.string("request_type", 64).notNullable().defaultTo("dish_recognition");
      table.integer("success").notNullable();
      table.text("response_data").nullable();
      table.text("error_message").nullable();
      table.string("created_at", 64).notNullable();
      table.string("updated_at", 64).notNullable();

      // 索引
      table.index("food_image_id");
      table.index("user_id");
      table.index("success");
      table.index("created_at");
    });
  }
}

// prettier-ignore
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("food_api_usage");
  await knex.schema.dropTableIfExists("food_images");
}

