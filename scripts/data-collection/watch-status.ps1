# PowerShell 版本：定期檢查數據處理狀態

param(
    [int]$Interval = 30  # 默認 30 秒
)

Write-Host "📊 開始監控數據處理狀態（每 ${Interval} 秒檢查一次）" -ForegroundColor Cyan
Write-Host "按 Ctrl+C 停止監控" -ForegroundColor Yellow
Write-Host ""

while ($true) {
    Clear-Host
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "檢查時間: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    pnpm run data:status
    Write-Host ""
    Write-Host "下次檢查: ${Interval} 秒後（按 Ctrl+C 停止）" -ForegroundColor Yellow
    Start-Sleep -Seconds $Interval
}


