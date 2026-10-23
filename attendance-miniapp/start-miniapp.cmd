@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules\zmp-cli\index.js" (
  echo Chưa cài Zalo Mini App CLI. Chạy npm ci trong thư mục này trước.
  pause
  exit /b 1
)
echo Chạy Zalo Mini App CLI local. Không gửi xin quyền hoặc triển khai.
call npm start -- --port 5183
pause
