$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$workerPath = Join-Path $PSScriptRoot "partner-review-worker.mjs"
$startWorkerPath = Join-Path $PSScriptRoot "start-partner-review-worker-task.ps1"
$envPath = Join-Path $projectRoot ".env.partner-review-worker"
$nodePath = (Get-Command node -ErrorAction Stop).Source
$taskName = "GHR Partner Review Worker"

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Chưa có file .env.partner-review-worker."
}

$action = New-ScheduledTaskAction `
  -Execute $nodePath `
  -Argument "`"$workerPath`"" `
  -WorkingDirectory $projectRoot
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$recoveryTrigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 1) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$triggers = @($logonTrigger, $recoveryTrigger)
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 2) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal `
  -UserId "$env:USERDOMAIN\$env:USERNAME" `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $triggers `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

$protocolRoot = "HKCU:\Software\Classes\ghr-review-worker"
$protocolCommand = Join-Path $protocolRoot "shell\open\command"
New-Item -Path $protocolCommand -Force | Out-Null
Set-ItemProperty -Path $protocolRoot -Name "(Default)" -Value "URL:GHR Partner Review Worker" -Force
Set-ItemProperty -Path $protocolRoot -Name "URL Protocol" -Value "" -Force
$commandValue = 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" "%1"' -f $startWorkerPath
Set-ItemProperty -Path $protocolCommand -Name "(Default)" -Value $commandValue -Force

Start-ScheduledTask -TaskName $taskName
Write-Host "Đã cài và khởi động: $taskName"
