# watch_logs.ps1
# Opens separate PowerShell windows to tail each MPI rank's log file.
# Usage: .\scripts\watch_logs.ps1
# Run this AFTER starting `mpiexec -n 5 python main.py`

$logDir = Join-Path $PSScriptRoot "..\logs"

# Master log
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '=== MASTER (Rank 0) ===' -ForegroundColor Cyan; Get-Content '$logDir\master.log' -Wait -Tail 50"

# Worker logs  
for ($i = 1; $i -le 4; $i++) {
    $color = @("Green", "Yellow", "Magenta", "Red")[$i - 1]
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '=== WORKER Rank $i ===' -ForegroundColor $color; Get-Content '$logDir\worker_$i.log' -Wait -Tail 50"
}

Write-Host "Opened 5 log windows (1 Master + 4 Workers)" -ForegroundColor Cyan
