# Check environment variables script
# Verify TensorFlow.js build environment setup

Write-Host "Checking environment variables..." -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check Node.js
Write-Host "Node.js Check:" -ForegroundColor Yellow
$nodePath = Get-Command node -ErrorAction SilentlyContinue
$npmPath = Get-Command npm -ErrorAction SilentlyContinue

if ($nodePath) {
    Write-Host "   [OK] node: $($nodePath.Source)" -ForegroundColor Green
    $nodeVersion = & node --version
    Write-Host "       Version: $nodeVersion" -ForegroundColor Gray
} else {
    Write-Host "   [FAIL] node not found" -ForegroundColor Red
    $allGood = $false
}

if ($npmPath) {
    Write-Host "   [OK] npm: $($npmPath.Source)" -ForegroundColor Green
    $npmVersion = & npm --version
    Write-Host "       Version: $npmVersion" -ForegroundColor Gray
} else {
    Write-Host "   [FAIL] npm not found" -ForegroundColor Red
    $allGood = $false
}

Write-Host ""

# Check Visual Studio tools
Write-Host "Visual Studio Tools Check:" -ForegroundColor Yellow

$clPath = Get-Command cl -ErrorAction SilentlyContinue
$msbuildPath = Get-Command msbuild -ErrorAction SilentlyContinue
$linkPath = Get-Command link -ErrorAction SilentlyContinue

if ($clPath) {
    Write-Host "   [OK] cl (compiler): $($clPath.Source)" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] cl (compiler) not found" -ForegroundColor Red
    $allGood = $false
}

if ($msbuildPath) {
    Write-Host "   [OK] msbuild: $($msbuildPath.Source)" -ForegroundColor Green
} else {
    Write-Host "   [WARN] msbuild not found (may not be required)" -ForegroundColor Yellow
}

if ($linkPath) {
    Write-Host "   [OK] link (linker): $($linkPath.Source)" -ForegroundColor Green
} else {
    Write-Host "   [WARN] link (linker) not found (may not be required)" -ForegroundColor Yellow
}

Write-Host ""

# Check environment variables
Write-Host "Environment Variables Check:" -ForegroundColor Yellow

$envVars = @(
    @{Name = "VSINSTALLDIR"; Required = $true},
    @{Name = "VCINSTALLDIR"; Required = $true},
    @{Name = "VCToolsInstallDir"; Required = $false},
    @{Name = "WindowsSdkDir"; Required = $false},
    @{Name = "WindowsSDKVersion"; Required = $false}
)

foreach ($envVar in $envVars) {
    $value = [System.Environment]::GetEnvironmentVariable($envVar.Name, "Process")
    if (-not $value) {
        $value = [System.Environment]::GetEnvironmentVariable($envVar.Name, "Machine")
    }
    if (-not $value) {
        $value = [System.Environment]::GetEnvironmentVariable($envVar.Name, "User")
    }
    
    if ($value) {
        $status = if ($envVar.Required) { "[OK]" } else { "[OK]" }
        $color = if ($envVar.Required) { "Green" } else { "Gray" }
        Write-Host "   $status $($envVar.Name): $value" -ForegroundColor $color
    } else {
        if ($envVar.Required) {
            Write-Host "   [FAIL] $($envVar.Name): not set" -ForegroundColor Red
            $allGood = $false
        } else {
            Write-Host "   [WARN] $($envVar.Name): not set (optional)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""

# Check npm config
Write-Host "npm Config Check:" -ForegroundColor Yellow

$msvsVersion = npm config get msvs_version 2>$null
$msvsPath = npm config get msvs_path 2>$null

if ($msvsVersion -and $msvsVersion -ne "null") {
    Write-Host "   [OK] msvs_version: $msvsVersion" -ForegroundColor Green
} else {
    Write-Host "   [WARN] msvs_version: not set (recommended: 2022)" -ForegroundColor Yellow
}

if ($msvsPath -and $msvsPath -ne "null") {
    Write-Host "   [OK] msvs_path: $msvsPath" -ForegroundColor Green
} else {
    Write-Host "   [WARN] msvs_path: not set" -ForegroundColor Yellow
}

Write-Host ""

# Summary
if ($allGood) {
    Write-Host "[SUCCESS] All required environment variables are set correctly!" -ForegroundColor Green
    Write-Host "   You can now try building TensorFlow.js:" -ForegroundColor Gray
    Write-Host "   npm rebuild @tensorflow/tfjs-node --build-addon-from-source" -ForegroundColor Cyan
} else {
    Write-Host "[FAIL] Some required environment variables are not set or tools not found" -ForegroundColor Red
    Write-Host "   Please refer to docs/MANUAL_ENV_SETUP.md for setup instructions" -ForegroundColor Yellow
}

Write-Host ""
