@echo off
chcp 65001 >nul
title DevHub - Install Dependencies

echo.
echo   DevHub : installing dependencies via npmmirror
echo   (Electron binary ~100MB, first run may take a few minutes)
echo.

set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

call npm install --registry=https://registry.npmmirror.com %*

if errorlevel 1 (
  echo.
  echo   [FAILED] Install error. Try:
  echo     1. rd /s /q "%%LOCALAPPDATA%%\electron\Cache"
  echo     2. rd /s /q node_modules
  echo     3. run this script again
  echo.
  pause
  exit /b 1
)

echo.
echo   [OK] Done. Next:
echo        npm run build
echo        npm start
echo.
pause
