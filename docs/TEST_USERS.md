# 測試用戶列表

## 現有用戶（4 個）

1. **testuser** - test@example.com / 123456
2. **adaY** - ada@ede.com / 123456
3. **a** - a@ede.com / 123456
4. **testuser2** - test2@example.com / 123456

## 新增測試用戶（20 個）

所有新用戶的密碼都是：`password123`

### 用戶列表

5. **alice_wong** - alice.wong@email.com
6. **bob_lee** - bob.lee@email.com
7. **charlie_chan** - charlie.chan@email.com
8. **diana_liu** - diana.liu@email.com
9. **edward_zhang** - edward.zhang@email.com
10. **fiona_chen** - fiona.chen@email.com
11. **george_wang** - george.wang@email.com
12. **helen_li** - helen.li@email.com
13. **ivan_huang** - ivan.huang@email.com
14. **julia_lin** - julia.lin@email.com
15. **kevin_zhou** - kevin.zhou@email.com
16. **lisa_wu** - lisa.wu@email.com
17. **mike_xu** - mike.xu@email.com
18. **nancy_ma** - nancy.ma@email.com
19. **oscar_liu** - oscar.liu@email.com
20. **penny_gao** - penny.gao@email.com
21. **quincy_ye** - quincy.ye@email.com
22. **rachel_he** - rachel.he@email.com
23. **steve_guo** - steve.guo@email.com
24. **tina_liang** - tina.liang@email.com
25. **ulrich_wei** - ulrich.wei@email.com

## 測試建議

### 快速測試

- 使用 **alice_wong** / alice.wong@email.com / password123 進行快速測試
- 使用 **bob_lee** / bob.lee@email.com / password123 進行對比測試

### 功能測試

1. **用戶隔離測試**：使用不同用戶登入，確認數據完全隔離
2. **參與者管理測試**：每個用戶添加不同的參與者，確認不會互相影響
3. **賬單計算測試**：使用不同用戶創建賬單，確認計算結果正確
4. **會話管理測試**：測試登入、登出、會話過期等功能

### 數據驗證

- 所有用戶都有唯一的 ID
- 所有郵箱地址都是唯一的
- 創建時間按順序遞增
- 密碼統一為 `password123`（便於測試）

## 注意事項

- 這些是測試用戶，密碼較為簡單
- 在生產環境中應該使用更複雜的密碼
- 建議定期清理測試數據
