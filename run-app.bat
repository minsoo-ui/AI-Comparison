@echo off
echo ==========================================
echo   🚀 KHOI DONG AI COMPARISON PROJECT
echo ==========================================

echo [1/2] Dang khoi dong Backend (Port 3001)...
start "AI-Comparison-Backend" cmd /k "npm run start:dev"

echo [2/2] Dang khoi dong Frontend (Port 5173)...
start "AI-Comparison-Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ✅ Da gui lenh khoi dong! 
echo Vui long cho vai giay de cac dich vu san sang.
echo De dung: Chay file stop-app.bat
echo ==========================================
pause
