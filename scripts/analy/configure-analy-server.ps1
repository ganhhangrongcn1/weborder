$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Write-Host 'KẾT NỐI ANALY TRÊN SUPABASE - LƯU TÀI KHOẢN BẢO MẬT, CHƯA ĐẶT CHUYẾN'
$analyUsername = Read-Host 'Tài khoản Analy mới'
$analySecurePassword = Read-Host 'Mật khẩu (nhập kín)' -AsSecureString
$analyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($analySecurePassword)
try {
    $analyPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($analyPointer)
    if (-not $analyUsername.Trim() -or -not $analyPassword) { throw 'Chưa nhập thông tin.' }
    $analyKeysText = & supabase.cmd projects api-keys --project-ref qjaklysckgzdfjthzkzu --output json 2>$null | Out-String
    if ($LASTEXITCODE -ne 0) { throw 'Chưa kết nối được Supabase quản trị.' }
    $analyKeys = $analyKeysText | ConvertFrom-Json
    $analyServerKey = ($analyKeys | Where-Object { $_.name -eq 'service_role' -and $_.type -eq 'legacy' } | Select-Object -First 1).api_key
    if (-not $analyServerKey) { throw 'Thiếu khóa máy chủ.' }
    $analyInput = @{ username=$analyUsername; password=$analyPassword; serverKey=$analyServerKey } | ConvertTo-Json -Compress
    $analyInput | & node (Join-Path $PSScriptRoot 'configure-analy-server.mjs') --configure
} catch { Write-Host 'Chưa hoàn tất cấu hình. Anh nhắn em kiểm tra; không gửi mật khẩu vào chat.' }
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($analyPointer)
    $analyPassword=$null; $analyInput=$null; $analyServerKey=$null; $analyKeys=$null; $analyKeysText=$null
    $analySecurePassword.Dispose()
}
Read-Host 'Đã dừng. Nhấn Enter để đóng'
