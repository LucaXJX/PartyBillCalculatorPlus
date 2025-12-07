# 直接構建 TensorFlow.js

## 重要說明

`msvs_version` 和 `msvs_path` **不是 npm 的標準配置選項**，不需要設置！

由於你已經在系統環境變量中設置了：
- `VSINSTALLDIR`
- `VCINSTALLDIR`
- `VCToolsInstallDir`
- `WindowsSdkDir`
- `WindowsSDKVersion`

**node-gyp 會自動找到 Visual Studio**，不需要額外的 npm config 設置。

## 直接構建

### 在命令提示符（CMD）中運行

```cmd
cd E:\42_Coding\PartyBillCalculator
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

就是這麼簡單！環境變量已經設置好了，直接構建即可。

## 構建過程

- 構建需要 **5-15 分鐘**
- CPU 使用率會很高（這是正常的）
- 會看到很多編譯輸出（這是正常的）
- **請不要中斷**構建過程

## 構建完成後

構建成功後，運行驗證：

```cmd
npm run test:tensorflow
```

應該顯示：
```
✅ TensorFlow.js 可以正常使用！
```

## 如果構建失敗

如果構建失敗，請：
1. 保存完整的錯誤信息
2. 檢查錯誤日誌
3. 確認環境變量是否正確設置（運行 `echo %VSINSTALLDIR%`）

## 可選：設置 node-gyp 配置（如果構建失敗）

如果直接構建失敗，可以嘗試設置 node-gyp 配置：

### 方法 1：通過環境變量（推薦）

在命令提示符中設置（僅對當前會話有效）：

```cmd
set GYP_MSVS_VERSION=2022
set GYP_MSVS_OVERRIDE_PATH=D:\Program Files\Microsoft Visual Studio\18\Community
```

然後運行構建：

```cmd
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

### 方法 2：通過 .npmrc 文件

在項目根目錄創建或編輯 `.npmrc` 文件，添加：

```
msvs_version=2022
```

但這通常不需要，因為環境變量已經設置好了。

## 推薦流程

**最簡單的方法**：直接構建！

```cmd
cd E:\42_Coding\PartyBillCalculator
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

環境變量已經設置好了，node-gyp 會自動找到 Visual Studio。

