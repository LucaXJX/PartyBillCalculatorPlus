import { Knex } from "knex";

// prettier-ignore
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("llm_api_usage"))) {
    await knex.schema.createTable("llm_api_usage", (table) => {
      table.increments("id").primary();
      table.string("user_id", 64).nullable();
      table.string("request_type", 64).notNullable();
      table.integer("tokens_used").nullable();
      table.decimal("cost", 10, 4).nullable();
      table.integer("success").notNullable(); // SQLite 使用 integer 表示 boolean
      table.text("error_message").nullable();
      table.timestamps(false, true);

      // 可選：添加外鍵約束（如果 users 表存在）
      // table.foreign("user_id").references("id").inTable("user");
    });
  }
}

// prettier-ignore
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("llm_api_usage");
}

