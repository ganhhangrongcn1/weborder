$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$workerPath = Join-Path $PSScriptRoot "partner-review-worker.mjs"
$nodeCommand = Get-Command node -ErrorAction Stop

Set-Location -LiteralPath $projectRoot
& $nodeCommand.Source $workerPath

exit $LASTEXITCODE
