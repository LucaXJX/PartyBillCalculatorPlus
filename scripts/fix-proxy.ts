import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const proxyPath = path.join(__dirname, '../server/proxy.ts')

// 讀取 proxy.ts 文件
let content = fs.readFileSync(proxyPath, 'utf8')

let changed = false

// 修復 1: 將 Bill 類型中的 created_by?: User 改為 creator?: User
// 匹配格式：created_by: string\n  created_by?: User 或 created_by: string\ncreated_by?: User
if (content.includes('created_by: string') && content.includes('created_by?: User')) {
  content = content.replace(
    /(created_by: string)\s*\n\s*(created_by\?: User)/g,
    '$1\n  creator?: User'
  )
  changed = true
}

// 修復 2: 將 message 中的 sender?: Null 改為 sender?: User | null
// 同時修復 sender_id 的類型為 null | string
if (content.includes('sender?: Null')) {
  content = content.replace(
    /(sender_id: )string\s*\n\s*sender\?: Null/g,
    '$1null | string\n  sender?: User | null'
  )
  changed = true
}

// 修復 3: 將 tableFields 中的 table: "null" 或 table: 'null' 改為 table: "user"
// 處理所有引號變體（單引號和雙引號），使用更寬鬆的匹配
// 先嘗試簡單的全局替換
if (content.includes("table: 'null'") || content.includes('table: "null"') || content.match(/table:\s*['"]null['"]/)) {
  // 匹配所有 table: 'null' 或 table: "null"（但僅限於 sender 相關的）
  content = content.replace(
    /table:\s*'null'/g,
    "table: 'user'"
  )
  content = content.replace(
    /table:\s*"null"/g,
    'table: "user"'
  )
  changed = true
}

// 修復 4: 將 tableFields 中的 'created_by' 改為 'creator' 以匹配類型定義
if (content.includes("['created_by', { field: 'created_by'")) {
  content = content.replace(
    /(\[')created_by(', \{ field: 'created_by', table: 'user' \}\])/g,
    "$1creator$2"
  )
  content = content.replace(
    /(\[\")created_by(\", \{ field: \"created_by\", table: \"user\" \}\])/g,
    '$1creator$2'
  )
  changed = true
}

// 寫回文件
if (changed) {
  fs.writeFileSync(proxyPath, content, 'utf8')
  console.log('✅ 已修復 proxy.ts 中的問題')
} else {
  console.log('ℹ️  proxy.ts 無需修復')
}

