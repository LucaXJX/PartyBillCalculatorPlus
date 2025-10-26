# 測試用戶列表

## 密碼要求

所有測試用戶的密碼都符合以下要求：
- **至少 8 個字符**
- **包含大小寫字母、數字和特殊字符**
- **便於測試記憶**

## 統一測試配置

為了便於測試，所有用戶使用相同的配置：
- **統一密碼**: `Test123!`
- **統一郵箱後綴**: `@test.com`

## 測試用戶列表（21 個）

### 用戶信息

| 序號 | 用戶名 | 郵箱 | 密碼 | 賬單數量 |
|------|--------|------|------|----------|
| 1 | alice_wong | alice.wong@test.com | Test123! | 10+ |
| 2 | bob_lee | bob.lee@test.com | Test123! | 10+ |
| 3 | charlie_chan | charlie.chan@test.com | Test123! | 10+ |
| 4 | diana_liu | diana.liu@test.com | Test123! | 10+ |
| 5 | edward_zhang | edward.zhang@test.com | Test123! | 10+ |
| 6 | fiona_chen | fiona.chen@test.com | Test123! | 10+ |
| 7 | george_wang | george.wang@test.com | Test123! | 10+ |
| 8 | helen_li | helen.li@test.com | Test123! | 10+ |
| 9 | ivan_huang | ivan.huang@test.com | Test123! | 10+ |
| 10 | julia_lin | julia.lin@test.com | Test123! | 10+ |
| 11 | kevin_zhou | kevin.zhou@test.com | Test123! | 10+ |
| 12 | lisa_wu | lisa.wu@test.com | Test123! | 10+ |
| 13 | mike_xu | mike.xu@test.com | Test123! | 10+ |
| 14 | nancy_ma | nancy.ma@test.com | Test123! | 10+ |
| 15 | oscar_liu | oscar.liu@test.com | Test123! | 10+ |
| 16 | penny_gao | penny.gao@test.com | Test123! | 10+ |
| 17 | quincy_ye | quincy.ye@test.com | Test123! | 10+ |
| 18 | rachel_he | rachel.he@test.com | Test123! | 10+ |
| 19 | steve_guo | steve.guo@test.com | Test123! | 10+ |
| 20 | tina_liang | tina.liang@test.com | Test123! | 10+ |
| 21 | ulrich_wei | ulrich.wei@test.com | Test123! | 10+ |

## 測試數據統計

- **總用戶數**: 21 個
- **總賬單數**: 220+ 個
- **平均每用戶賬單數**: 10+ 個
- **數據時間範圍**: 過去 90 天內
- **賬單類型**: 聚餐、KTV、燒烤、電影、購物等 20 種不同場景

## 測試建議

### 快速測試

- 使用 **alice_wong** / alice.wong@test.com / Test123! 進行快速測試
- 使用 **bob_lee** / bob.lee@test.com / Test123! 進行對比測試

### 功能測試場景

1. **用戶隔離測試**
   - 使用不同用戶登入，確認數據完全隔離
   - 每個用戶只能看到自己創建或參與的賬單

2. **參與者管理測試**
   - 每個用戶都有多個不同的參與者組合
   - 測試添加、刪除參與者功能

3. **賬單計算測試**
   - 測試共享項目和個人項目的計算
   - 測試不同小費百分比的計算
   - 驗證支付狀態的更新

4. **會話管理測試**
   - 測試登入、登出功能
   - 測試會話過期處理
   - 測試多設備登入

5. **支付流程測試**
   - 測試標記支付狀態
   - 測試上傳收據功能
   - 測試確認收款功能

### 演示建議

1. **展示用戶隔離**
   - 使用 alice_wong 登入，展示她的賬單
   - 切換到 bob_lee，展示完全不同的賬單列表

2. **展示賬單多樣性**
   - 展示不同類型的聚餐場景
   - 展示不同參與者數量的賬單
   - 展示不同支付狀態的賬單

3. **展示計算功能**
   - 選擇一個複雜的賬單，展示計算結果
   - 展示共享項目和個人項目的分配
   - 展示小費計算

## 數據特點

### 真實性
- 使用真實的餐廳名稱和活動類型
- 合理的價格範圍和消費項目
- 真實的時間分布（過去 90 天）

### 多樣性
- 20 種不同的餐廳和活動類型
- 3-5 人的不同參與者組合
- 不同的支付狀態分布（約 60% 已支付）

### 關聯性
- 用戶之間有相互的賬單關係
- 每個用戶既是創建者也是參與者
- 模擬真實的社交聚餐場景

## 注意事項

- 這些是測試用戶，密碼雖然符合要求但相對簡單
- 在生產環境中應該使用更複雜的密碼
- 建議定期清理和更新測試數據
- 所有數據都是模擬數據，不涉及真實個人信息

## 數據更新

如需更新測試數據，可以運行：
```bash
# 統一用戶密碼和郵箱
node scripts/unify-test-users.js

# 重新生成測試賬單數據
node scripts/generate-test-data.js
```

這將重新生成所有測試賬單數據，保持用戶數據不變。