$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$workerPath = Join-Path $PSScriptRoot "partner-review-worker.mjs"
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
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
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
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Write-Host "Đã cài và khởi động: $taskName"
