$ErrorActionPreference = "Stop"
$taskName = "GHR Partner Review Worker"

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Host "Đã gỡ: $taskName"
} else {
  Write-Host "Không tìm thấy task: $taskName"
}
