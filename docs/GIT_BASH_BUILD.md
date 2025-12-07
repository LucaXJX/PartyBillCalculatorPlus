# 在 Git Bash 中構建 TensorFlow.js

## 問題

在 Git Bash 中運行 `pnpm rebuild @tensorflow/tfjs-node` 時，即使已安裝 Visual Studio，仍然報錯找不到 Visual Studio。

## 原因

Git Bash 不會自動設置 Visual Studio 的環境變量，而 node-gyp 需要這些環境變量來找到 Visual Studio。

## 解決方案

### 方案 1：使用構建腳本（推薦）

運行自動構建腳本，它會自動設置環境變量：

```bash
bash scripts/build-tensorflow.sh
```

或使用 npm 腳本：

```bash
npm run build:tensorflow
```

### 方案 2：手動設置環境變量

在 Git Bash 中手動設置環境變量：

```bash
# 設置 Visual Studio 路徑
export VSINSTALLDIR="/d/Program Files/Microsoft Visual Studio/18/Community"
export VCINSTALLDIR="$VSINSTALLDIR/VC"

# 設置 npm config（node-gyp 會讀取）
npm config set msvs_version 2022
npm config set msvs_path "D:\\Program Files\\Microsoft Visual Studio\\18\\Community"

# 運行構建
cd /e/42_Coding/PartyBillCalculator
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

### 方案 3：使用 Developer Command Prompt（最可靠）

**這是最推薦的方法**，因為 Developer Command Prompt 會自動設置所有必要的環境變量。

1. **打開 Developer Command Prompt**
   - 在 Windows 開始菜單搜索 "Developer Command Prompt for VS"
   - 或導航到：`D:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat`

2. **在 Developer Command Prompt 中運行**

   ```cmd
   cd E:\42_Coding\PartyBillCalculator
   pnpm rebuild @tensorflow/tfjs-node
   ```

   或使用 npm：

   ```cmd
   npm rebuild @tensorflow/tfjs-node --build-addon-from-source
   ```

## 驗證構建成功

構建成功後，運行診斷腳本：

```bash
npm run test:tensorflow
```

應該顯示：

```
✅ TensorFlow.js 可以正常使用！
```

## 為什麼 Developer Command Prompt 更好？

Developer Command Prompt 會：
- ✅ 自動設置所有 Visual Studio 環境變量
- ✅ 設置正確的 PATH
- ✅ 設置編譯器路徑
- ✅ 設置 SDK 路徑

這比手動設置環境變量更可靠。

## 如果仍然失敗

1. **確認 Visual Studio 安裝**
   - 檢查 `D:\Program Files\Microsoft Visual Studio\18\Community` 是否存在
   - 確認已安裝 "Desktop development with C++" 工作負載

2. **檢查 Node.js 版本**
   ```bash
   node -v
   ```
   確保使用 Node.js 18+ 和 64 位版本

3. **清理並重新構建**
   ```bash
   pnpm remove @tensorflow/tfjs-node
   pnpm install @tensorflow/tfjs-node
   npm rebuild @tensorflow/tfjs-node --build-addon-from-source
   ```

4. **查看詳細錯誤**
   構建過程可能需要幾分鐘，注意查看是否有其他錯誤信息。

