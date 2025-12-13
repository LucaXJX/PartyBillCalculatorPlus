/**
 * 添加 source_url 字段到 restaurant 表
 */

import { db } from "../server/db.js";

try {
  console.log("🔧 正在添加 source_url 字段到 restaurant 表...");
  
  // 檢查字段是否已存在
  const tableInfo = db.prepare("PRAGMA table_info(restaurant)").all() as any[];
  const hasSourceUrl = tableInfo.some((col: any) => col.name === "source_url");
  
  if (hasSourceUrl) {
    console.log("✅ source_url 字段已存在，跳過添加");
  } else {
    // 添加字段
    db.prepare("ALTER TABLE restaurant ADD COLUMN source_url varchar(512) NULL").run();
    console.log("✅ 已成功添加 source_url 字段");
  }
  
  // 驗證
  const newTableInfo = db.prepare("PRAGMA table_info(restaurant)").all() as any[];
  const sourceUrlColumn = newTableInfo.find((col: any) => col.name === "source_url");
  if (sourceUrlColumn) {
    console.log(`✅ 驗證成功：source_url 字段類型為 ${sourceUrlColumn.type}`);
  }
  
  console.log("🎉 完成！");
} catch (error) {
  console.error("❌ 添加字段失敗:", error);
  if (error instanceof Error) {
    console.error("錯誤詳情:", error.message);
  }
  process.exit(1);
}


