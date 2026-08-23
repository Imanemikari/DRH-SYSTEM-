@echo off
chcp 65001 >nul
cd /d "%~dp0"
start /min cmd /c "cd /d %~dp0 && npx vite --host"
timeout /t 5 /nobreak >nul
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp" --dev
