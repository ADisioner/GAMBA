@echo off
title GAMBA Tycoon Control Panel
echo ======================================================
echo   PMC: TYCOON - UNIFIED LAUNCHER (LAN MODE)
echo ======================================================

:: Проверка зависимостей фронтенда
if not exist "casino\node_modules" (
    echo [!] Dependencies missing in casino. Installing...
    cd /d "%~dp0casino"
    npm install
    cd /d "%~dp0"
)

:: Launch Backend and Frontend via monorepo
echo [!] Launching Backend and Frontend...
npm run dev

pause
