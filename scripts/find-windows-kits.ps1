# 查找 Windows Kits 路徑和版本號腳本

Write-Host "🔍 查找 Windows Kits 安裝位置和版本號..." -ForegroundColor Cyan
Write-Host ""

# 可能的安裝位置
$possiblePaths = @(
    "D:\Windows Kits\10",
    "C:\Program Files (x86)\Windows Kits\10",
    "C:\Program Files\Windows Kits\10"
)

$foundPath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $foundPath = $path
        Write-Host "✅ 找到 Windows Kits: $path" -ForegroundColor Green
        break
    }
}

if (-not $foundPath) {
    Write-Host "❌ 未找到 Windows Kits 安裝" -ForegroundColor Red
    Write-Host "   請確認已安裝 Windows SDK" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 查找 bin 目錄下的版本號
$binPath = Join-Path $foundPath "bin"
if (Test-Path $binPath) {
    Write-Host "📦 bin 目錄下的版本號:" -ForegroundColor Yellow
    $versions = Get-ChildItem -Path $binPath -Directory | Where-Object { $_.Name -match "^10\.0\." } | Sort-Object Name -Descending
    
    if ($versions) {
        foreach ($version in $versions) {
            $x64Path = Join-Path $version.FullName "x64"
            $hasX64 = Test-Path $x64Path
            $status = if ($hasX64) { "✅" } else { "⚠️ " }
            Write-Host "   $status $($version.Name)" -ForegroundColor $(if ($hasX64) { "Green" } else { "Yellow" })
            if ($hasX64) {
                Write-Host "      路徑: $x64Path" -ForegroundColor Gray
            }
        }
        
        $latestVersion = $versions[0]
        Write-Host ""
        Write-Host "📌 推薦使用最新版本: $($latestVersion.Name)" -ForegroundColor Cyan
        Write-Host "   PATH 應添加: $(Join-Path $latestVersion.FullName "x64")" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  未找到版本號目錄" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  未找到 bin 目錄" -ForegroundColor Yellow
}

Write-Host ""

# 查找 Include 目錄下的版本號
$includePath = Join-Path $foundPath "Include"
if (Test-Path $includePath) {
    Write-Host "📦 Include 目錄下的版本號:" -ForegroundColor Yellow
    $versions = Get-ChildItem -Path $includePath -Directory | Where-Object { $_.Name -match "^10\.0\." } | Sort-Object Name -Descending
    
    if ($versions) {
        foreach ($version in $versions) {
            Write-Host "   ✅ $($version.Name)" -ForegroundColor Green
        }
        
        $latestVersion = $versions[0]
        Write-Host ""
        Write-Host "📌 最新版本: $($latestVersion.Name)" -ForegroundColor Cyan
        Write-Host "   WindowsSDKVersion 應設置為: $($latestVersion.Name)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  未找到版本號目錄" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  未找到 Include 目錄" -ForegroundColor Yellow
}

Write-Host ""

# 總結
Write-Host "📋 設置建議:" -ForegroundColor Cyan
Write-Host "   1. WindowsSdkDir: $foundPath" -ForegroundColor Gray
if ($versions) {
    Write-Host "   2. WindowsSDKVersion: $($versions[0].Name)" -ForegroundColor Gray
    Write-Host "   3. PATH 添加: $(Join-Path (Join-Path $foundPath "bin") "$($versions[0].Name)\x64")" -ForegroundColor Gray
}

