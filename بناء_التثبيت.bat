@echo off
chcp 65001 >nul
title بناء ملف التثبيت - DRH
color 0F
echo.
echo  ╔═══════════════════════════════════════════╗
echo  ║   بناء ملف التثبيت - DRH System          ║
echo  ╚═══════════════════════════════════════════╝
echo.
cd /d "%~dp0"

echo  [1/3] بناء الواجهة...
call npx vite build
if %errorlevel% neq 0 (
    echo  خطأ في بناء الواجهة!
    pause
    exit /b 1
)
echo  ✓ تم بناء الواجهة
echo.

echo  [2/3] بناء ملف التثبيت...
call npx electron-builder --win --config
if %errorlevel% neq 0 (
    echo  خطأ في بناء ملف التثبيت!
    pause
    exit /b 1
)

echo.
echo  ════════════════════════════════════════════
echo   ✓ تم بناء ملف التثبيت بنجاح!
echo   الملف موجود في: dist_electron\
echo  ════════════════════════════════════════════
echo.
pause
