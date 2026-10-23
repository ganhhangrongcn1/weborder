@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules\.bin\vite.cmd" (
  echo Chưa cài dependency của app demo. Chạy npm ci trong thư mục này trước.
  pause
  exit /b 1
)
echo App chấm công demo: http://127.0.0.1:5182/
echo Giữ cửa sổ này mở trong lúc sử dụng. Nhấn Ctrl+C để dừng.
call npm run dev -- --port 5182
pause
