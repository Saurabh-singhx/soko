# Soko Windows Background Service / Scheduled Task Installer
# Run as current user (no administrator elevation required for current user logon task)

$ErrorActionPreference = "Stop"

$sokoDir = (Get-Item "$PSScriptRoot\..\..").FullName
$bridgeScript = Join-Path $sokoDir "scripts\soko_bridge.js"
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source

if (-not $nodePath) {
    Write-Error "Node.js not found in PATH. Please install Node.js."
    exit 1
}

$taskName = "SokoBridgeDaemon"
$action = New-ScheduledTaskAction -Execute $nodePath -Argument "`"$bridgeScript`"" -WorkingDirectory $sokoDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)

Write-Host "Registering Scheduled Task '$taskName'..." -ForegroundColor Cyan

# Remove existing if present
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Soko Desktop Bridge & Ambient HUD Daemon"

Write-Host "Starting task '$taskName'..." -ForegroundColor Green
Start-ScheduledTask -TaskName $taskName

Write-Host "Soko Windows Daemon installed and started successfully!" -ForegroundColor Green
