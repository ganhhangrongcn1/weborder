$ErrorActionPreference = "Stop"

$taskName = "GHR Partner Review Worker"
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
$projectRoot = Split-Path -Parent $PSScriptRoot
$lockPath = Join-Path $projectRoot ".local-tools\partner-review-worker\worker.lock"

if (-not $task) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    "Chua cai tac vu GHR Partner Review Worker tren may nay.",
    "GHR Partner Review Worker",
    "OK",
    "Warning"
  ) | Out-Null
  exit 1
}

if ($task.State -ne "Running") {
  $workerProcess = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq "node.exe" -and $_.CommandLine -like "*partner-review-worker.mjs*"
  }
  if (-not $workerProcess -and (Test-Path -LiteralPath $lockPath)) {
    Remove-Item -LiteralPath $lockPath -Force
  }
  Start-ScheduledTask -TaskName $taskName
}
