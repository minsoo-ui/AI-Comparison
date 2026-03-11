@echo off
echo ==========================================
echo   🛑 DUNG GOOGLE ANTIGRAVITY PROJECT
echo ==========================================

echo [1/2] Dang dung Backend (Port 3001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /f /pid %%a >nul 2>&1

echo [2/2] Dang dung Frontend (Port 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do taskkill /f /pid %%a >nul 2>&1

echo.
echo ✅ Da dung cac dich vu (neu dang chay).
echo ==========================================
pause
