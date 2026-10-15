param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{40}$')][string]$ApprovedCommit,
    [string]$SigningProperties = 'C:\Users\PC\.ghr-pos-signing\signing.properties',
    [string]$Keystore = 'C:\Users\PC\.ghr-pos-signing\ghr-pos-release.keystore',
    [string]$InstalledRelease = 'D:\Ganh Hang Rong\Webapp\GHR VER 5\ghr-pos-mobile-native\releases\GHR-POS-0.4.24.apk',
    [string]$AndroidSdk = 'C:\Users\PC\AppData\Local\Android\Sdk'
)
$ErrorActionPreference = 'Stop'
$repo = 'ganhhangrongcn1/weborder'
Get-Command gh -ErrorAction Stop | Out-Null
foreach ($path in @($SigningProperties, $Keystore, $InstalledRelease)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'Required local signing file or existing APK is missing.' }
}
$signer = Get-ChildItem -LiteralPath (Join-Path $AndroidSdk 'build-tools') -Directory |
    Sort-Object { [version]($_.Name -replace '-.*$', '') } -Descending |
    ForEach-Object { Join-Path $_.FullName 'apksigner.bat' } |
    Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $signer) { throw 'Android apksigner is missing.' }
$certificateOutput = & $signer verify --print-certs $InstalledRelease
if ($LASTEXITCODE -ne 0) { throw 'Existing release APK signature verification failed.' }
$certificateLines = @($certificateOutput | Where-Object { $_ -match '^Signer #\d+ certificate SHA-256 digest: ([0-9a-fA-F]+)$' })
if ($certificateLines.Count -ne 1) { throw 'Expected exactly one APK signer.' }
$certificate = [regex]::Match($certificateLines[0], 'digest: ([0-9a-fA-F]+)').Groups[1].Value.ToLowerInvariant()
# Values go directly to gh stdin, never to process arguments or console output.
try {
    $keyValue = [Convert]::ToBase64String([IO.File]::ReadAllBytes($Keystore))
    $propertiesValue = [Convert]::ToBase64String([IO.File]::ReadAllBytes($SigningProperties))
    $keyValue | & gh secret set POS_KEYSTORE_BASE64 --repo $repo
    if ($LASTEXITCODE -ne 0) { throw 'Keystore secret upload failed.' }
    $propertiesValue | & gh secret set POS_SIGNING_PROPERTIES_BASE64 --repo $repo
    if ($LASTEXITCODE -ne 0) { throw 'Signing properties secret upload failed.' }
    $certificate | & gh variable set POS_RELEASE_CERT_SHA256 --repo $repo
    if ($LASTEXITCODE -ne 0) { throw 'Certificate variable update failed.' }
    $ApprovedCommit | & gh variable set POS_RELEASE_APPROVED_SHA --repo $repo
    if ($LASTEXITCODE -ne 0) { throw 'Approved build commit update failed.' }
    Write-Output 'Signing secrets uploaded; existing APK certificate and approved commit configured.'
} finally {
    $keyValue = $null
    $propertiesValue = $null
    $certificateOutput = $null
}
