# TensorFlow.js 構建腳本 (PowerShell)
# 使用 Visual Studio Developer Command Prompt 環境

Write-Host "🔧 設置 Visual Studio 環境變量..." -ForegroundColor Cyan

# Visual Studio 環境設置腳本路徑
$vsDevCmdPath = "D:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat"

if (-not (Test-Path $vsDevCmdPath)) {
    Write-Host "❌ 無法找到 Visual Studio 環境設置腳本" -ForegroundColor Red
    Write-Host "請確認 Visual Studio 已安裝在: D:\Program Files\Microsoft Visual Studio\18\Community" -ForegroundColor Yellow
    exit 1
}

# 調用 Visual Studio Developer Command Prompt 環境設置
# 注意：PowerShell 需要通過 cmd 來調用 .bat 文件
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# 執行 VsDevCmd.bat 並獲取環境變量
$tempFile = [System.IO.Path]::GetTempFileName()
cmd /c "`"$vsDevCmdPath`" && set > `"$tempFile`""

# 讀取環境變量
Get-Content $tempFile | ForEach-Object {
    if ($_ -match "^([^=]+)=(.*)$") {
        $name = $matches[1]
        $value = $matches[2]
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
        Set-Item -Path "env:$name" -Value $value
    }
}

Remove-Item $tempFile

Write-Host "✅ Visual Studio 環境已加載" -ForegroundColor Green

# 確保 Node.js 在 PATH 中
$npmPath = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmPath) {
    Write-Host "⚠️  在 PATH 中未找到 npm，嘗試添加 Node.js 路徑..." -ForegroundColor Yellow
    
    $nodePaths = @(
        "C:\Program Files\nodejs",
        "C:\Program Files (x86)\nodejs",
        "$env:ProgramFiles\nodejs",
        "$env:ProgramFiles(x86)\nodejs"
    )
    
    $found = $false
    foreach ($nodePath in $nodePaths) {
        if (Test-Path "$nodePath\npm.cmd") {
            $env:Path = "$nodePath;$env:Path"
            Write-Host "✅ 已添加 Node.js 路徑: $nodePath" -ForegroundColor Green
            $found = $true
            break
        }
    }
    
    if (-not $found) {
        Write-Host "❌ 無法找到 npm，請確認 Node.js 已安裝" -ForegroundColor Red
        Write-Host "請手動將 Node.js 添加到 PATH，或使用完整路徑運行 npm" -ForegroundColor Yellow
        exit 1
    }
}

# 驗證 npm 可用
$npmPath = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmPath) {
    Write-Host "❌ npm 仍然不可用" -ForegroundColor Red
    Write-Host "當前 PATH: $env:Path" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ npm 已找到: $($npmPath.Source)" -ForegroundColor Green

# 切換到項目目錄
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Join-Path $scriptPath ".."
Set-Location $projectRoot

Write-Host ""
Write-Host "🔨 開始構建 TensorFlow.js..." -ForegroundColor Cyan
Write-Host ""

# 運行構建
$buildResult = & npm rebuild @tensorflow/tfjs-node --build-addon-from-source

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ 構建失敗" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ 構建完成！" -ForegroundColor Green
Write-Host ""

Write-Host "驗證構建結果..." -ForegroundColor Cyan
$bindingPath = Join-Path $projectRoot "node_modules\@tensorflow\tfjs-node\lib\napi-v8\tfjs_binding.node"
if (Test-Path $bindingPath) {
    Write-Host "✅ TensorFlow.js native 模塊已成功構建" -ForegroundColor Green
    $fileInfo = Get-Item $bindingPath
    Write-Host "   文件: $bindingPath" -ForegroundColor Gray
    Write-Host "   大小: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Gray
} else {
    Write-Host "⚠️  未找到構建文件，構建可能失敗" -ForegroundColor Yellow
    exit 1
}
