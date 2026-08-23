@echo off
chcp 65001 >nul
title نظام تسيير الموارد البشرية - DRH
color 0F
echo.
echo  ╔═══════════════════════════════════════════╗
echo  ║   نظام تسيير الموارد البشرية - DRH       ║
echo  ║   Human Resource Management System        ║
echo  ╚═══════════════════════════════════════════╝
echo.
cd /d "%~dp0"

echo  [1/3] جاري بناء الواجهة...
call npx vite build >nul 2>&1
if %errorlevel% neq 0 (
    echo  خطأ في البناء! تأكد من تثبيت المكتبات.
    pause
    exit /b 1
)
echo  ✓ تم بناء الواجهة بنجاح
echo.

echo  [2/3] جاري تشغيل خادم التطوير...
start /min cmd /c "cd /d %~dp0 && npx vite --host"
timeout /t 3 /nobreak >nul
echo  ✓ تم تشغيل الخادم
echo.

echo  [3/3] جاري فتح التطبيق...
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0" --dev
echo  ✓ تم فتح التطبيق
echo.
echo  ─────────────────────────────────────────────
echo   التطبيق يعمل الآن! يمكنك إغلاق هذه النافذة.
echo   لإيقاف التطبيق: أغلق النافذة الرئيسية.
echo  ─────────────────────────────────────────────
echo.
pause
