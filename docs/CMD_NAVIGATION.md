# Windows CMD 導航指南

## 問題

在 CMD 中，`cd` 命令無法切換到不同驅動器的目錄。

## 原因

在 Windows CMD 中，`cd` 命令只能在當前驅動器內切換目錄。要切換到不同驅動器，需要先切換驅動器。

## 解決方案

### 方法 1：先切換驅動器，再切換目錄（推薦）

```cmd
E:
cd E:\42_Coding\PartyBillCalculator
```

或分步執行：

```cmd
E:
cd 42_Coding\PartyBillCalculator
```

### 方法 2：使用 /d 參數（推薦）

```cmd
cd /d E:\42_Coding\PartyBillCalculator
```

`/d` 參數會同時切換驅動器和目錄。

### 方法 3：使用 pushd 命令

```cmd
pushd E:\42_Coding\PartyBillCalculator
```

`pushd` 會自動切換驅動器並記住原位置，之後可以用 `popd` 返回。

## 完整構建命令序列

### 使用 /d 參數（最簡單）

```cmd
cd /d E:\42_Coding\PartyBillCalculator
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

### 或分步執行

```cmd
E:
cd 42_Coding\PartyBillCalculator
npm rebuild @tensorflow/tfjs-node --build-addon-from-source
```

## 驗證當前目錄

切換後，可以運行以下命令驗證：

```cmd
cd
```

或

```cmd
echo %CD%
```

應該顯示：

```
E:\42_Coding\PartyBillCalculator
```

## 常見問題

### 問題 1：提示 "系統找不到指定的路徑"

**可能原因**：

- 路徑不存在
- 路徑中有錯誤

**解決方案**：

1. 確認路徑正確
2. 使用文件資源管理器檢查路徑是否存在
3. 注意路徑中的大小寫（Windows 通常不區分，但最好保持一致）

### 問題 2：提示 "無效的驅動器規格"

**可能原因**：

- E: 驅動器不存在或未連接

**解決方案**：

1. 確認 E: 驅動器存在
2. 如果不存在，使用實際的驅動器號（如 C: 或 D:）

## 快速參考

| 命令            | 說明                   |
| --------------- | ---------------------- |
| `cd /d E:\path` | 切換驅動器和目錄       |
| `E:`            | 切換到 E: 驅動器       |
| `cd path`       | 在當前驅動器內切換目錄 |
| `pushd path`    | 切換並記住位置         |
| `popd`          | 返回 pushd 之前的位置  |
