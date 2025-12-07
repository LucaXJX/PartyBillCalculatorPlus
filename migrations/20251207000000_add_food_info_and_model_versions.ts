import { Knex } from "knex";

// prettier-ignore
export async function up(knex: Knex): Promise<void> {
  // 創建 food_info 表：存儲食物詳細信息
  if (!(await knex.schema.hasTable("food_info"))) {
    await knex.schema.createTable("food_info", (table) => {
      table.string("id", 64).primary();
      table.string("name", 255).notNullable();
      table.string("name_en", 255).nullable();
      table.string("country", 50).notNullable();
      table.string("category", 100).nullable();
      table.integer("calories").nullable();
      table.decimal("protein", 5, 2).nullable();
      table.decimal("fat", 5, 2).nullable();
      table.decimal("carbs", 5, 2).nullable();
      table.text("ingredients").nullable();
      table.text("description").nullable();
      table.string("image_url", 512).nullable();
      table.string("created_at", 64).notNullable();
      table.string("updated_at", 64).notNullable();

      // 索引
      table.index("name");
      table.index("country");
      table.index("category");
    });
  }

  // 創建 model_versions 表：追蹤模型版本信息
  if (!(await knex.schema.hasTable("model_versions"))) {
    await knex.schema.createTable("model_versions", (table) => {
      table.string("id", 64).primary();
      table.integer("level").notNullable();
      table.string("country", 50).nullable();
      table.string("version", 50).notNullable();
      table.string("model_path", 512).notNullable();
      table.decimal("accuracy", 5, 2).nullable();
      table.string("training_date", 64).nullable();
      table.integer("is_active").defaultTo(0);
      table.string("created_at", 64).notNullable();

      // 索引
      table.index("level");
      table.index("country");
      table.index("is_active");
      table.index("training_date");
    });
  }
}

// prettier-ignore
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("model_versions");
  await knex.schema.dropTableIfExists("food_info");
}

