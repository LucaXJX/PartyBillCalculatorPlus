import { Knex } from "knex";

// prettier-ignore
export async function up(knex: Knex): Promise<void> {
  // 創建 restaurant 表：餐廳基本信息
  if (!(await knex.schema.hasTable("restaurant"))) {
    await knex.schema.createTable("restaurant", (table) => {
      table.string("id", 64).primary();
      table.string("name", 255).notNullable();
      table.string("name_en", 255).nullable();
      table.text("description").nullable();
      table.string("cuisine_type", 100).nullable(); // 菜系類型：中餐、日料、西餐等
      table.string("price_range", 10).nullable(); // 價位：$, $$, $$$, $$$$
      table.decimal("rating", 3, 2).nullable(); // 評分：0.00-5.00
      table.integer("review_count").defaultTo(0); // 評論數量
      table.string("address", 512).nullable();
      table.string("city", 100).nullable();
      table.decimal("latitude", 10, 8).nullable(); // 緯度（用於距離計算）
      table.decimal("longitude", 11, 8).nullable(); // 經度（用於距離計算）
      table.string("phone", 50).nullable();
      table.string("website", 512).nullable();
      table.string("image_url", 512).nullable();
      table.text("tags").nullable(); // JSON 格式：["適合聚會", "安靜", "浪漫"]
      table.integer("is_active").defaultTo(1); // 是否啟用
      table.string("created_at", 64).notNullable();
      table.string("updated_at", 64).notNullable();

      // 索引
      table.index("name");
      table.index("cuisine_type");
      table.index("city");
      table.index("rating");
      table.index("is_active");
      table.index("created_at");
    });
  }

  // 創建 user_restaurant_preference 表：用戶對餐廳的偏好
  if (!(await knex.schema.hasTable("user_restaurant_preference"))) {
    await knex.schema.createTable("user_restaurant_preference", (table) => {
      table.string("id", 64).primary();
      table.string("user_id", 64).notNullable().references("user.id");
      table.string("restaurant_id", 64).notNullable().references("restaurant.id");
      table.string("preference", 20).notNullable(); // like, dislike, favorite
      table.string("created_at", 64).notNullable();
      table.string("updated_at", 64).notNullable();

      // 唯一約束：每個用戶對每個餐廳只能有一個偏好記錄
      table.unique(["user_id", "restaurant_id"]);

      // 索引
      table.index("user_id");
      table.index("restaurant_id");
      table.index("preference");
      table.index("created_at");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("user_restaurant_preference");
  await knex.schema.dropTableIfExists("restaurant");
}





