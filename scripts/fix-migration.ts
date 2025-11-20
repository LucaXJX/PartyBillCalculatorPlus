import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 獲取最新的 migration 文件
const migrationsDir = path.join(__dirname, '../migrations')
if (!fs.existsSync(migrationsDir)) {
  console.log('⚠️  migrations 目錄不存在')
  process.exit(1)
}

const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.ts') && f.includes('auto-migrate'))
  .sort()
  .reverse()

if (files.length === 0) {
  console.log('⚠️  沒有找到 migration 文件')
  console.log('💡 提示：請先運行 npm run db:plan 生成 migration 文件')
  process.exit(0)
}

const latestMigration = files[0]
const migrationPath = path.join(migrationsDir, latestMigration)

console.log(`📝 修復 migration 文件: ${latestMigration}`)

let content = fs.readFileSync(migrationPath, 'utf8')
let changed = false

// 修復 1: 將所有 table.increments('id') 改為 table.string('id', 64).primary()
// 因為 erd.txt 中定義的是 varchar(64) PK
if (content.includes("table.increments('id')")) {
  content = content.replace(
    /table\.increments\('id'\)/g,
    "table.string('id', 64).primary()"
  )
  changed = true
}

// 修復 2: 確保 sender_id 是 nullable 且引用 user.id（而不是 null.id）
if (content.includes("sender_id") && content.includes(".notNullable().references('user.id')")) {
  content = content.replace(
    /table\.string\('sender_id',\s*64\)\.unsigned\(\)\.notNullable\(\)\.references\('user\.id'\)/g,
    "table.string('sender_id', 64).unsigned().nullable().references('user.id')"
  )
  changed = true
}

// 寫回文件
if (changed) {
  fs.writeFileSync(migrationPath, content, 'utf8')
  console.log('✅ 已修復 migration 文件')
} else {
  console.log('ℹ️  migration 文件無需修復')
}

