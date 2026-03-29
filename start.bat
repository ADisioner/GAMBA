@echo off
title GAMBA Tycoon Control Panel
echo ======================================================
echo   PMC: TYCOON - UNIFIED LAUNCHER
echo ======================================================

:: Launch Backend in background console
echo [1/2] Launching Backend...
start "PMC-SERVER" /D "%~dp0server" cmd /c "npm install && npm run dev"

:: Launch Frontend in CURRENT console (shows logs here)
echo [2/2] Launching Frontend...
cd /d "%~dp0casino"
npm install && npm run dev
